import type { Node as NodeRow } from "@prisma/client";
import { buildTree, numberTree } from "./tree";

export interface NextAction {
  nodeId: string;
  number: string;
  text: string;
}

const PRIO_RANK: Record<string, number> = { high: 0, med: 1, low: 2 };

function compareNumbers(a: string, b: string): number {
  const as = a.split(".").map(Number);
  const bs = b.split(".").map(Number);
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const diff = (as[i] ?? 0) - (bs[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * TR-5: phase order, then priority, then position. Owner-assigned steps
 * move to Waiting on and are excluded (FR-20); `stuck` is excluded too —
 * it needs its blocker resolved before it's actionable, `doing` stays
 * eligible since FR-7 already caps it at one in flight.
 */
export function resolveNextAction(rows: NodeRow[]): NextAction | null {
  const numbered = numberTree(buildTree(rows));

  const candidates = numbered.filter(
    ({ row }) =>
      row.kind === "STEP" &&
      !row.archivedAt &&
      !row.owner &&
      (row.status === "todo" || row.status === "doing"),
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.phaseIndex !== b.phaseIndex) return a.phaseIndex - b.phaseIndex;
    const aPrio = PRIO_RANK[a.row.prio ?? ""] ?? 3;
    const bPrio = PRIO_RANK[b.row.prio ?? ""] ?? 3;
    if (aPrio !== bPrio) return aPrio - bPrio;
    return compareNumbers(a.number, b.number);
  });

  const winner = candidates[0]!;
  return { nodeId: winner.row.id, number: winner.number, text: winner.row.title };
}
