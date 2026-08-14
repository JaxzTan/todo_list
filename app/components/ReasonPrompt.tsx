"use client";

import { useState } from "react";
import { useI18n } from "@/lib/client/i18n";

export function ReasonPrompt({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");

  return (
    <form
      style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSubmit(reason.trim());
      }}
    >
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (!reason.trim()) onCancel();
        }}
        className="input"
        style={{ width: 180, minHeight: 28, fontSize: 11, padding: "3px 8px" }}
      />
      <button type="submit" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }}>
        {t("save")}
      </button>
    </form>
  );
}
