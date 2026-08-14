import type { EventRecord } from "./types";

/** node/step titles for a "→" style summary line, keyed by node id. */
export type NumberLookup = Map<string, string>;

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/**
 * Renders an event as a single wireframe-style line, e.g.
 * "2.2 To do → Done" or "2.3 rewritten — "why"". Falls back to the raw type
 * for event shapes this doesn't specifically know (SESSION_*).
 */
export function summarizeEvent(event: EventRecord, numbers: NumberLookup): string {
  const number = event.nodeId ? (numbers.get(event.nodeId) ?? "?") : "?";
  const p = event.payload as Record<string, unknown>;

  switch (event.type) {
    case "STATUS_CHANGED":
      return `${number} ${fmt(p.from)} → ${fmt(p.to)}`;
    case "ATTR_SET": {
      const changes = Object.entries(p).filter(([, v]) => typeof v === "object" && v !== null);
      const parts = changes.map(([field, v]) => {
        const { from, to } = v as { from: unknown; to: unknown };
        return `${field}: ${fmt(from)} → ${fmt(to)}`;
      });
      return `${number} ${parts.join(", ")}`;
    }
    case "NODE_REWORDED":
      return `${number} renamed "${fmt(p.from)}" → "${fmt(p.to)}"`;
    case "NODE_ADDED":
      return `${number} added — "${fmt(p.title)}"`;
    case "NODE_CUT":
      return `${number} cut — ${fmt(p.reason)}`;
    case "NOTE_ADDED":
      return `${number} note — "${fmt(p.body)}"`;
    case "BLOCKER_OPENED":
      return `${number} blocked — ${fmt(p.description)}`;
    case "BLOCKER_RESOLVED":
      return `${number} unblocked`;
    case "SESSION_OPENED":
      return "session opened";
    case "SESSION_CLOSED":
      return "session closed";
    default:
      return `${number} ${event.type}`;
  }
}
