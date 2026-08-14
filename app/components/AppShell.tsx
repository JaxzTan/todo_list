"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useRequireAuth } from "@/lib/client/auth";
import { useTheme } from "@/lib/client/theme";
import { useI18n } from "@/lib/client/i18n";

/**
 * The wireframe has no persistent board-switcher sidebar — just a
 * `Boards / {board}` breadcrumb in a sticky header (design_change.md
 * decision #1). `crumb` extends the breadcrumb past "Boards"; `controls`
 * renders page-specific header buttons (Tree|Matrix seg, Fields, Log)
 * before the always-present locale/theme toggles.
 */
export function AppShell({
  crumb,
  controls,
  children,
}: {
  crumb?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const status = useRequireAuth();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();

  if (status !== "authed") {
    return <div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="nav">
        <Link href="/boards" className="nav-brand" style={{ marginRight: 0 }}>
          {t("boardsBreadcrumb")}
        </Link>
        {crumb}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {controls}
          <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="btn btn-secondary">
            {locale === "en" ? "EN" : "中文"}
          </button>
          <button type="button" onClick={toggleTheme} title={t("theme")} className="btn btn-secondary">
            {theme === "dark" ? t("themeDark") : t("themeLight")}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="btn btn-ghost"
          >
            {t("signOut")}
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
