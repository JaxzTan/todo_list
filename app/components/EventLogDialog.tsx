"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/client/api";
import { isAuthError } from "@/lib/client/auth";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import { summarizeEvent, type NumberLookup } from "@/lib/client/eventSummary";
import type { EventRecord } from "@/lib/client/types";

const REVERTIBLE = new Set(["STATUS_CHANGED", "ATTR_SET", "NODE_REWORDED", "NODE_ADDED", "NODE_CUT"]);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function EventLogDialog({
  slug,
  numbers,
  onClose,
}: {
  slug: string;
  numbers: NumberLookup;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [events, setEvents] = useState<EventRecord[] | null>(null);

  function reload() {
    api.get<{ events: EventRecord[] }>(`/api/boards/${slug}/events`).then(
      (r) => setEvents(r.events),
      (err) => {
        if (!isAuthError(err)) throw err;
        setToken(null);
        router.replace("/login");
      },
    );
  }

  useEffect(reload, [slug]);

  async function revert(id: string) {
    await api.post(`/api/boards/${slug}/events/${id}/revert`);
    reload();
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{t("eventLogTitle")}</h2>
        <p className="dialog-body">{t("eventLogSub")}</p>

        <div style={{ display: "flex", flexDirection: "column", maxHeight: "50vh", overflowY: "auto" }}>
          {events?.map((e) => (
            <div key={e.id}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", padding: "var(--space-2) 0" }}>
                <span style={{ fontSize: 11, color: "var(--ui-muted)", width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(e.at)}
                </span>
                <span className="tag tag-neutral" style={{ flexShrink: 0 }}>
                  {t(`actor_${e.source}` as DictKey)}
                </span>
                <span style={{ flex: 1, fontSize: 13, textDecoration: e.revertedBy ? "line-through" : "none", opacity: e.revertedBy ? 0.6 : 1 }}>
                  {summarizeEvent(e, numbers)}
                </span>
                {e.revertedBy ? (
                  <span className="tag tag-outline" style={{ flexShrink: 0 }}>
                    {t("reverted")}
                  </span>
                ) : REVERTIBLE.has(e.type) ? (
                  <button type="button" onClick={() => revert(e.id)} className="btn btn-ghost" style={{ flexShrink: 0 }}>
                    {t("revert")}
                  </button>
                ) : null}
              </div>
              <div className="hr" style={{ margin: 0 }} />
            </div>
          ))}
        </div>

        <p className="dialog-body" style={{ fontSize: 11 }}>
          {t("eventLogFooter")}
        </p>

        <div className="dialog-actions">
          <button type="button" onClick={onClose} className="btn btn-primary">
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
