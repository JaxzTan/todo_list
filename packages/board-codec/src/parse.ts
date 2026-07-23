import type {
  BoardNote,
  BoardScopeChange,
  BoardWaitingItem,
  BoardBlocker,
  BoardType,
  CanonicalBoard,
  ParseResult,
  Prio,
  Quadrant,
  StepNode,
  StepStatus,
} from "./types";
import { FORMAT_VERSION } from "./types";
import { buildNumberMap } from "./numbering";

const STATUS_FROM_MARK: Record<string, StepStatus> = {
  " ": "todo",
  "~": "doing",
  "!": "stuck",
  x: "done",
  X: "done",
  "-": "skipped",
};

const HEADING_RE = /^##\s+(.+?)\s*$/;
const GROUP_RE = /^###\s+(.+?)\s*$/;
const STEP_RE =
  /^(\s*)([0-9]+(?:\.[0-9]+)*)\.\s*\[(.)\]\s*([^`]+?)(?:\s*`([^`]*)`)?\s*$/;
const DONE_RE = /^\s*>\s*done:\s*(.+?)\s*$/i;
const BLOCKER_RE = /^-\s*([0-9]+(?:\.[0-9]+)*)\s*:\s*(.+?)(?:\s*—\s*unblock:\s*(.+))?$/;
const SCOPE_RE = /^-\s*(ADD|CUT|REWORD)\s+([0-9]+(?:\.[0-9]+)*)\s*—\s*(.+)$/;
const NOTE_RE = /^-\s*([0-9]+(?:\.[0-9]+)*)\s*:\s*(.+)$/;
const WAITING_RE = /^-\s*([0-9]+(?:\.[0-9]+)*)\s*\((.+?)\)\s*—\s*(.+)$/;

class Collector {
  warnings: string[] = [];
  unparsedLines: string[] = [];

  warn(message: string) {
    this.warnings.push(message);
  }

  dropLine(line: string, reason: string) {
    this.unparsedLines.push(line);
    this.warn(`${reason}: ${JSON.stringify(line)}`);
  }
}

function parseMetadata(raw: string | undefined): {
  due?: string;
  prio?: Prio;
  owner?: string;
  quadrant?: Quadrant;
} {
  const out: { due?: string; prio?: Prio; owner?: string; quadrant?: Quadrant } = {};
  if (!raw) return out;
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const [key, ...rest] = token.split(":");
    const value = rest.join(":");
    if (key === "due" && value) out.due = value;
    else if (key === "prio" && (value === "high" || value === "med" || value === "low")) {
      out.prio = value;
    } else if (key === "owner" && value) out.owner = value;
    else if (
      key === "q" &&
      (value === "do_now" || value === "schedule" || value === "delegate" || value === "drop")
    ) {
      out.quadrant = value;
    }
  }
  return out;
}

function depthFromIndent(indent: string): number {
  return Math.max(0, Math.round(indent.length / 3));
}

// Grammar note: a `###` group heading stays active for every bare step
// that follows until the next `###` (or end of section) — there is no
// "exit group" marker. Boards therefore keep all ungrouped root steps
// before the first group; a bare step written after a group has started
// attaches to that group, with a warning, rather than being lost.
function parseBoardSection(bodyLines: string[], collector: Collector) {
  const roots: (StepNode | { kind: "GROUP"; title: string; children: StepNode[] })[] = [];
  let currentGroup: { kind: "GROUP"; title: string; children: StepNode[] } | null = null;
  const stack: StepNode[] = []; // stack[d] = last step seen at depth d

  function attach(step: StepNode, depth: number) {
    stack.length = depth; // trim deeper stale entries
    if (depth === 0) {
      if (currentGroup) currentGroup.children.push(step);
      else roots.push(step);
    } else {
      const parent = stack[depth - 1];
      if (parent) {
        parent.children.push(step);
      } else {
        // Skipped a nesting level (malformed indentation) — attach at root, don't throw.
        collector.warn(`step nested without a parent at depth ${depth}, attached at top level: ${JSON.stringify(step.title)}`);
        if (currentGroup) currentGroup.children.push(step);
        else roots.push(step);
      }
    }
    stack[depth] = step;
  }

  let lastStep: StepNode | null = null;

  for (const line of bodyLines) {
    if (line.trim() === "") continue;

    const groupMatch = GROUP_RE.exec(line);
    if (groupMatch) {
      currentGroup = { kind: "GROUP", title: groupMatch[1]!, children: [] };
      roots.push(currentGroup);
      stack.length = 0;
      lastStep = null;
      continue;
    }

    const doneMatch = DONE_RE.exec(line);
    if (doneMatch) {
      if (lastStep) lastStep.doneCondition = doneMatch[1];
      else collector.dropLine(line, "done-condition line with no preceding step");
      continue;
    }

    const stepMatch = STEP_RE.exec(line);
    if (stepMatch) {
      const [, indent, , markRaw, titleRaw, metaRaw] = stepMatch;
      const status = STATUS_FROM_MARK[markRaw!];
      if (!status) {
        collector.dropLine(line, `unrecognized status marker "[${markRaw}]"`);
        continue;
      }
      const meta = parseMetadata(metaRaw);
      const step: StepNode = {
        kind: "STEP",
        title: titleRaw!.trim(),
        status,
        children: [],
        ...meta,
      };
      attach(step, depthFromIndent(indent!));
      lastStep = step;
      continue;
    }

    collector.dropLine(line, "unrecognized line in Board section");
  }

  return roots;
}

function parseBlockers(bodyLines: string[], collector: Collector): BoardBlocker[] {
  const out: BoardBlocker[] = [];
  for (const line of bodyLines) {
    if (line.trim() === "") continue;
    const m = BLOCKER_RE.exec(line);
    if (!m) {
      collector.dropLine(line, "unrecognized line in Blockers section");
      continue;
    }
    out.push({
      stepNumber: m[1]!,
      description: m[2]!.trim(),
      unblockPlan: m[3]?.trim(),
    });
  }
  return out;
}

function parseScopeChanges(bodyLines: string[], collector: Collector): BoardScopeChange[] {
  const out: BoardScopeChange[] = [];
  for (const line of bodyLines) {
    if (line.trim() === "") continue;
    const m = SCOPE_RE.exec(line);
    if (!m) {
      collector.dropLine(line, "unrecognized line in Scope changes section");
      continue;
    }
    out.push({
      kind: m[1] as BoardScopeChange["kind"],
      stepNumber: m[2]!,
      reason: m[3]!.trim(),
    });
  }
  return out;
}

function parseNotes(bodyLines: string[], collector: Collector): BoardNote[] {
  const out: BoardNote[] = [];
  for (const line of bodyLines) {
    if (line.trim() === "") continue;
    const m = NOTE_RE.exec(line);
    if (!m) {
      collector.dropLine(line, "unrecognized line in Notes section");
      continue;
    }
    out.push({ stepNumber: m[1]!, body: m[2]!.trim() });
  }
  return out;
}

function parseWaiting(bodyLines: string[], collector: Collector): BoardWaitingItem[] {
  const out: BoardWaitingItem[] = [];
  for (const line of bodyLines) {
    if (line.trim() === "") continue;
    const m = WAITING_RE.exec(line);
    if (!m) {
      collector.dropLine(line, "unrecognized line in Waiting on section");
      continue;
    }
    out.push({ stepNumber: m[1]!, owner: m[2]!.trim(), text: m[3]!.trim() });
  }
  return out;
}

export function parseMarkdown(markdown: string): ParseResult {
  const collector = new Collector();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  let title = "";
  if (i < lines.length && lines[i]!.startsWith("# ")) {
    title = lines[i]!.slice(2).trim();
    i += 1;
  } else {
    collector.warn("missing title (# heading); defaulting to \"Untitled\"");
    title = "Untitled";
  }

  const header: Record<string, string> = {};
  while (i < lines.length && !HEADING_RE.test(lines[i]!)) {
    const line = lines[i]!;
    i += 1;
    if (line.trim() === "") continue;
    const m = /^-\s*([A-Za-z]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      collector.dropLine(line, "unrecognized header line");
      continue;
    }
    header[m[1]!.toLowerCase()] = m[2]!.trim();
  }

  let type: BoardType = "project";
  if (header.type === "project" || header.type === "day") {
    type = header.type;
  } else if (header.type) {
    collector.warn(`unrecognized Type "${header.type}", defaulting to "project"`);
  } else {
    collector.warn('missing Type header, defaulting to "project"');
  }

  let sessions = 0;
  if (header.sessions !== undefined) {
    const parsed = Number.parseInt(header.sessions, 10);
    if (Number.isFinite(parsed)) sessions = parsed;
    else collector.warn(`unparseable Sessions value "${header.sessions}", defaulting to 0`);
  }

  if (header.goal === undefined) {
    collector.warn("missing Goal header");
  }

  const activeColumns = (header.columns ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is "due" | "prio" | "owner" => s === "due" || s === "prio" || s === "owner");

  // Split remaining lines into ## sections.
  const sections: { heading: string; rawHeading: string; body: string[] }[] = [];
  let current: { heading: string; rawHeading: string; body: string[] } | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1]!.trim().toLowerCase(), rawHeading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    } else if (line.trim() !== "") {
      collector.dropLine(line, "content before any ## section");
    }
  }
  if (current) sections.push(current);

  const board: CanonicalBoard = {
    formatVersion: FORMAT_VERSION,
    title,
    goal: header.goal ?? "",
    type,
    sessions,
    deadline: header.deadline || undefined,
    dateKey: header.date || undefined,
    activeColumns,
    nodes: [],
    blockers: [],
    scopeChanges: [],
    notes: [],
    waiting: [],
  };

  for (const section of sections) {
    switch (section.heading) {
      case "board":
        board.nodes = parseBoardSection(section.body, collector);
        break;
      case "blockers":
        board.blockers = parseBlockers(section.body, collector);
        break;
      case "scope changes":
        board.scopeChanges = parseScopeChanges(section.body, collector);
        break;
      case "notes":
        board.notes = parseNotes(section.body, collector);
        break;
      case "waiting on":
        board.waiting = parseWaiting(section.body, collector);
        break;
      default:
        collector.warn(`unrecognized section: "${section.rawHeading}"`);
        collector.unparsedLines.push(section.rawHeading, ...section.body);
    }
  }

  // Leniency validation: cross-references that don't resolve to a real step
  // are kept (not discarded) but flagged, since a future edit may fix them.
  const numberMap = buildNumberMap(board.nodes);
  for (const b of board.blockers) {
    if (!numberMap.has(b.stepNumber)) {
      collector.warn(`blocker references unknown step "${b.stepNumber}"`);
    }
  }
  for (const s of board.scopeChanges) {
    if (!numberMap.has(s.stepNumber)) {
      collector.warn(`scope change references unknown step "${s.stepNumber}"`);
    }
  }
  for (const n of board.notes) {
    if (!numberMap.has(n.stepNumber)) {
      collector.warn(`note references unknown step "${n.stepNumber}"`);
    }
  }
  for (const w of board.waiting) {
    if (!numberMap.has(w.stepNumber)) {
      collector.warn(`waiting-on item references unknown step "${w.stepNumber}"`);
    }
  }

  return {
    board,
    unparsed: collector.unparsedLines.length > 0 ? collector.unparsedLines.join("\n") : null,
    warnings: collector.warnings,
  };
}
