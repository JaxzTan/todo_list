"use client";

import { useState } from "react";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { StepStatus } from "@/lib/client/types";

const ORDER: StepStatus[] = ["todo", "doing", "stuck", "done", "skipped"];
const COLOR: Record<StepStatus, string> = {
  todo: "#8a8578",
  doing: "#2f7d5b",
  stuck: "#b3423a",
  done: "#4a7fc9",
  skipped: "#b39a4a",
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
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: `${COLOR[status]}20`, color: COLOR[status] }}
      >
        {t(`status_${status}` as DictKey)}
      </button>

      {open && !pendingStuck && (
        <div
          className="absolute top-full left-0 z-20 mt-1 flex flex-col rounded-lg border p-1 shadow-md"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className="rounded-md px-2 py-1 text-left text-xs whitespace-nowrap hover:opacity-80"
              style={{ color: COLOR[s] }}
            >
              {t(`status_${s}` as DictKey)}
            </button>
          ))}
        </div>
      )}

      {pendingStuck && (
        <form
          onSubmit={submitStuck}
          className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg border p-3 shadow-md"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="what's blocking? (required)"
            className="w-full rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}
          />
          <input
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="unblock plan (optional)"
            className="mt-1.5 w-full rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPendingStuck(false);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-[11px]"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!description.trim()}
              className="rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              {t("save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
