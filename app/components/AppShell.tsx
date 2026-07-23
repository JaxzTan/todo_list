"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useAuth, useRequireAuth } from "@/lib/client/auth";
import { useTheme } from "@/lib/client/theme";
import { useI18n } from "@/lib/client/i18n";
import type { BoardSummary } from "@/lib/client/types";
import { NewBoardDialog } from "./NewBoardDialog";

export function AppShell({ activeSlug, children }: { activeSlug?: string; children: ReactNode }) {
  const status = useRequireAuth();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (status !== "authed") return;
    api.get<{ boards: BoardSummary[] }>("/api/boards").then((r) => setBoards(r.boards));
  }, [status, activeSlug]);

  if (status !== "authed") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }} />
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <aside
        className="flex w-64 shrink-0 flex-col gap-5 p-5"
        style={{ background: "var(--sidebar-bg)", color: "var(--sidebar-fg)" }}
      >
        <Link href="/boards" className="flex items-center gap-2 px-1 text-sm font-semibold">
          <span className="inline-block h-5 w-5 rounded" style={{ background: "var(--accent)" }} aria-hidden />
          {t("appName")}
        </Link>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--sidebar-muted)" }}>
            {t("boardsTitle")}
          </span>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="rounded-md px-2 py-1 text-xs font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            + {t("newBoard")}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {boards === null ? null : boards.length === 0 ? (
            <p className="px-1 text-xs" style={{ color: "var(--sidebar-muted)" }}>
              {t("noBoards")}
            </p>
          ) : (
            boards.map((b) => (
              <Link
                key={b.id}
                href={`/boards/${b.slug}`}
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  background: b.slug === activeSlug ? "rgba(255,255,255,0.08)" : "transparent",
                  color: b.slug === activeSlug ? "#fff" : "var(--sidebar-fg)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <span className="truncate">{b.title}</span>
                </div>
                <span className="ml-3.5 text-[10px] uppercase tracking-wide" style={{ color: "var(--sidebar-muted)" }}>
                  {b.type}
                </span>
              </Link>
            ))
          )}
        </nav>

        <div className="flex items-center gap-2 border-t pt-4 text-xs" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="rounded-md px-2 py-1"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            {locale === "en" ? "中文" : "EN"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={t("theme")}
            className="rounded-md px-2 py-1"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="ml-auto rounded-md px-2 py-1"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            {t("signOut")}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>

      {showNew && (
        <NewBoardDialog
          onClose={() => setShowNew(false)}
          onCreated={(slug) => {
            setShowNew(false);
            router.push(`/boards/${slug}`);
          }}
        />
      )}
    </div>
  );
}
