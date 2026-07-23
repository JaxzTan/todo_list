"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { useI18n } from "@/lib/client/i18n";
import type { BoardSummary } from "@/lib/client/types";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function NewBoardDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [type, setType] = useState<"PROJECT" | "DAY">("PROJECT");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const slug = slugify(title);
    try {
      const result = await api.post<{ board: BoardSummary }>("/api/boards", {
        slug,
        type,
        title,
        goal,
      });
      // A web session = actively viewing/using the board — opened here so
      // the board is never in the sessionless state generateReport rejects.
      await api.post(`/api/boards/${result.board.slug}/sessions`, { action: "open" });
      onCreated(result.board.slug);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "failed to create board");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <h2 className="text-base font-semibold">{t("newBoard")}</h2>

        <label htmlFor="new-board-title" className="mt-4 block text-xs font-medium" style={{ color: "var(--muted)" }}>
          Title
        </label>
        <input
          id="new-board-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
        />

        <label htmlFor="new-board-goal" className="mt-3 block text-xs font-medium" style={{ color: "var(--muted)" }}>
          {t("goal")}
        </label>
        <input
          id="new-board-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
        />

        <div className="mt-3 flex gap-2">
          {(["PROJECT", "DAY"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setType(opt)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: "var(--border)",
                background: type === opt ? "var(--accent)" : "var(--card2)",
                color: type === opt ? "var(--accent-fg)" : "var(--text)",
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
