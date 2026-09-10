"use client";

import { useState } from "react";
import { patchNode } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { NodeRecord, Quadrant } from "@/lib/client/types";

const QUADRANTS: Quadrant[] = ["do_now", "schedule", "delegate", "drop"];

// A step with no quadrant yet isn't in any of the four cards, so before this
// zone existed it was simply invisible here. `null` is that state in the DB
// (prisma `quadrant Quadrant?`), and dragging back into the tray restores it
// rather than inventing a fifth quadrant value.
const PENDING = "pending" as const;
type DropZone = Quadrant | typeof PENDING;

export function QuadrantsView({
  nodes,
  nextActionNodeId,
  slug,
  onChanged,
  onSelect,
}: {
  nodes: NodeRecord[];
  nextActionNodeId: string | null;
  slug: string;
  onChanged: () => void;
  onSelect: (nodeId: string) => void;
}) {
  const { t } = useI18n();
  const steps = nodes.filter((n) => n.kind === "STEP" && !n.archivedAt);
  const pending = steps.filter((n) => n.quadrant === null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<DropZone | null>(null);

  function moveTo(nodeId: string, quadrant: Quadrant | null) {
    patchNode(slug, nodeId, { quadrant }).then(onChanged);
  }

  function dropProps(zone: DropZone) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setOverZone(zone),
      onDragLeave: () => setOverZone((prev) => (prev === zone ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverZone(null);
        const nodeId = e.dataTransfer.getData("text/plain");
        if (nodeId) moveTo(nodeId, zone === PENDING ? null : zone);
      },
    };
  }

  function renderCard(n: NodeRecord, extraStyle?: React.CSSProperties) {
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
          setOverZone(null);
        }}
        onClick={() => onSelect(n.id)}
        className="card"
        style={{
          cursor: "grab",
          padding: "var(--space-2)",
          gap: 2,
          opacity: draggingId === n.id ? 0.4 : 1,
          boxShadow: isNext ? "0 0 0 1.5px var(--color-accent)" : undefined,
          ...extraStyle,
        }}
      >
        {isNext && <span className="card-kicker">{t("matrixNextAction")}</span>}
        <span style={{ fontSize: 13 }}>{n.title}</span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 12 }}>{t("quadrantsHeader")}</p>

      <div
        {...dropProps(PENDING)}
        className="card elev-sm"
        style={{
          marginTop: "var(--space-3)",
          background: overZone === PENDING ? "var(--ui-tint)" : "var(--color-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div className="card-title">{t("quadrantsPending")}</div>
            <div className="text-muted" style={{ fontSize: 11 }}>{t("quadrantsPendingSub")}</div>
          </div>
          {pending.length > 0 && <span className="tag tag-neutral">{pending.length}</span>}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {pending.length === 0 && (
            <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{t("quadrantsPendingEmpty")}</p>
          )}
          {pending.map((n) => renderCard(n, { flex: "0 1 180px", minWidth: 140 }))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        {QUADRANTS.map((q) => {
          const cards = steps.filter((n) => n.quadrant === q);
          return (
            <div
              key={q}
              {...dropProps(q)}
              className="card elev-sm"
              style={{ minHeight: 160, background: overZone === q ? "var(--ui-tint)" : "var(--color-surface)" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div className="card-title">{t(`quadrant_${q}` as DictKey)}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{t(`quadrant_${q}_sub` as DictKey)}</div>
                </div>
                {cards.length > 0 && <span className="tag tag-neutral">{cards.length}</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                {cards.length === 0 && (
                  <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{t("quadrantsEmptyHint")}</p>
                )}
                {cards.map((n) => renderCard(n))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: "var(--space-3)" }}>{t("quadrantsHint")}</p>
    </div>
  );
}
