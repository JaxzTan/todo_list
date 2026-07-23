import type { BoardNode, StepNode } from "./types";
import { isStepNode } from "./types";

export interface NumberedStep {
  number: string;
  node: StepNode;
}

/**
 * Depth-first walk assigning "1", "1.1", "1.2", "2" style numbers to STEP
 * nodes. GROUP nodes (phases/projects) are walked through but never
 * numbered themselves, and don't reset the counter — numbering must stay
 * globally unique across phases since Blockers/Notes/Scope changes
 * reference a bare number with no phase qualifier. TRD A4: step numbers
 * are derived from tree position, never stored.
 */
export function numberSteps(nodes: BoardNode[]): NumberedStep[] {
  const out: NumberedStep[] = [];
  let topLevelCounter = 0;

  function walkTopLevel(siblings: BoardNode[]) {
    for (const node of siblings) {
      if (isStepNode(node)) {
        topLevelCounter += 1;
        const number = `${topLevelCounter}`;
        out.push({ number, node });
        walkChildren(node.children, number);
      } else {
        walkTopLevel(node.children);
      }
    }
  }

  function walkChildren(children: StepNode[], parentNumber: string) {
    children.forEach((child, index) => {
      const number = `${parentNumber}.${index + 1}`;
      out.push({ number, node: child });
      walkChildren(child.children, number);
    });
  }

  walkTopLevel(nodes);
  return out;
}

export function buildNumberMap(nodes: BoardNode[]): Map<string, StepNode> {
  const map = new Map<string, StepNode>();
  for (const { number, node } of numberSteps(nodes)) {
    map.set(number, node);
  }
  return map;
}
