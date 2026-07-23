import type { BoardNode, CanonicalBoard, StepNode } from "./types";
import { isGroupNode, isStepNode } from "./types";
import { numberSteps } from "./numbering";

const STATUS_MARK: Record<StepNode["status"], string> = {
  todo: " ",
  doing: "~",
  stuck: "!",
  done: "x",
  skipped: "-",
};

function depthOf(number: string): number {
  return number.split(".").length - 1;
}

function metadataLine(node: StepNode): string {
  const parts: string[] = [];
  if (node.due) parts.push(`due:${node.due}`);
  if (node.prio) parts.push(`prio:${node.prio}`);
  if (node.owner) parts.push(`owner:${node.owner}`);
  if (node.quadrant) parts.push(`q:${node.quadrant}`);
  return parts.length > 0 ? ` \`${parts.join(" ")}\`` : "";
}

export function serializeToMarkdown(board: CanonicalBoard): string {
  const numbers = new Map<StepNode, string>();
  for (const { number, node } of numberSteps(board.nodes)) {
    numbers.set(node, number);
  }

  const lines: string[] = [];
  lines.push(`# ${board.title}`, "");
  lines.push(`- Goal: ${board.goal}`);
  lines.push(`- Type: ${board.type}`);
  lines.push(`- Sessions: ${board.sessions}`);
  if (board.deadline) lines.push(`- Deadline: ${board.deadline}`);
  if (board.dateKey) lines.push(`- Date: ${board.dateKey}`);
  if (board.activeColumns.length > 0) {
    lines.push(`- Columns: ${board.activeColumns.join(", ")}`);
  }
  lines.push("", "## Board", "");

  function renderStep(node: StepNode) {
    const number = numbers.get(node)!;
    const indent = "   ".repeat(depthOf(number));
    lines.push(
      `${indent}${number}. [${STATUS_MARK[node.status]}] ${node.title}${metadataLine(node)}`,
    );
    if (node.doneCondition) {
      lines.push(`${indent}   > done: ${node.doneCondition}`);
    }
    for (const child of node.children) renderStep(child);
  }

  function renderSiblings(siblings: BoardNode[]) {
    for (const node of siblings) {
      if (isStepNode(node)) {
        renderStep(node);
      } else if (isGroupNode(node)) {
        lines.push(`### ${node.title}`, "");
        renderSiblings(node.children);
        lines.push("");
      }
    }
  }

  renderSiblings(board.nodes);
  lines.push("");

  if (board.blockers.length > 0) {
    lines.push("## Blockers", "");
    for (const b of board.blockers) {
      const plan = b.unblockPlan ? ` — unblock: ${b.unblockPlan}` : "";
      lines.push(`- ${b.stepNumber}: ${b.description}${plan}`);
    }
    lines.push("");
  }

  if (board.scopeChanges.length > 0) {
    lines.push("## Scope changes", "");
    for (const s of board.scopeChanges) {
      lines.push(`- ${s.kind} ${s.stepNumber} — ${s.reason}`);
    }
    lines.push("");
  }

  if (board.notes.length > 0) {
    lines.push("## Notes", "");
    for (const n of board.notes) {
      lines.push(`- ${n.stepNumber}: ${n.body}`);
    }
    lines.push("");
  }

  if (board.waiting.length > 0) {
    lines.push("## Waiting on", "");
    for (const w of board.waiting) {
      lines.push(`- ${w.stepNumber} (${w.owner}) — ${w.text}`);
    }
    lines.push("");
  }

  // Collapse runs of blank lines (section boundaries can each contribute
  // one) down to a single separator, then trim trailing blanks entirely.
  const collapsed: string[] = [];
  for (const line of lines) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === "") collapsed.pop();
  return collapsed.join("\n") + "\n";
}
