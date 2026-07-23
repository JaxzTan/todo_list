import type { Prisma } from "@prisma/client";
import {
  serializeToMarkdown,
  parseMarkdown,
  type CanonicalBoard,
  type BoardNode as CodecNode,
  type StepNode as CodecStepNode,
} from "board-codec";
import { withTenant } from "../db";
import { findBoardOrThrow } from "./service";
import { buildTree, numberMap, type TreeNode } from "./tree";
import { currentSessionId, emitEvent } from "./events";

function isoDate(d: Date | null): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

function toCodecNode(t: TreeNode): CodecNode {
  if (t.row.kind === "GROUP") {
    return {
      kind: "GROUP",
      title: t.row.title,
      // The grammar (board-codec/src/parse.ts) doesn't support nested
      // groups, and nothing in this app creates one — GROUP children are
      // always STEP in practice.
      children: t.children.map(toCodecNode) as CodecStepNode[],
    };
  }
  return {
    kind: "STEP",
    title: t.row.title,
    status: t.row.status,
    doneCondition: t.row.doneCondition ?? undefined,
    due: isoDate(t.row.due),
    prio: t.row.prio ?? undefined,
    owner: t.row.owner ?? undefined,
    quadrant: t.row.quadrant ?? undefined,
    children: t.children.map(toCodecNode) as CodecStepNode[],
  };
}

/**
 * TR-4: lossless export for every field the codec models. Notes and scope
 * changes live in the Event log (A1), not their own tables, so they're
 * derived here rather than joined from a dedicated relation.
 */
export async function exportBoardMarkdown(userId: string, slug: string): Promise<string> {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    const nodes = await tx.node.findMany({
      where: { boardId: board.id, archivedAt: null },
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
    });
    const numbers = numberMap(nodes);

    const [openBlockers, sessionCount, scopeEvents, noteEvents] = await Promise.all([
      tx.blocker.findMany({ where: { boardId: board.id, resolvedAt: null } }),
      tx.session.count({ where: { boardId: board.id } }),
      tx.event.findMany({
        where: { boardId: board.id, type: { in: ["NODE_ADDED", "NODE_CUT", "NODE_REWORDED"] } },
        orderBy: { at: "asc" },
      }),
      tx.event.findMany({
        where: { boardId: board.id, type: "NOTE_ADDED" },
        orderBy: { at: "asc" },
      }),
    ]);

    const canonical: CanonicalBoard = {
      formatVersion: 1,
      title: board.title,
      goal: board.goal,
      type: board.type === "PROJECT" ? "project" : "day",
      sessions: sessionCount,
      dateKey: board.dateKey ?? undefined,
      deadline: isoDate(board.deadline),
      activeColumns: board.activeColumns as CanonicalBoard["activeColumns"],
      nodes: buildTree(nodes).map(toCodecNode),
      blockers: openBlockers
        .map((b) => ({
          stepNumber: numbers.get(b.nodeId) ?? "?",
          description: b.description,
          unblockPlan: b.unblockPlan ?? undefined,
        }))
        .filter((b) => b.stepNumber !== "?"),
      scopeChanges: scopeEvents
        .filter((e) => !(e.type === "NODE_ADDED" && (e.payload as { isLayer3?: boolean }).isLayer3))
        .map((e) => {
          const number = e.nodeId ? numbers.get(e.nodeId) : undefined;
          const payload = e.payload as { reason?: string | null; from?: string; to?: string };
          const kind = e.type === "NODE_ADDED" ? "ADD" : e.type === "NODE_CUT" ? "CUT" : "REWORD";
          return {
            kind: kind as "ADD" | "CUT" | "REWORD",
            stepNumber: number ?? "?",
            reason: payload.reason ?? (kind === "REWORD" ? `renamed to "${payload.to}"` : "no reason given"),
          };
        })
        .filter((s) => s.stepNumber !== "?"),
      notes: noteEvents
        .map((e) => ({
          stepNumber: e.nodeId ? (numbers.get(e.nodeId) ?? "?") : "?",
          body: (e.payload as { body: string }).body,
        }))
        .filter((n) => n.stepNumber !== "?"),
      waiting: nodes
        .filter((n) => n.kind === "STEP" && n.owner)
        .map((n) => ({
          stepNumber: numbers.get(n.id) ?? "?",
          owner: n.owner!,
          text: n.doneCondition ?? n.title,
        }))
        .filter((w) => w.stepNumber !== "?"),
    };

    return serializeToMarkdown(canonical);
  });
}

/**
 * FR-1/FR-5: creates a board from an uploaded markdown file. A second
 * import against an existing slug is accepted (TR-3 leniency) but, for now,
 * fully replaces the node tree rather than diffing it — a positional merge
 * that infers exactly which steps changed is real future work, not
 * something to fake. Every import is recorded either way (Import.rawBody /
 * unparsed / warnings), so nothing is lost even under the simple strategy.
 */
export async function importBoardMarkdown(
  userId: string,
  slug: string,
  rawMarkdown: string,
): Promise<{ boardId: string; warnings: string[] }> {
  const { board: parsed, unparsed, warnings } = parseMarkdown(rawMarkdown);

  return withTenant(userId, async (tx) => {
    let board = await tx.board.findFirst({ where: { ownerId: userId, slug } });
    const bodyHash = await hashBody(rawMarkdown);

    if (!board) {
      board = await tx.board.create({
        data: {
          ownerId: userId,
          slug,
          type: parsed.type === "day" ? "DAY" : "PROJECT",
          title: parsed.title,
          goal: parsed.goal,
          dateKey: parsed.dateKey,
          deadline: parsed.deadline ? new Date(`${parsed.deadline}T00:00:00.000Z`) : null,
          activeColumns: parsed.activeColumns,
        },
      });
    } else {
      await tx.node.updateMany({ where: { boardId: board.id }, data: { archivedAt: new Date() } });
      await tx.board.update({
        where: { id: board.id },
        data: {
          title: parsed.title,
          goal: parsed.goal,
          dateKey: parsed.dateKey,
          deadline: parsed.deadline ? new Date(`${parsed.deadline}T00:00:00.000Z`) : null,
          activeColumns: parsed.activeColumns,
        },
      });
    }

    const sessionId = await currentSessionId(tx, board.id);

    async function insertNodes(nodes: CodecNode[], parentId: string | null) {
      let position = 0;
      for (const n of nodes) {
        position += 1;
        const created = await tx.node.create({
          data: {
            boardId: board!.id,
            parentId,
            kind: n.kind,
            title: n.title,
            position,
            ...(n.kind === "STEP"
              ? {
                  status: n.status,
                  doneCondition: n.doneCondition,
                  due: n.due ? new Date(`${n.due}T00:00:00.000Z`) : null,
                  prio: n.prio,
                  owner: n.owner,
                  quadrant: n.quadrant,
                }
              : {}),
          },
        });
        await emitEvent(tx, {
          boardId: board!.id,
          sessionId,
          nodeId: created.id,
          type: "NODE_ADDED",
          payload: { title: n.title, kind: n.kind, source: "import" },
          source: "IMPORT",
        });
        await insertNodes(n.children, created.id);
      }
    }
    await insertNodes(parsed.nodes, null);

    await tx.import.create({
      data: {
        boardId: board.id,
        sessionId,
        rawBody: rawMarkdown,
        unparsed,
        warnings: warnings as Prisma.InputJsonValue,
        bodyHash,
        appliedAt: new Date(),
      },
    });

    return { boardId: board.id, warnings };
  });
}

async function hashBody(body: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(body).digest("hex");
}
