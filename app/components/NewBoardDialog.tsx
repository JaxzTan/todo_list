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
    <div className="dialog-backdrop" onClick={onClose}>
      <form onSubmit={onSubmit} className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{t("newBoard")}</h2>

        <div className="field">
          <label htmlFor="new-board-title">{t("title")}</label>
          <input id="new-board-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required className="input" />
        </div>

        <div className="field">
          <label htmlFor="new-board-goal">{t("goal")}</label>
          <input id="new-board-goal" value={goal} onChange={(e) => setGoal(e.target.value)} required className="input" />
        </div>

        <div className="seg" style={{ alignSelf: "flex-start" }}>
          {(["PROJECT", "DAY"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={type === opt}
              onClick={() => setType(opt)}
              className="seg-opt"
            >
              {opt}
            </button>
          ))}
        </div>

        {error && <p className="dialog-body" style={{ color: "var(--color-danger)", opacity: 1 }}>{error}</p>}

        <div className="dialog-actions">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            {t("cancel")}
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
