import type { NodeRecord, TreeNode } from "./types";

/** Client-side mirror of lib/boards/tree.ts's numbering, for rendering. */
export function buildClientTree(nodes: NodeRecord[]): TreeNode[] {
  const byParent = new Map<string | null, NodeRecord[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  let topCounter = 0;

  function walkTop(parentId: string | null): TreeNode[] {
    const out: TreeNode[] = [];
    for (const node of byParent.get(parentId) ?? []) {
      if (node.kind === "STEP") {
        topCounter += 1;
        const number = `${topCounter}`;
        out.push({ node, number, children: walkChildren(node.id, number) });
      } else {
        out.push({ node, number: "", children: walkTop(node.id) });
      }
    }
    return out;
  }

  function walkChildren(parentId: string, parentNumber: string): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((node, index) => {
      const number = `${parentNumber}.${index + 1}`;
      return { node, number, children: walkChildren(node.id, number) };
    });
  }

  return walkTop(null);
}

export function flatten(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap((t) => [t, ...flatten(t.children)]);
}
