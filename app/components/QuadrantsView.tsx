"use client";

import { useState } from "react";
import { patchNode } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { NodeRecord, Quadrant } from "@/lib/client/types";

const QUADRANTS: Quadrant[] = ["do_now", "schedule", "delegate", "drop"];

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overQuadrant, setOverQuadrant] = useState<Quadrant | null>(null);

  function moveTo(nodeId: string, quadrant: Quadrant) {
    patchNode(slug, nodeId, { quadrant }).then(onChanged);
  }

  function dropProps(quadrant: Quadrant) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setOverQuadrant(quadrant),
      onDragLeave: () => setOverQuadrant((prev) => (prev === quadrant ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverQuadrant(null);
        const nodeId = e.dataTransfer.getData("text/plain");
        if (nodeId) moveTo(nodeId, quadrant);
      },
    };
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 12 }}>{t("quadrantsHeader")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        {QUADRANTS.map((q) => {
          const cards = steps.filter((n) => n.quadrant === q);
          return (
            <div
              key={q}
              {...dropProps(q)}
              className="card elev-sm"
              style={{ minHeight: 160, background: overQuadrant === q ? "var(--ui-tint)" : "var(--color-surface)" }}
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
                        setOverQuadrant(null);
                      }}
                      onClick={() => onSelect(n.id)}
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
            </div>
          );
        })}
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: "var(--space-3)" }}>{t("quadrantsHint")}</p>
    </div>
  );
}
