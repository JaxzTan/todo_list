export type StepStatus = "todo" | "doing" | "stuck" | "done" | "skipped";
export type Prio = "high" | "med" | "low";
export type NodeKind = "GROUP" | "STEP";
export type Quadrant = "do_now" | "schedule" | "delegate" | "drop";

// The default set matches the wireframe's Fields popover ("Defaults on:
// due, prio, blocker") and is what a board gets on creation.
export const DEFAULT_VISIBLE_FIELDS = ["due", "prio", "blocker"] as const;

export interface BoardSummary {
  id: string;
  slug: string;
  type: "PROJECT" | "DAY";
  title: string;
  goal: string;
  dateKey: string | null;
  deadline: string | null;
  activeColumns: string[];
  visibleFields: string[];
  createdAt: string;
  updatedAt: string;
  // Boards-index list rows (Nocturne wireframe "Your boards" cards) — see
  // lib/boards/service.ts listBoards.
  counts: { done: number; total: number };
  doing: { number: string; title: string } | null;
}

export interface NodeRecord {
  id: string;
  boardId: string;
  parentId: string | null;
  kind: NodeKind;
  title: string;
  doneCondition: string | null;
  position: number;
  status: StepStatus;
  statusAt: string;
  due: string | null;
  prio: Prio | null;
  owner: string | null;
  quadrant: Quadrant | null;
  scheduledAt: string | null;
  flagged: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface NextAction {
  nodeId: string;
  number: string;
  text: string;
}

export interface BoardDetailResponse {
  board: BoardSummary;
  nodes: NodeRecord[];
  nextAction: NextAction | null;
  candidates: NextAction[];
  blockers: { nodeId: string; description: string }[];
  counts: { done: number; total: number };
}

export type EventSource = "INFERRED" | "EXPLICIT" | "IMPORT" | "SYSTEM";
export type EventType =
  | "NODE_ADDED"
  | "NODE_CUT"
  | "NODE_REWORDED"
  | "STATUS_CHANGED"
  | "ATTR_SET"
  | "NOTE_ADDED"
  | "BLOCKER_OPENED"
  | "BLOCKER_RESOLVED"
  | "SESSION_OPENED"
  | "SESSION_CLOSED";

export interface EventRecord {
  id: string;
  boardId: string;
  sessionId: string | null;
  nodeId: string | null;
  type: EventType;
  payload: Record<string, unknown>;
  source: EventSource;
  ambiguous: boolean;
  revertedBy: string | null;
  at: string;
}

export interface TreeNode {
  node: NodeRecord;
  number: string;
  children: TreeNode[];
}
