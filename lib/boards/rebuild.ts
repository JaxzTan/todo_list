import { withTenant } from "../db";
import { findBoardOrThrow } from "./service";

export interface StatusMismatch {
  nodeId: string;
  stored: string;
  rebuilt: string;
}

/**
 * TR-22: rebuilds every Node.status from the STATUS_CHANGED event log and
 * reports (and fixes) mismatches. This is what keeps TR-18's denormalized
 * status column honest — if this job can't reproduce it, it isn't a cache,
 * it's a second source of truth.
 */
export async function rebuildBoardStatuses(userId: string, slug: string): Promise<StatusMismatch[]> {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);

    const [nodes, events] = await Promise.all([
      tx.node.findMany({ where: { boardId: board.id } }),
      tx.event.findMany({
        where: { boardId: board.id, type: "STATUS_CHANGED", nodeId: { not: null } },
        orderBy: { at: "asc" },
      }),
    ]);

    const rebuilt = new Map<string, string>();
    for (const node of nodes) rebuilt.set(node.id, "todo");
    for (const event of events) {
      const payload = event.payload as { to?: string };
      if (event.nodeId && payload.to) rebuilt.set(event.nodeId, payload.to);
    }

    const mismatches: StatusMismatch[] = [];
    for (const node of nodes) {
      const correct = rebuilt.get(node.id) ?? "todo";
      if (correct !== node.status) {
        mismatches.push({ nodeId: node.id, stored: node.status, rebuilt: correct });
      }
    }

    for (const mismatch of mismatches) {
      await tx.node.update({
        where: { id: mismatch.nodeId },
        data: { status: mismatch.rebuilt as never },
      });
    }

    return mismatches;
  });
}
