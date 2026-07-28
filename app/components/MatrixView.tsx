"use client";

import { useState } from "react";
import { patchNode } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { NodeRecord, Quadrant } from "@/lib/client/types";

const QUADRANTS: Quadrant[] = ["do_now", "schedule", "delegate", "drop"];
const NEXT: Record<Quadrant, Quadrant> = {
  do_now: "schedule",
  schedule: "delegate",
  delegate: "drop",
  drop: "do_now",
};

// Slot used for the "unplaced" tray, alongside the four real quadrants — a
// drop target that clears quadrant back to null.
type Slot = Quadrant | "unplaced";

export function MatrixView({ nodes, slug, onChanged }: { nodes: NodeRecord[]; slug: string; onChanged: () => void }) {
  const { t } = useI18n();
  const steps = nodes.filter((n) => n.kind === "STEP" && !n.archivedAt);
  const unplaced = steps.filter((n) => !n.quadrant);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<Slot | null>(null);

  function moveTo(nodeId: string, slot: Slot) {
    patchNode(slug, nodeId, { quadrant: slot === "unplaced" ? null : slot }).then(onChanged);
  }

  function dropProps(slot: Slot) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setOverSlot(slot),
      onDragLeave: () => setOverSlot((prev) => (prev === slot ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverSlot(null);
        const nodeId = e.dataTransfer.getData("text/plain");
        if (nodeId) moveTo(nodeId, slot);
      },
    };
  }

  function cardProps(n: NodeRecord) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", n.id);
        e.dataTransfer.effectAllowed = "move";
        setDraggingId(n.id);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setOverSlot(null);
      },
    };
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">{t("matrixTitle")}</h2>
      <p className="mt-1 max-w-2xl text-xs" style={{ color: "var(--muted)" }}>
        {t("matrixDesc")}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {QUADRANTS.map((q) => (
          <div
            key={q}
            {...dropProps(q)}
            className="min-h-32 rounded-xl border p-3 transition-colors"
            style={{
              borderColor: overSlot === q ? "var(--accent)" : "var(--border)",
              background: overSlot === q ? "var(--card2)" : "var(--card)",
            }}
          >
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xs font-semibold">{t(`quadrant_${q}` as DictKey)}</h3>
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                {t(`quadrant_${q}_hint` as DictKey)}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {steps
                .filter((n) => n.quadrant === q)
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    {...cardProps(n)}
                    onClick={() => moveTo(n.id, NEXT[q])}
                    className="cursor-grab rounded-lg px-2.5 py-1.5 text-left text-xs active:cursor-grabbing"
                    style={{ background: "var(--card2)", opacity: draggingId === n.id ? 0.4 : 1 }}
                  >
                    {n.title}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          {t("unplaced")}
        </h3>
        <div
          {...dropProps("unplaced")}
          className="mt-1.5 flex min-h-10 flex-wrap gap-1.5 rounded-xl border border-dashed p-2 transition-colors"
          style={{
            borderColor: overSlot === "unplaced" ? "var(--accent)" : "var(--border)",
            background: overSlot === "unplaced" ? "var(--card2)" : "transparent",
          }}
        >
          {unplaced.map((n) => (
            <button
              key={n.id}
              type="button"
              {...cardProps(n)}
              onClick={() => moveTo(n.id, "do_now")}
              className="cursor-grab rounded-lg border px-2.5 py-1.5 text-left text-xs active:cursor-grabbing"
              style={{ borderColor: "var(--border)", opacity: draggingId === n.id ? 0.4 : 1 }}
            >
              {n.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
