"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { NewBoardDialog } from "@/app/components/NewBoardDialog";
import { api, setToken } from "@/lib/client/api";
import { isAuthError } from "@/lib/client/auth";
import { useI18n } from "@/lib/client/i18n";
import type { BoardSummary } from "@/lib/client/types";

export default function BoardsIndexPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    api.get<{ boards: BoardSummary[] }>("/api/boards").then(
      (r) => setBoards(r.boards),
      (err) => {
        if (!isAuthError(err)) throw err;
        setToken(null);
        router.replace("/login");
      },
    );
  }, [router]);

  const doingCount = boards?.filter((b) => b.doing !== null).length ?? 0;
  // "Pick up where you stopped" — whichever board was touched most recently
  // and still has an active doing node; listBoards already orders by
  // updatedAt desc, so the first match is the right one.
  const pickup = boards?.find((b) => b.doing !== null) ?? null;

  return (
    <AppShell
      crumb={
        boards !== null ? (
          <span className="text-muted" style={{ fontSize: 13 }}>
            {t("boardsHeaderCount").replace("{n}", String(boards.length)).replace("{doing}", String(doingCount))}
          </span>
        ) : undefined
      }
    >
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
        <h1>{t("boardsIndexTitle")}</h1>

        {boards === null ? null : boards.length === 0 ? (
          <>
            <p className="text-muted">{t("boardsIndexEmpty")}</p>
            <button type="button" onClick={() => setShowNew(true)} className="btn btn-primary" style={{ marginTop: "var(--space-3)" }}>
              + {t("newBoard")}
            </button>
          </>
        ) : (
          <>
            {pickup && (
              <div className="card elev-md" style={{ marginTop: "var(--space-4)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)" }}>
                <div>
                  <span className="card-kicker">{t("boardsHeroKicker")}</span>
                  <h2 style={{ margin: "2px 0" }}>{t("boardsHeroTitle")}</h2>
                  <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                    {pickup.doing!.number} {pickup.doing!.title} — {t("status_doing")}
                  </p>
                </div>
                <Link href={`/boards/${pickup.slug}`} className="btn btn-primary">
                  {t("openTodaysBoard")}
                </Link>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
              <h6 style={{ margin: 0 }}>{t("yourBoards")}</h6>
              <button type="button" onClick={() => setShowNew(true)} className="btn btn-ghost">
                + {t("newBoard")}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              {boards.map((b) => {
                const complete = b.counts.total > 0 && b.counts.done === b.counts.total;
                const pct = b.counts.total > 0 ? Math.round((b.counts.done / b.counts.total) * 100) : 0;
                return (
                  <Link
                    key={b.id}
                    href={`/boards/${b.slug}`}
                    className="card"
                    style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-4)", textDecoration: "none", color: "inherit" }}
                  >
                    <span className="tag tag-outline">{b.type}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="card-title">{b.title}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {t("boardRowDone").replace("{done}", String(b.counts.done)).replace("{total}", String(b.counts.total))}
                        {b.doing ? t("boardRowDoing").replace("{number}", b.doing.number) : complete ? t("boardRowComplete") : ""}
                      </div>
                    </div>
                    <div style={{ width: 120 }}>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--ui-line)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-accent)" }} />
                      </div>
                      <div className="text-muted" style={{ fontSize: 11, textAlign: "right", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                        {b.counts.done} / {b.counts.total}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <p className="text-muted" style={{ fontSize: 12, marginTop: "var(--space-6)" }}>{t("boardsFooterCaption")}</p>
          </>
        )}
      </div>

      {showNew && (
        <NewBoardDialog
          onClose={() => setShowNew(false)}
          onCreated={(slug) => {
            setShowNew(false);
            router.push(`/boards/${slug}`);
          }}
        />
      )}
    </AppShell>
  );
}
