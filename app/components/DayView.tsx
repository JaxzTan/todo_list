"use client";

import { useMemo, useState } from "react";
import { patchNode } from "@/lib/client/mutations";
import { useI18n } from "@/lib/client/i18n";
import type { NodeRecord } from "@/lib/client/types";

// Matches the wireframe's planning window — a lunch-hour gap between 11:00
// and 13:00 is intentional, not a missing row.
const HOURS = [9, 10, 11, 13, 14, 15, 16, 17];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(d: Date): string {
  return isoDate(d).slice(5);
}

function kindLabel(node: NodeRecord, byId: Map<string, NodeRecord>, t: (k: "dayKindPhase" | "dayKindTask" | "dayKindSubtask") => string): string {
  if (node.kind === "GROUP") return t("dayKindPhase");
  const parent = node.parentId ? byId.get(node.parentId) : null;
  if (parent && parent.kind === "STEP") return t("dayKindSubtask");
  return t("dayKindTask");
}

export function DayView({
  nodes,
  numbers,
  slug,
  onChanged,
}: {
  nodes: NodeRecord[];
  numbers: Map<string, string>;
  slug: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overHour, setOverHour] = useState<number | null>(null);
  const [overUnscheduled, setOverUnscheduled] = useState(false);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const items = useMemo(() => nodes.filter((n) => !n.archivedAt), [nodes]);
  const dates = useMemo(() => {
    const today = new Date();
    return [-1, 0, 1].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d;
    });
  }, []);

  function scheduledAtFor(hour: number): string {
    const parts = selectedDate.split("-").map(Number);
    const [y, m, d] = [parts[0] ?? 1970, parts[1] ?? 1, parts[2] ?? 1];
    return new Date(y, m - 1, d, hour, 0, 0, 0).toISOString();
  }

  function moveToHour(nodeId: string, hour: number) {
    patchNode(slug, nodeId, { scheduledAt: scheduledAtFor(hour) }).then(onChanged);
  }

  function unschedule(nodeId: string) {
    patchNode(slug, nodeId, { scheduledAt: null }).then(onChanged);
  }

  function cardDragProps(nodeId: string) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", nodeId);
        e.dataTransfer.effectAllowed = "move";
        setDraggingId(nodeId);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setOverHour(null);
        setOverUnscheduled(false);
      },
    };
  }

  function hourDropProps(hour: number) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setOverHour(hour),
      onDragLeave: () => setOverHour((prev) => (prev === hour ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverHour(null);
        const nodeId = e.dataTransfer.getData("text/plain");
        if (nodeId) moveToHour(nodeId, hour);
      },
    };
  }

  const unscheduledDropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDragEnter: () => setOverUnscheduled(true),
    onDragLeave: () => setOverUnscheduled(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOverUnscheduled(false);
      const nodeId = e.dataTransfer.getData("text/plain");
      if (nodeId) unschedule(nodeId);
    },
  };

  const unscheduled = items.filter((n) => n.scheduledAt === null);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{t("dayPlanTitle")}</h2>
        <div className="seg">
          {dates.map((d) => {
            const key = isoDate(d);
            return (
              <button key={key} type="button" aria-pressed={selectedDate === key} onClick={() => setSelectedDate(key)} className="seg-opt">
                {shortLabel(d)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--space-4)", marginTop: "var(--space-4)", alignItems: "start" }}>
        <table className="table" style={{ tableLayout: "fixed" }}>
          <tbody>
            {HOURS.map((hour) => {
              const cards = items.filter((n) => {
                if (!n.scheduledAt) return false;
                const at = new Date(n.scheduledAt);
                return isoDate(at) === selectedDate && at.getHours() === hour;
              });
              return (
                <tr key={hour}>
                  <td className="text-muted" style={{ width: 64, verticalAlign: "top", paddingTop: "var(--space-3)" }}>
                    {String(hour).padStart(2, "0")}:00
                  </td>
                  <td
                    {...hourDropProps(hour)}
                    style={{ verticalAlign: "top", padding: "var(--space-2)", minHeight: 48, background: overHour === hour ? "var(--ui-tint)" : undefined }}
                  >
                    {cards.length === 0 ? (
                      <span className="text-muted" style={{ fontSize: 12 }}>{t("dayDropHour")}</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {cards.map((n) => (
                          <div
                            key={n.id}
                            {...cardDragProps(n.id)}
                            className="card"
                            style={{ cursor: "grab", padding: "var(--space-2)", gap: 2, opacity: draggingId === n.id ? 0.4 : 1 }}
                          >
                            <span style={{ fontSize: 13 }}>
                              {numbers.get(n.id) ? `${numbers.get(n.id)} ` : ""}
                              {n.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div {...unscheduledDropProps} className="card elev-sm" style={{ background: overUnscheduled ? "var(--ui-tint)" : "var(--color-surface)" }}>
          <h6 style={{ margin: 0 }}>{t("dayUnscheduled")}</h6>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            {unscheduled.map((n) => (
              <div
                key={n.id}
                {...cardDragProps(n.id)}
                className="card"
                style={{ cursor: "grab", padding: "var(--space-2)", gap: 2, opacity: draggingId === n.id ? 0.4 : 1 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="text-muted" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{numbers.get(n.id) ?? ""}</span>
                  <span className="tag tag-neutral">{kindLabel(n, byId, t)}</span>
                </div>
                <span style={{ fontSize: 13 }}>{n.title}</span>
              </div>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: 11, marginTop: "var(--space-3)", marginBottom: 0 }}>{t("dayClearHint")}</p>
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: "var(--space-3)" }}>{t("dayDropHint")}</p>
    </div>
  );
}
