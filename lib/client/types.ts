export type StepStatus = "todo" | "doing" | "stuck" | "done" | "skipped";
export type Prio = "high" | "med" | "low";
export type Quadrant = "do_now" | "schedule" | "delegate" | "drop";
export type NodeKind = "GROUP" | "STEP";

export interface BoardSummary {
  id: string;
  slug: string;
  type: "PROJECT" | "DAY";
  title: string;
  goal: string;
  dateKey: string | null;
  deadline: string | null;
  activeColumns: string[];
  createdAt: string;
  updatedAt: string;
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
  counts: { done: number; total: number };
}

export interface TreeNode {
  node: NodeRecord;
  number: string;
  children: TreeNode[];
}
