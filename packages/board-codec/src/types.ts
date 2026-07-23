export const FORMAT_VERSION = 1;

export type BoardType = "project" | "day";
export type StepStatus = "todo" | "doing" | "stuck" | "done" | "skipped";
export type Prio = "high" | "med" | "low";
export type Quadrant = "do_now" | "schedule" | "delegate" | "drop";
export type ActiveColumn = "due" | "prio" | "owner";
export type ScopeChangeKind = "ADD" | "CUT" | "REWORD";

export interface GroupNode {
  kind: "GROUP";
  title: string;
  children: StepNode[];
}

export interface StepNode {
  kind: "STEP";
  title: string;
  status: StepStatus;
  doneCondition?: string;
  due?: string;
  prio?: Prio;
  owner?: string;
  quadrant?: Quadrant;
  children: StepNode[];
}

export type BoardNode = GroupNode | StepNode;

export interface BoardBlocker {
  stepNumber: string;
  description: string;
  unblockPlan?: string;
}

export interface BoardScopeChange {
  kind: ScopeChangeKind;
  stepNumber: string;
  reason: string;
}

export interface BoardNote {
  stepNumber: string;
  body: string;
}

export interface BoardWaitingItem {
  stepNumber: string;
  owner: string;
  text: string;
}

export interface CanonicalBoard {
  formatVersion: number;
  title: string;
  goal: string;
  type: BoardType;
  sessions: number;
  dateKey?: string;
  deadline?: string;
  activeColumns: ActiveColumn[];
  nodes: BoardNode[];
  blockers: BoardBlocker[];
  scopeChanges: BoardScopeChange[];
  notes: BoardNote[];
  waiting: BoardWaitingItem[];
}

export interface ParseResult {
  board: CanonicalBoard;
  unparsed: string | null;
  warnings: string[];
}

export function isStepNode(node: BoardNode): node is StepNode {
  return node.kind === "STEP";
}

export function isGroupNode(node: BoardNode): node is GroupNode {
  return node.kind === "GROUP";
}
