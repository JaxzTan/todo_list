"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { NewBoardDialog } from "@/app/components/NewBoardDialog";
import { api } from "@/lib/client/api";
import { useI18n } from "@/lib/client/i18n";
import type { BoardSummary } from "@/lib/client/types";

export default function BoardsIndexPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    api.get<{ boards: BoardSummary[] }>("/api/boards").then((r) => setBoards(r.boards));
  }, []);

  return (
    <AppShell
      controls={
        <button type="button" onClick={() => setShowNew(true)} className="btn btn-primary">
          + {t("newBoard")}
        </button>
      }
    >
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
        <h1>{t("boardsIndexTitle")}</h1>
        {boards === null ? null : boards.length === 0 ? (
          <p className="text-muted">{t("boardsIndexEmpty")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            {boards.map((b) => (
              <Link key={b.id} href={`/boards/${b.slug}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="card-kicker">{b.type}</span>
                <span className="card-title">{b.title}</span>
                <span className="card-body">{b.goal}</span>
              </Link>
            ))}
          </div>
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
