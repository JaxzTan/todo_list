"use client";

import { useState } from "react";
import { addNode } from "@/lib/client/mutations";
import { useI18n } from "@/lib/client/i18n";
import type { NodeKind } from "@/lib/client/types";

export function AddNodeDialog({
  slug,
  kind,
  parentId,
  onClose,
  onAdded,
}: {
  slug: string;
  kind: NodeKind;
  parentId?: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const heading = kind === "GROUP" ? t("addGroup") : t("addStep");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addNode(slug, { kind, title: title.trim(), parentId });
      onAdded();
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
        <h2 className="text-base font-semibold">{heading}</h2>

        <label htmlFor="add-node-title" className="mt-4 block text-xs font-medium" style={{ color: "var(--muted)" }}>
          {t("title")}
        </label>
        <textarea
          id="add-node-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          rows={4}
          className="mt-1 w-full resize-none rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
        />

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
            disabled={submitting || !title.trim()}
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
