"use client";

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

export function MatrixView({ nodes, slug, onChanged }: { nodes: NodeRecord[]; slug: string; onChanged: () => void }) {
  const { t } = useI18n();
  const steps = nodes.filter((n) => n.kind === "STEP" && !n.archivedAt);
  const unplaced = steps.filter((n) => !n.quadrant);

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
            className="min-h-32 rounded-xl border p-3"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
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
                    onClick={() => patchNode(slug, n.id, { quadrant: NEXT[q] }).then(onChanged)}
                    className="rounded-lg px-2.5 py-1.5 text-left text-xs"
                    style={{ background: "var(--card2)" }}
                  >
                    {n.title}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {unplaced.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            {t("unplaced")}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unplaced.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => patchNode(slug, n.id, { quadrant: "do_now" }).then(onChanged)}
                className="rounded-lg border px-2.5 py-1.5 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                {n.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
