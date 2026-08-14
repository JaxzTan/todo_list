"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { patchBoard } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import type { BoardSummary } from "@/lib/client/types";

const FIELD_KEYS = ["due", "prio", "owner", "notes", "blocker"] as const;

export function FieldsPopover({
  board,
  slug,
  onChanged,
}: {
  board: BoardSummary;
  slug: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(field: string) {
    const next = board.visibleFields.includes(field)
      ? board.visibleFields.filter((f) => f !== field)
      : [...board.visibleFields, field];
    patchBoard(slug, { visibleFields: next }).then(onChanged);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const markdown = await file.text();
    await api.post("/api/boards/import", { slug, markdown });
    setOpen(false);
    onChanged();
  }

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-secondary">
        {t("fields")}
      </button>
      {open && (
        <div className="popover" style={{ position: "absolute", top: "100%", right: 0, marginTop: 6 }}>
          <div className="card-kicker">{t("fieldsShownOnRows")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            {FIELD_KEYS.map((f) => (
              <label key={f} className="checkbox">
                <input type="checkbox" checked={board.visibleFields.includes(f)} onChange={() => toggle(f)} />
                {t(`field_${f}` as DictKey)}
              </label>
            ))}
          </div>
          <p className="dialog-body" style={{ fontSize: 11, marginTop: "var(--space-3)" }}>
            {t("fieldsHint")}
          </p>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost" style={{ marginTop: "var(--space-2)", paddingInline: 0 }}>
            {t("importMarkdown")}
          </button>
          <input ref={fileRef} type="file" accept=".md,text/markdown" onChange={onImportFile} style={{ display: "none" }} />
        </div>
      )}
    </div>
  );
}
