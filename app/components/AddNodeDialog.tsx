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
  const placeholder = kind === "GROUP" ? t("addGroup") : t("addStep");

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
    <form onSubmit={onSubmit} style={{ marginTop: "var(--space-1)" }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        autoFocus
        disabled={submitting}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        onBlur={() => {
          if (!title.trim()) onClose();
        }}
        className="input"
        style={{ fontSize: 13 }}
      />
    </form>
  );
}
