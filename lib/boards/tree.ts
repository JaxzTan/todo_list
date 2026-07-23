import type { Node as NodeRow } from "@prisma/client";

export interface TreeNode {
  row: NodeRow;
  children: TreeNode[];
}

export function buildTree(rows: NodeRow[]): TreeNode[] {
  const byParent = new Map<string | null, NodeRow[]>();
  for (const row of rows) {
    const key = row.parentId;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  function build(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((row) => ({ row, children: build(row.id) }));
  }

  return build(null);
}

export interface NumberedNode {
  number: string;
  /** 0-based index of the enclosing GROUP (phase/project); bare root steps
   *  that precede any group are phase 0, matching the board-codec grammar
   *  constraint that ungrouped steps always come first. */
  phaseIndex: number;
  row: NodeRow;
}

/**
 * Depth-first walk assigning "1", "1.1", "2" style numbers to STEP rows —
 * mirrors board-codec's numberSteps (TRD A4: derived, never stored), but
 * operates on DB rows so callers can map a number back to a row id.
 */
export function numberTree(tree: TreeNode[]): NumberedNode[] {
  const out: NumberedNode[] = [];
  let topCounter = 0;
  let phaseIndex = 0;

  function walkTop(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.row.kind === "STEP") {
        topCounter += 1;
        const number = `${topCounter}`;
        out.push({ number, phaseIndex, row: node.row });
        walkChildren(node.children, number, phaseIndex);
      } else {
        phaseIndex += 1;
        walkTop(node.children);
      }
    }
  }

  function walkChildren(nodes: TreeNode[], parentNumber: string, phase: number) {
    nodes.forEach((node, index) => {
      const number = `${parentNumber}.${index + 1}`;
      out.push({ number, phaseIndex: phase, row: node.row });
      walkChildren(node.children, number, phase);
    });
  }

  walkTop(tree);
  return out;
}

export function numberMap(rows: NodeRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { number, row } of numberTree(buildTree(rows))) {
    map.set(row.id, number);
  }
  return map;
}

/**
 * TR-8: a GROUP or parent STEP reads as done when every child is
 * done/skipped. Derived on read, never written — see A4.
 */
export function isEffectivelyDone(node: TreeNode): boolean {
  if (node.children.length === 0) {
    return node.row.kind === "STEP" && (node.row.status === "done" || node.row.status === "skipped");
  }
  return node.children.every(isEffectivelyDone);
}
