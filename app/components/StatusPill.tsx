"use client";

import { useState } from "react";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { StepStatus } from "@/lib/client/types";

const ORDER: StepStatus[] = ["todo", "doing", "stuck", "done", "skipped"];
const TAG_CLASS: Record<StepStatus, string> = {
  todo: "tag-neutral",
  doing: "tag-accent",
  stuck: "tag-danger",
  done: "tag-accent-2",
  skipped: "tag-outline",
};

export function StatusPill({
  status,
  onChange,
}: {
  status: StepStatus;
  onChange: (status: StepStatus, blocker?: { description: string; unblockPlan?: string }) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pendingStuck, setPendingStuck] = useState(false);
  const [description, setDescription] = useState("");
  const [plan, setPlan] = useState("");

  function pick(next: StepStatus) {
    if (next === "stuck") {
      setPendingStuck(true);
      return;
    }
    setOpen(false);
    onChange(next);
  }

  function submitStuck(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    onChange("stuck", { description: description.trim(), unblockPlan: plan.trim() || undefined });
    setPendingStuck(false);
    setOpen(false);
    setDescription("");
    setPlan("");
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`tag ${TAG_CLASS[status]}`} style={{ cursor: "pointer", border: "none" }}>
        {t(`status_${status}` as DictKey)}
      </button>

      {open && !pendingStuck && (
        <div className="popover" style={{ width: 160, padding: "var(--space-2)", display: "flex", flexDirection: "column", gap: 2 }}>
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className="btn btn-ghost"
              style={{ justifyContent: "flex-start" }}
            >
              {t(`status_${s}` as DictKey)}
            </button>
          ))}
        </div>
      )}

      {pendingStuck && (
        <form onSubmit={submitStuck} className="popover" style={{ width: 240 }}>
          <input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("whatsBlocking")}
            className="input"
          />
          <input
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder={t("unblockPlan")}
            className="input"
            style={{ marginTop: "var(--space-2)" }}
          />
          <div className="dialog-actions">
            <button
              type="button"
              onClick={() => {
                setPendingStuck(false);
                setOpen(false);
              }}
              className="btn btn-secondary"
            >
              {t("cancel")}
            </button>
            <button type="submit" disabled={!description.trim()} className="btn btn-primary">
              {t("save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
