"use client";

import { useState } from "react";
import { patchNode } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { NodeRecord, Prio } from "@/lib/client/types";

type Row = "overdue" | "today" | "week" | "none";
type Col = "high" | "med" | "low";
const ROWS: Row[] = ["overdue", "today", "week", "none"];
const COLS: Col[] = ["high", "med", "low"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function rowOf(due: string | null): Row {
  if (!due) return "none";
  const day = due.slice(0, 10);
  const today = todayISO();
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day <= addDays(6)) return "week";
  return "none";
}

function colOf(prio: Prio | null): Col {
  return prio === "high" ? "high" : prio === "med" ? "med" : "low";
}

// Dropping into a due-window row sets a representative anchor date for that
// window — a matrix cell isn't free-standing state (unlike the old
// Quadrant column), it's derived from an actual due date. See
// design_change.md decision #2. Overdue isn't a drop target: a card only
// lands there because its own due date already passed.
const ROW_ANCHOR: Partial<Record<Row, string | null>> = {
  today: todayISO(),
  week: addDays(6),
  none: null,
};

export function MatrixView({
  nodes,
  nextActionNodeId,
  slug,
  onChanged,
}: {
  nodes: NodeRecord[];
  nextActionNodeId: string | null;
  slug: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const steps = nodes.filter((n) => n.kind === "STEP" && !n.archivedAt);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);

  function moveTo(nodeId: string, row: Row, col: Col) {
    const due = ROW_ANCHOR[row];
    patchNode(slug, nodeId, { prio: col, ...(due !== undefined ? { due } : {}) }).then(onChanged);
  }

  function dropProps(row: Row, col: Col) {
    if (row === "overdue") return {};
    const key = `${row}:${col}`;
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setOverCell(key),
      onDragLeave: () => setOverCell((prev) => (prev === key ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverCell(null);
        const nodeId = e.dataTransfer.getData("text/plain");
        if (nodeId) moveTo(nodeId, row, col);
      },
    };
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 12 }}>{t("matrixRowsCols")}</p>

      <div style={{ overflowX: "auto", marginTop: "var(--space-3)" }}>
        <table className="table" style={{ tableLayout: "fixed", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: 90 }} />
              {COLS.map((c) => (
                <th key={c}>{t(`matrixCol_${c}` as DictKey)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r}>
                <td className="text-muted" style={{ fontSize: 12, verticalAlign: "top", paddingTop: "var(--space-3)" }}>
                  {t(`matrixRow_${r}` as DictKey)}
                </td>
                {COLS.map((c) => {
                  const key = `${r}:${c}`;
                  const cards = steps.filter((n) => rowOf(n.due) === r && colOf(n.prio) === c);
                  return (
                    <td
                      key={c}
                      {...dropProps(r, c)}
                      style={{
                        verticalAlign: "top",
                        padding: "var(--space-2)",
                        background: overCell === key ? "var(--ui-tint)" : undefined,
                        minHeight: 64,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {cards.map((n) => {
                          const isNext = n.id === nextActionNodeId;
                          return (
                            <div
                              key={n.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", n.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDraggingId(n.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setOverCell(null);
                              }}
                              className="card"
                              style={{
                                cursor: "grab",
                                padding: "var(--space-2)",
                                gap: 2,
                                opacity: draggingId === n.id ? 0.4 : 1,
                                boxShadow: isNext ? "0 0 0 1.5px var(--color-accent)" : undefined,
                              }}
                            >
                              {isNext && <span className="card-kicker">{t("matrixNextAction")}</span>}
                              <span style={{ fontSize: 13 }}>{n.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: "var(--space-3)" }}>{t("matrixHint")}</p>
    </div>
  );
}
