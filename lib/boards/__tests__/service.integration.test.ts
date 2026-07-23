import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant } from "../../db";
import { createBoard, getBoardDetail } from "../service";
import { addNode, addNote, patchNode } from "../mutations";
import { openOrCloseSession } from "../sessions";
import { revertEvent } from "../revert";
import { rebuildBoardStatuses } from "../rebuild";
import { exportBoardMarkdown, importBoardMarkdown } from "../markdown";
import { generateReport } from "../report";
import { ConflictError, NotFoundError } from "../../api/errors";

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { handle: `svc-test-${randomUUID()}`, tokenHash: `unused-${randomUUID()}` },
  });
  userId = user.id;
});

afterAll(async () => {
  await withTenant(userId, (tx) => tx.board.deleteMany({ where: { ownerId: userId } }));
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function slug() {
  return `svc-test-${randomUUID().slice(0, 8)}`;
}

async function freshBoard() {
  return createBoard(userId, {
    slug: slug(),
    type: "PROJECT",
    title: "Service test board",
    goal: "exercise the API service layer",
  });
}

describe("board + node lifecycle", () => {
  it("a new board has no nodes and no next action", async () => {
    const board = await freshBoard();
    const detail = await getBoardDetail(userId, board.slug);
    expect(detail.nodes).toEqual([]);
    expect(detail.nextAction).toBeNull();
    expect(detail.counts).toEqual({ done: 0, total: 0 });
  });

  it("addNode builds a tree with correct numbering and marks subtasks as layer-3", async () => {
    const board = await freshBoard();
    const group = await addNode(userId, board.slug, { kind: "GROUP", title: "Backend" });
    const step = await addNode(userId, board.slug, {
      kind: "STEP",
      title: "Ship the API",
      parentId: group.id,
    });
    await addNode(userId, board.slug, {
      kind: "STEP",
      title: "Write tests",
      parentId: step.id,
    });

    const { nodes } = await getBoardDetail(userId, board.slug);
    expect(nodes).toHaveLength(3);

    const events = await withTenant(userId, (tx) =>
      tx.event.findMany({ where: { boardId: nodes[0]!.boardId, type: "NODE_ADDED" } }),
    );
    expect(events).toHaveLength(3);
    const subtaskEvent = events.find((e) => (e.payload as { title: string }).title === "Write tests");
    expect((subtaskEvent?.payload as { isLayer3: boolean }).isLayer3).toBe(true);
    const topEvent = events.find((e) => (e.payload as { title: string }).title === "Ship the API");
    expect((topEvent?.payload as { isLayer3: boolean }).isLayer3).toBe(false);
  });

  it("addNode 404s when the parent doesn't belong to the board", async () => {
    const board = await freshBoard();
    await expect(
      addNode(userId, board.slug, { kind: "STEP", title: "orphan", parentId: "nonexistent" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("status transitions (TR-6, TR-7, TR-18)", () => {
  it("moving to stuck opens a Blocker in the same call; leaving stuck auto-resolves it", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "Fragile step" });

    const stuck = await patchNode(userId, board.slug, step.id, {
      status: "stuck",
      blocker: { description: "flaky CI", unblockPlan: "rerun with retries" },
    });
    expect(stuck.status).toBe("stuck");

    const openBlocker = await withTenant(userId, (tx) =>
      tx.blocker.findFirst({ where: { nodeId: step.id, resolvedAt: null } }),
    );
    expect(openBlocker?.description).toBe("flaky CI");

    await patchNode(userId, board.slug, step.id, { status: "doing" });
    const resolvedBlocker = await withTenant(userId, (tx) =>
      tx.blocker.findUnique({ where: { id: openBlocker!.id } }),
    );
    expect(resolvedBlocker?.resolvedAt).not.toBeNull();
  });

  it("TR-18: status and its STATUS_CHANGED event land in the same transaction", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    await patchNode(userId, board.slug, step.id, { status: "doing" });

    const events = await withTenant(userId, (tx) =>
      tx.event.findMany({ where: { nodeId: step.id, type: "STATUS_CHANGED" } }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ payload: { from: "todo", to: "doing" } });
  });

  it("TR-7: a second `doing` on the same board is rejected with a clean ConflictError", async () => {
    const board = await freshBoard();
    const a = await addNode(userId, board.slug, { kind: "STEP", title: "A" });
    const b = await addNode(userId, board.slug, { kind: "STEP", title: "B" });

    await patchNode(userId, board.slug, a.id, { status: "doing" });
    await expect(patchNode(userId, board.slug, b.id, { status: "doing" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("reword and attributes (TR-9, TR-10)", () => {
  it("rewording writes a NODE_REWORDED event carrying the reason", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "Old title" });
    await patchNode(userId, board.slug, step.id, { title: "New title", reason: "scope clarified" });

    const events = await withTenant(userId, (tx) =>
      tx.event.findMany({ where: { nodeId: step.id, type: "NODE_REWORDED" } }),
    );
    expect(events[0]).toMatchObject({
      payload: { from: "Old title", to: "New title", reason: "scope clarified" },
    });
  });

  it("setting due/prio/owner activates the corresponding column and stays sticky", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    await patchNode(userId, board.slug, step.id, { prio: "high", owner: "jayci" });

    let current = await withTenant(userId, (tx) => tx.board.findUniqueOrThrow({ where: { id: board.id } }));
    expect(current.activeColumns.sort()).toEqual(["owner", "prio"]);

    // Clearing owner later must NOT deactivate the column (TR-9: sticky).
    await patchNode(userId, board.slug, step.id, { owner: null });
    current = await withTenant(userId, (tx) => tx.board.findUniqueOrThrow({ where: { id: board.id } }));
    expect(current.activeColumns).toContain("owner");
  });

  it("cutting a node archives it and removes it from the active tree; restoring brings it back", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "Doomed step" });
    await patchNode(userId, board.slug, step.id, { archived: true, reason: "descoped" });

    let detail = await getBoardDetail(userId, board.slug);
    expect(detail.nodes).toHaveLength(0);

    await patchNode(userId, board.slug, step.id, { archived: false });
    detail = await getBoardDetail(userId, board.slug);
    expect(detail.nodes).toHaveLength(1);
  });
});

describe("owner-assigned steps and next action (FR-20, TR-5)", () => {
  it("an owner-assigned step is excluded from next action", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "Delegated" });
    await patchNode(userId, board.slug, step.id, { owner: "jayci" });

    const detail = await getBoardDetail(userId, board.slug);
    expect(detail.nextAction).toBeNull();
  });
});

describe("notes", () => {
  it("addNote emits a NOTE_ADDED event", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    const event = await addNote(userId, board.slug, step.id, { body: "went with approach X" });
    expect(event.type).toBe("NOTE_ADDED");
    expect((event.payload as { body: string }).body).toBe("went with approach X");
  });
});

describe("sessions (FR-5)", () => {
  it("open increments seq; opening again auto-closes the previous one", async () => {
    const board = await freshBoard();
    const first = await openOrCloseSession(userId, board.slug, { action: "open" });
    expect(first.seq).toBe(1);

    const second = await openOrCloseSession(userId, board.slug, { action: "open" });
    expect(second.seq).toBe(2);

    const closedFirst = await withTenant(userId, (tx) => tx.session.findUniqueOrThrow({ where: { id: first.id } }));
    expect(closedFirst.endedAt).not.toBeNull();
  });

  it("close fails cleanly when there's no open session", async () => {
    const board = await freshBoard();
    await expect(openOrCloseSession(userId, board.slug, { action: "close" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("revert (TR-20)", () => {
  it("reverts a status change, restores state, and marks the original reverted", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    await patchNode(userId, board.slug, step.id, { status: "doing" });

    const original = await withTenant(userId, (tx) =>
      tx.event.findFirstOrThrow({ where: { nodeId: step.id, type: "STATUS_CHANGED" } }),
    );
    const compensating = await revertEvent(userId, board.slug, original.id);
    expect(compensating.payload).toMatchObject({ from: "doing", to: "todo" });

    const restoredEvent = await withTenant(userId, (tx) => tx.event.findUniqueOrThrow({ where: { id: original.id } }));
    expect(restoredEvent.revertedBy).toBe(compensating.id);

    const node = await withTenant(userId, (tx) => tx.node.findUniqueOrThrow({ where: { id: step.id } }));
    expect(node.status).toBe("todo");
  });

  it("refuses to revert the same event twice", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    await patchNode(userId, board.slug, step.id, { status: "doing" });
    const original = await withTenant(userId, (tx) =>
      tx.event.findFirstOrThrow({ where: { nodeId: step.id, type: "STATUS_CHANGED" } }),
    );

    await revertEvent(userId, board.slug, original.id);
    await expect(revertEvent(userId, board.slug, original.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to revert event types with no defined inverse", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    const note = await addNote(userId, board.slug, step.id, { body: "a note" });
    await expect(revertEvent(userId, board.slug, note.id)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("status rebuild job (TR-22)", () => {
  it("detects and repairs a Node.status that has drifted from its event log", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    await patchNode(userId, board.slug, step.id, { status: "doing" });

    // Simulate drift directly, bypassing the normal mutation path — the
    // scenario TR-22's rebuild job exists to catch and fix.
    await withTenant(userId, (tx) => tx.node.update({ where: { id: step.id }, data: { status: "done" } }));

    const mismatches = await rebuildBoardStatuses(userId, board.slug);
    expect(mismatches).toEqual([{ nodeId: step.id, stored: "done", rebuilt: "doing" }]);

    const fixed = await withTenant(userId, (tx) => tx.node.findUniqueOrThrow({ where: { id: step.id } }));
    expect(fixed.status).toBe("doing");
  });

  it("reports no mismatches on a board whose status column is already honest", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "A step" });
    await patchNode(userId, board.slug, step.id, { status: "doing" });
    expect(await rebuildBoardStatuses(userId, board.slug)).toEqual([]);
  });
});

describe("markdown export/import (TR-4, FR-1)", () => {
  it("exports a board with a step, a blocker, and a waiting-on item", async () => {
    const board = await freshBoard();
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "Exportable step" });
    await patchNode(userId, board.slug, step.id, {
      status: "stuck",
      blocker: { description: "waiting on design", unblockPlan: "ping design" },
    });
    const waiting = await addNode(userId, board.slug, { kind: "STEP", title: "Delegated step" });
    await patchNode(userId, board.slug, waiting.id, { owner: "jayci" });

    const markdown = await exportBoardMarkdown(userId, board.slug);
    expect(markdown).toContain("Exportable step");
    expect(markdown).toContain("waiting on design");
    expect(markdown).toContain("## Waiting on");
    expect(markdown).toContain("(jayci)");
  });

  it("imports markdown into a brand-new board", async () => {
    const targetSlug = slug();
    const markdown = [
      "# Imported board",
      "",
      "- Goal: prove import works",
      "- Type: project",
      "- Sessions: 0",
      "",
      "## Board",
      "",
      "1. [ ] First imported step",
      "   1.1. [x] Imported subtask",
      "2. [~] Second imported step",
      "",
    ].join("\n");

    const result = await importBoardMarkdown(userId, targetSlug, markdown);
    expect(result.warnings).toEqual([]);

    const detail = await getBoardDetail(userId, targetSlug);
    expect(detail.board.title).toBe("Imported board");
    expect(detail.nodes.map((n) => n.title).sort()).toEqual(
      ["First imported step", "Imported subtask", "Second imported step"].sort(),
    );
  });

  it("re-importing to the same slug replaces the tree rather than duplicating it", async () => {
    const targetSlug = slug();
    const v1 = "# Board\n\n- Goal: v1\n- Type: project\n- Sessions: 0\n\n## Board\n\n1. [ ] Only step\n";
    await importBoardMarkdown(userId, targetSlug, v1);

    const v2 = "# Board\n\n- Goal: v2\n- Type: project\n- Sessions: 0\n\n## Board\n\n1. [ ] Replaced step\n";
    await importBoardMarkdown(userId, targetSlug, v2);

    const detail = await getBoardDetail(userId, targetSlug);
    expect(detail.board.goal).toBe("v2");
    expect(detail.nodes.map((n) => n.title)).toEqual(["Replaced step"]);
  });
});

describe("report generation (FR-15, TR-11)", () => {
  it("fails cleanly when there's no session to report on", async () => {
    const board = await freshBoard();
    await expect(generateReport(userId, board.slug)).rejects.toBeInstanceOf(ConflictError);
  });

  it("generates a report reflecting this session's activity and omits empty sections", async () => {
    const board = await freshBoard();
    await openOrCloseSession(userId, board.slug, { action: "open" });
    const step = await addNode(userId, board.slug, { kind: "STEP", title: "Reported step" });
    await patchNode(userId, board.slug, step.id, { status: "doing" });
    await patchNode(userId, board.slug, step.id, { status: "done" });

    const report = await generateReport(userId, board.slug);
    expect(report.body).toContain("Reported step");
    expect(report.body).toContain("## Completed");
    expect(report.body).not.toContain("## Blockers");
    expect(report.body).not.toContain("## Waiting on");
  });
});
