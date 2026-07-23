import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseMarkdown } from "../src/parse";
import { serializeToMarkdown } from "../src/serialize";
import type {
  BoardNode,
  BoardType,
  CanonicalBoard,
  GroupNode,
  Prio,
  Quadrant,
  StepNode,
  StepStatus,
} from "../src/types";
import { FORMAT_VERSION } from "../src/types";

const wordArb = fc
  .array(
    fc.constantFrom(
      ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""),
    ),
    { minLength: 1, maxLength: 8 },
  )
  .map((cs) => cs.join(""));

const textArb = fc
  .array(wordArb, { minLength: 1, maxLength: 4 })
  .map((ws) => ws.join(" "));

const dateArb = fc
  .tuple(
    fc.integer({ min: 2024, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

const statusArb = fc.constantFrom<StepStatus>("todo", "doing", "stuck", "done", "skipped");
const prioArb = fc.constantFrom<Prio>("high", "med", "low");
const quadrantArb = fc.constantFrom<Quadrant>("do_now", "schedule", "delegate", "drop");
const numberRefArb = fc
  .array(fc.integer({ min: 1, max: 9 }), { minLength: 1, maxLength: 3 })
  .map((parts) => parts.join("."));

function stepArb(depth: number): fc.Arbitrary<StepNode> {
  return fc.record<StepNode>({
    kind: fc.constant("STEP"),
    title: textArb,
    status: statusArb,
    doneCondition: fc.option(textArb, { nil: undefined }),
    due: fc.option(dateArb, { nil: undefined }),
    prio: fc.option(prioArb, { nil: undefined }),
    owner: fc.option(wordArb, { nil: undefined }),
    quadrant: fc.option(quadrantArb, { nil: undefined }),
    children: depth > 0 ? fc.array(stepArb(depth - 1), { maxLength: 2 }) : fc.constant([]),
  });
}

const groupArb: fc.Arbitrary<GroupNode> = fc.record<GroupNode>({
  kind: fc.constant("GROUP"),
  title: textArb,
  children: fc.array(stepArb(1), { maxLength: 3 }),
});

// Bare root steps must precede any group — see the grammar note in parse.ts.
const nodesArb: fc.Arbitrary<BoardNode[]> = fc
  .tuple(fc.array(stepArb(2), { maxLength: 3 }), fc.array(groupArb, { maxLength: 2 }))
  .map(([steps, groups]) => [...steps, ...groups]);

const blockerArb = fc.record({
  stepNumber: numberRefArb,
  description: textArb,
  unblockPlan: fc.option(textArb, { nil: undefined }),
});

const scopeChangeArb = fc.record({
  kind: fc.constantFrom("ADD" as const, "CUT" as const, "REWORD" as const),
  stepNumber: numberRefArb,
  reason: textArb,
});

const noteArb = fc.record({ stepNumber: numberRefArb, body: textArb });

const waitingArb = fc.record({ stepNumber: numberRefArb, owner: wordArb, text: textArb });

const boardArb: fc.Arbitrary<CanonicalBoard> = fc.record<CanonicalBoard>({
  formatVersion: fc.constant(FORMAT_VERSION),
  title: textArb,
  goal: textArb,
  type: fc.constantFrom<BoardType>("project", "day"),
  sessions: fc.nat({ max: 50 }),
  dateKey: fc.option(dateArb, { nil: undefined }),
  deadline: fc.option(dateArb, { nil: undefined }),
  activeColumns: fc.subarray(["due", "prio", "owner"] as const),
  nodes: nodesArb,
  blockers: fc.array(blockerArb, { maxLength: 3 }),
  scopeChanges: fc.array(scopeChangeArb, { maxLength: 3 }),
  notes: fc.array(noteArb, { maxLength: 3 }),
  waiting: fc.array(waitingArb, { maxLength: 3 }),
});

describe("board-codec round-trip", () => {
  it("serialize -> parse reproduces the original board", () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        const markdown = serializeToMarkdown(board);
        const result = parseMarkdown(markdown);
        expect(result.board).toEqual(board);
        expect(result.unparsed).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it("parse -> serialize -> parse is idempotent on its own output", () => {
    fc.assert(
      fc.property(boardArb, (board) => {
        const first = serializeToMarkdown(board);
        const reparsed = parseMarkdown(first).board;
        const second = serializeToMarkdown(reparsed);
        expect(second).toBe(first);
      }),
      { numRuns: 100 },
    );
  });
});
