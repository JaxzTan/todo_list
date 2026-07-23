import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/parse";
import { serializeToMarkdown } from "../src/serialize";
import { isGroupNode, isStepNode } from "../src/types";

function fixture(name: string): string {
  const path = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return readFileSync(path, "utf-8");
}

describe("golden files — well-formed boards", () => {
  it("parses a simple project board with subtasks and a blocker", () => {
    const { board, warnings, unparsed } = parseMarkdown(fixture("simple-project.md"));

    expect(warnings).toEqual([]);
    expect(unparsed).toBeNull();
    expect(board.title).toBe("Ludo Clash");
    expect(board.type).toBe("project");
    expect(board.sessions).toBe(3);
    expect(board.nodes).toHaveLength(4);

    const step2 = board.nodes[1];
    if (!step2 || !isStepNode(step2)) throw new Error("expected step 2");
    expect(step2.status).toBe("doing");
    expect(step2.doneCondition).toBe(
      "move resolver rejects illegal moves and broadcasts the resulting state",
    );
    expect(step2.children).toHaveLength(2);
    expect(step2.children[0]?.status).toBe("done");

    expect(board.blockers).toEqual([
      {
        stepNumber: "3",
        description: "Prisma migration fails on enum rename",
        unblockPlan: "drop and recreate the enum in a manual migration",
      },
    ]);
  });

  it("is stable under parse -> serialize -> parse", () => {
    const original = parseMarkdown(fixture("simple-project.md")).board;
    const reserialized = serializeToMarkdown(original);
    const reparsed = parseMarkdown(reserialized);
    expect(reparsed.warnings).toEqual([]);
    expect(reparsed.board).toEqual(original);
  });

  it("parses a day board with groups, optional columns, and every section", () => {
    const { board, warnings } = parseMarkdown(fixture("day-board.md"));

    // "CUT 4" legitimately references a step that no longer exists in the
    // current tree — that's what CUT means — so it can't resolve, and the
    // one expected warning says so rather than silently swallowing it.
    expect(warnings).toEqual(['scope change references unknown step "4"']);
    expect(board.type).toBe("day");
    expect(board.dateKey).toBe("2026-07-23");
    expect(board.deadline).toBe("2026-07-24");
    expect(board.activeColumns).toEqual(["due", "prio", "owner"]);
    expect(board.nodes).toHaveLength(2);

    const [execBoardGroup, householdGroup] = board.nodes;
    if (!execBoardGroup || !isGroupNode(execBoardGroup)) throw new Error("expected a group");
    expect(execBoardGroup.title).toBe("Exec Board");
    expect(execBoardGroup.children).toHaveLength(2);
    expect(execBoardGroup.children[0]?.prio).toBe("high");
    expect(execBoardGroup.children[0]?.owner).toBe("jaxz");

    if (!householdGroup || !isGroupNode(householdGroup)) throw new Error("expected a group");
    expect(householdGroup.children[0]?.owner).toBe("jayci");

    expect(board.scopeChanges).toEqual([
      {
        kind: "CUT",
        stepNumber: "4",
        reason: "dropped the FR-7 two-doing escape hatch per the TRD's own recommendation",
      },
    ]);
    expect(board.waiting).toEqual([
      { stepNumber: "3", owner: "jayci", text: "needs the billing details for the reserved domain" },
    ]);
  });
});

describe("golden files — hand-mangled board (NFR-7 graceful degradation)", () => {
  it("never throws, and recovers every well-formed line around the damage", () => {
    const { board, warnings, unparsed } = parseMarkdown(fixture("mangled.md"));

    expect(board.title).toBe("Half-broken board");
    expect(board.sessions).toBe(2);

    // Every structurally valid step still parses, despite the damage around it.
    expect(board.nodes.filter(isStepNode).map((n) => n.title)).toEqual([
      "A step that parsed fine",
      "A step nested way too deep with no real parent",
      "Another fine step",
    ]);

    expect(warnings.length).toBeGreaterThan(0);
    expect(unparsed).not.toBeNull();
    expect(unparsed).toContain("this line is garbage and does not belong here");
    expect(unparsed).toContain("## Random Junk");

    // The reference to a step that doesn't exist is kept, not silently dropped.
    expect(board.notes).toContainEqual({
      stepNumber: "99",
      body: "this note points at a step that does not exist",
    });
    expect(warnings.some((w) => w.includes('unknown step "99"'))).toBe(true);
  });

  it("re-serializing the recovered board produces a clean, fully re-parseable file", () => {
    const first = parseMarkdown(fixture("mangled.md")).board;
    const markdown = serializeToMarkdown(first);
    const second = parseMarkdown(markdown);

    // The regenerated file carries no scars from the original damage.
    expect(second.warnings.some((w) => w.includes('unknown step "99"'))).toBe(true);
    expect(second.unparsed).toBeNull();
    expect(second.board).toEqual(first);
  });
});
