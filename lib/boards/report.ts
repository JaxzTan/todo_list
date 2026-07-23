import type { Report } from "@prisma/client";
import { withTenant } from "../db";
import { ConflictError } from "../api/errors";
import { findBoardOrThrow } from "./service";
import { resolveNextAction } from "./nextAction";
import { numberMap } from "./tree";

/**
 * FR-15/TR-11: rendered from DB state, never from chat text; FR-15's
 * "learnings" section has no dedicated data source in this schema (no
 * Learning model — see docs/list.md), so it's honestly folded into Notes
 * rather than faked under a label the data doesn't back up. Empty
 * sections are omitted (TR-11), and reports are frozen at generation
 * (Report.body is stored, not regenerated) since a later board edit
 * shouldn't silently rewrite what the user was handed at the time.
 */
export async function generateReport(userId: string, slug: string): Promise<Report> {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);

    const session =
      (await tx.session.findFirst({ where: { boardId: board.id, endedAt: null }, orderBy: { seq: "desc" } })) ??
      (await tx.session.findFirst({ where: { boardId: board.id }, orderBy: { seq: "desc" } }));
    if (!session) throw new ConflictError("no session to report on — open one first");

    const [sessionEvents, openBlockers, activeNodes] = await Promise.all([
      tx.event.findMany({ where: { boardId: board.id, sessionId: session.id }, orderBy: { at: "asc" } }),
      tx.blocker.findMany({ where: { boardId: board.id, resolvedAt: null } }),
      tx.node.findMany({ where: { boardId: board.id, archivedAt: null } }),
    ]);

    const numbers = numberMap(activeNodes);
    const titleOf = (nodeId: string | null) =>
      (nodeId && activeNodes.find((n) => n.id === nodeId)?.title) || "(unknown step)";

    const completed = sessionEvents
      .filter((e) => e.type === "STATUS_CHANGED" && (e.payload as { to?: string }).to === "done")
      .map((e) => `- ${titleOf(e.nodeId)}`);

    const scopeChanges = sessionEvents
      .filter((e) => e.type === "NODE_ADDED" || e.type === "NODE_CUT" || e.type === "NODE_REWORDED")
      .filter((e) => !(e.type === "NODE_ADDED" && (e.payload as { isLayer3?: boolean }).isLayer3))
      .map((e) => {
        const p = e.payload as { reason?: string | null; to?: string };
        const verb = e.type === "NODE_ADDED" ? "Added" : e.type === "NODE_CUT" ? "Cut" : "Reworded";
        return `- ${verb} "${titleOf(e.nodeId)}"${p.reason ? ` — ${p.reason}` : ""}`;
      });

    const blockers = openBlockers.map(
      (b) => `- ${titleOf(b.nodeId)}: ${b.description}${b.unblockPlan ? ` — unblock: ${b.unblockPlan}` : ""}`,
    );

    const waiting = activeNodes
      .filter((n) => n.kind === "STEP" && n.owner)
      .map((n) => `- ${n.title} (${n.owner})`);

    const notes = sessionEvents
      .filter((e) => e.type === "NOTE_ADDED")
      .map((e) => `- ${titleOf(e.nodeId)}: ${(e.payload as { body: string }).body}`);

    const next = resolveNextAction(activeNodes);
    const steps = activeNodes.filter((n) => n.kind === "STEP");
    const doneCount = steps.filter((n) => n.status === "done" || n.status === "skipped").length;

    const sections: string[] = [];
    sections.push(`# Session report — ${board.title}`, "");
    sections.push(`Session #${session.seq} · ${doneCount}/${steps.length} steps done`, "");
    if (completed.length) sections.push("## Completed", "", ...completed, "");
    if (blockers.length) sections.push("## Blockers", "", ...blockers, "");
    if (scopeChanges.length) sections.push("## Scope changes", "", ...scopeChanges, "");
    if (waiting.length) sections.push("## Waiting on", "", ...waiting, "");
    if (notes.length) sections.push("## Notes", "", ...notes, "");
    sections.push(
      "## Next action",
      "",
      next ? `- ${numbers.get(next.nodeId) ?? next.number}. ${next.text}` : "— board complete",
      "",
    );

    while (sections.length > 0 && sections[sections.length - 1] === "") sections.pop();
    const body = sections.join("\n") + "\n";

    return tx.report.create({ data: { boardId: board.id, sessionId: session.id, body } });
  });
}
