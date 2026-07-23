import { Prisma } from "@prisma/client";
import { withTenant } from "../db";
import { ConflictError, NotFoundError } from "../api/errors";
import { findBoardOrThrow } from "./service";
import { currentSessionId, emitEvent } from "./events";
import type { AddNodeInput, AddNoteInput, PatchNodeInput } from "./schemas";

const ACTIVE_COLUMN_BY_FIELD = { due: "due", prio: "prio", owner: "owner" } as const;

function isUniqueConstraintOn(err: unknown, constraint: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    JSON.stringify(err.meta ?? {}).includes(constraint)
  );
}

export async function addNode(userId: string, slug: string, input: AddNodeInput) {
  try {
    return await withTenant(userId, async (tx) => {
      const board = await findBoardOrThrow(tx, userId, slug);

      let parent = null;
      if (input.parentId) {
        parent = await tx.node.findFirst({ where: { id: input.parentId, boardId: board.id } });
        if (!parent) throw new NotFoundError(`no node ${input.parentId} on board "${slug}"`);
      }

      const last = await tx.node.findFirst({
        where: { boardId: board.id, parentId: input.parentId ?? null },
        orderBy: { position: "desc" },
      });

      const node = await tx.node.create({
        data: {
          boardId: board.id,
          parentId: input.parentId ?? null,
          kind: input.kind,
          title: input.title,
          doneCondition: input.doneCondition,
          position: (last?.position ?? 0) + 1,
        },
      });

      const sessionId = await currentSessionId(tx, board.id);
      // TR-10: a subtask (parent is itself a STEP) is "layer-3 detail" and
      // doesn't count as a scope change — snapshotted here rather than
      // re-derived later, since the parent can be reparented or cut.
      const isLayer3 = parent?.kind === "STEP";
      await emitEvent(tx, {
        boardId: board.id,
        sessionId,
        nodeId: node.id,
        type: "NODE_ADDED",
        payload: { title: node.title, kind: node.kind, isLayer3, reason: input.reason ?? null },
      });

      await tx.board.update({ where: { id: board.id }, data: { updatedAt: new Date() } });

      return node;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      throw new NotFoundError();
    }
    throw err;
  }
}

export async function addNote(userId: string, slug: string, nodeId: string, input: AddNoteInput) {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    const node = await tx.node.findFirst({ where: { id: nodeId, boardId: board.id } });
    if (!node) throw new NotFoundError(`no node ${nodeId} on board "${slug}"`);

    const sessionId = await currentSessionId(tx, board.id);
    const event = await emitEvent(tx, {
      boardId: board.id,
      sessionId,
      nodeId: node.id,
      type: "NOTE_ADDED",
      payload: { body: input.body },
    });
    return event;
  });
}

export async function patchNode(
  userId: string,
  slug: string,
  nodeId: string,
  input: PatchNodeInput,
) {
  try {
    return await withTenant(userId, async (tx) => {
      const board = await findBoardOrThrow(tx, userId, slug);
      const node = await tx.node.findFirst({ where: { id: nodeId, boardId: board.id } });
      if (!node) throw new NotFoundError(`no node ${nodeId} on board "${slug}"`);

      const sessionId = await currentSessionId(tx, board.id);
      const source = input.source ?? "EXPLICIT";
      const ambiguous = input.ambiguous ?? false;
      const newActiveColumns = new Set(board.activeColumns);

      // Status (TR-18: written in the same transaction as its event).
      if (input.status && input.status !== node.status) {
        await tx.node.update({
          where: { id: node.id },
          data: { status: input.status, statusAt: new Date() },
        });
        await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "STATUS_CHANGED",
          payload: { from: node.status, to: input.status },
          source,
          ambiguous,
        });

        if (input.status === "stuck") {
          // TR-6: the transition and its Blocker insert are structurally
          // one operation — both happen here, in this transaction.
          const blocker = input.blocker!;
          const blockerEvent = await emitEvent(tx, {
            boardId: board.id,
            sessionId,
            nodeId: node.id,
            type: "BLOCKER_OPENED",
            payload: { description: blocker.description, unblockPlan: blocker.unblockPlan ?? null },
            source,
            ambiguous,
          });
          await tx.blocker.create({
            data: {
              boardId: board.id,
              nodeId: node.id,
              description: blocker.description,
              unblockPlan: blocker.unblockPlan,
              openedEventId: blockerEvent.id,
            },
          });
        } else {
          const openBlocker = await tx.blocker.findFirst({
            where: { nodeId: node.id, resolvedAt: null },
          });
          if (openBlocker) {
            const resolveEvent = await emitEvent(tx, {
              boardId: board.id,
              sessionId,
              nodeId: node.id,
              type: "BLOCKER_RESOLVED",
              payload: { auto: true, reason: "status left stuck" },
              source: "SYSTEM",
            });
            await tx.blocker.update({
              where: { id: openBlocker.id },
              data: { resolvedAt: new Date(), resolvedEventId: resolveEvent.id },
            });
          }
        }
      }

      // Reword (TR-10: scope change).
      if (input.title && input.title !== node.title) {
        await tx.node.update({ where: { id: node.id }, data: { title: input.title } });
        await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "NODE_REWORDED",
          payload: { from: node.title, to: input.title, reason: input.reason },
          source,
          ambiguous,
        });
      }

      // Attributes: due / prio / owner / quadrant / doneCondition.
      const attrChanges: Record<string, { from: string | null; to: string | null }> = {};
      const attrData: Prisma.NodeUpdateInput = {};

      if (input.due !== undefined) {
        const to = input.due ? new Date(`${input.due}T00:00:00.000Z`) : null;
        attrChanges.due = { from: node.due ? node.due.toISOString() : null, to: to ? to.toISOString() : null };
        attrData.due = to;
        if (to) newActiveColumns.add(ACTIVE_COLUMN_BY_FIELD.due);
      }
      if (input.prio !== undefined) {
        attrChanges.prio = { from: node.prio, to: input.prio };
        attrData.prio = input.prio;
        if (input.prio) newActiveColumns.add(ACTIVE_COLUMN_BY_FIELD.prio);
      }
      if (input.owner !== undefined) {
        attrChanges.owner = { from: node.owner, to: input.owner };
        attrData.owner = input.owner;
        if (input.owner) newActiveColumns.add(ACTIVE_COLUMN_BY_FIELD.owner);
      }
      if (input.quadrant !== undefined) {
        attrChanges.quadrant = { from: node.quadrant, to: input.quadrant };
        attrData.quadrant = input.quadrant;
      }
      if (input.doneCondition !== undefined) {
        attrChanges.doneCondition = { from: node.doneCondition, to: input.doneCondition };
        attrData.doneCondition = input.doneCondition;
      }

      if (Object.keys(attrChanges).length > 0) {
        await tx.node.update({ where: { id: node.id }, data: attrData });
        await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "ATTR_SET",
          payload: attrChanges,
          source,
          ambiguous,
        });
      }

      // Cut / restore (TR-10: cutting is a scope change; restoring isn't).
      if (input.archived !== undefined) {
        const archivedAt = input.archived ? new Date() : null;
        await tx.node.update({ where: { id: node.id }, data: { archivedAt } });
        if (input.archived) {
          await emitEvent(tx, {
            boardId: board.id,
            sessionId,
            nodeId: node.id,
            type: "NODE_CUT",
            payload: { reason: input.reason },
            source,
            ambiguous,
          });
        }
      }

      if (newActiveColumns.size !== board.activeColumns.length) {
        await tx.board.update({
          where: { id: board.id },
          data: { activeColumns: [...newActiveColumns] },
        });
      } else {
        await tx.board.update({ where: { id: board.id }, data: { updatedAt: new Date() } });
      }

      return tx.node.findUniqueOrThrow({ where: { id: node.id } });
    });
  } catch (err) {
    if (isUniqueConstraintOn(err, "Node_one_doing_per_board")) {
      throw new ConflictError(
        "another step on this board is already `doing` — finish or move it first (FR-7)",
      );
    }
    throw err;
  }
}
