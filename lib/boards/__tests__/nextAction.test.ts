import { describe, expect, it } from "vitest";
import type { Node as NodeRow } from "@prisma/client";
import { resolveNextAction } from "../nextAction";
import { buildTree, isEffectivelyDone, numberMap } from "../tree";

let seq = 0;
function node(overrides: Partial<NodeRow> & { id: string; kind: "GROUP" | "STEP" }): NodeRow {
  seq += 1;
  return {
    boardId: "board-1",
    parentId: null,
    title: "untitled",
    doneCondition: null,
    position: seq,
    status: "todo",
    statusAt: new Date(),
    due: null,
    prio: null,
    owner: null,
    quadrant: null,
    archivedAt: null,
    createdAt: new Date(),
    ...overrides,
  } as NodeRow;
}

describe("resolveNextAction (TR-5)", () => {
  it("returns null when there is nothing actionable", () => {
    expect(resolveNextAction([])).toBeNull();
    expect(
      resolveNextAction([node({ id: "a", kind: "STEP", status: "done" })]),
    ).toBeNull();
  });

  it("prefers an earlier phase over a later one, regardless of priority", () => {
    const rows = [
      node({ id: "g1", kind: "GROUP", position: 1 }),
      node({ id: "a", kind: "STEP", parentId: "g1", position: 1, prio: "low" }),
      node({ id: "g2", kind: "GROUP", position: 2 }),
      node({ id: "b", kind: "STEP", parentId: "g2", position: 1, prio: "high" }),
    ];
    // "a" is phase 0 (low prio), "b" is phase 1 (high prio) — phase wins.
    expect(resolveNextAction(rows)?.nodeId).toBe("a");
  });

  it("within the same phase, higher priority wins over earlier position", () => {
    const rows = [
      node({ id: "a", kind: "STEP", position: 1, prio: "low" }),
      node({ id: "b", kind: "STEP", position: 2, prio: "high" }),
    ];
    expect(resolveNextAction(rows)?.nodeId).toBe("b");
  });

  it("within the same phase and priority, earlier position wins", () => {
    const rows = [
      node({ id: "a", kind: "STEP", position: 2 }),
      node({ id: "b", kind: "STEP", position: 1 }),
    ];
    // buildTree sorts by position, so "b" (position 1) is numbered "1".
    expect(resolveNextAction(rows)?.nodeId).toBe("b");
  });

  it("excludes owner-assigned steps (FR-20 — they move to Waiting on)", () => {
    const rows = [node({ id: "a", kind: "STEP", owner: "jayci" })];
    expect(resolveNextAction(rows)).toBeNull();
  });

  it("excludes stuck steps until their blocker is resolved", () => {
    const rows = [node({ id: "a", kind: "STEP", status: "stuck" })];
    expect(resolveNextAction(rows)).toBeNull();
  });

  it("excludes archived (cut) steps", () => {
    const rows = [node({ id: "a", kind: "STEP", archivedAt: new Date() })];
    expect(resolveNextAction(rows)).toBeNull();
  });

  it("`doing` steps remain eligible (FR-7 already caps at one in flight)", () => {
    const rows = [node({ id: "a", kind: "STEP", status: "doing" })];
    expect(resolveNextAction(rows)?.nodeId).toBe("a");
  });
});

describe("tree helpers", () => {
  it("numberMap assigns dotted numbers depth-first over STEP nodes only", () => {
    const rows = [
      node({ id: "s1", kind: "STEP", position: 1 }),
      node({ id: "s1a", kind: "STEP", parentId: "s1", position: 1 }),
      node({ id: "s2", kind: "STEP", position: 2 }),
    ];
    const map = numberMap(rows);
    expect(map.get("s1")).toBe("1");
    expect(map.get("s1a")).toBe("1.1");
    expect(map.get("s2")).toBe("2");
  });

  it("isEffectivelyDone (TR-8): a parent is done only when every child is done/skipped", () => {
    const rows = [
      node({ id: "p", kind: "STEP", position: 1, status: "doing" }),
      node({ id: "c1", kind: "STEP", parentId: "p", position: 1, status: "done" }),
      node({ id: "c2", kind: "STEP", parentId: "p", position: 2, status: "skipped" }),
    ];
    const tree = buildTree(rows);
    expect(isEffectivelyDone(tree[0]!)).toBe(true);

    const rowsIncomplete = [
      node({ id: "p", kind: "STEP", position: 1, status: "doing" }),
      node({ id: "c1", kind: "STEP", parentId: "p", position: 1, status: "done" }),
      node({ id: "c2", kind: "STEP", parentId: "p", position: 2, status: "todo" }),
    ];
    expect(isEffectivelyDone(buildTree(rowsIncomplete)[0]!)).toBe(false);
  });

  it("an empty GROUP is not considered done", () => {
    const rows = [node({ id: "g", kind: "GROUP", position: 1 })];
    expect(isEffectivelyDone(buildTree(rows)[0]!)).toBe(false);
  });
});
