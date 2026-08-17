"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { useI18n } from "@/lib/client/i18n";
import { useTheme } from "@/lib/client/theme";

export default function LoginPage() {
  const { status, login, loginWithPassword } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<"token" | "password">("token");
  const [token, setTokenValue] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authed") router.replace("/boards");
  }, [status, router]);

  function switchMode(next: "token" | "password") {
    setMode(next);
    setError(false);
  }

  async function onSubmitToken(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const ok = await login(token.trim(), keepSignedIn);
      if (ok) router.replace("/boards");
      else setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    try {
      const ok = await loginWithPassword(handle.trim(), password, keepSignedIn);
      if (ok) router.replace("/boards");
      else setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-grid">
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent)" }}>
          <Image src="/logo.png" alt="" width={30} height={30} style={{ borderRadius: 7 }} />
          {t("appName")}
        </div>

        <div style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: 42 }}>{t("heroTitle")}</h1>
          <p className="text-muted" style={{ fontSize: 16 }}>{t("heroSubtitle")}</p>
        </div>

        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{t("heroFooter")}</p>
      </div>

      <div className="login-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "var(--space-8)", gap: "var(--space-4)" }}>
        <div style={{ width: "min(360px, 100%)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>{t("loginTitle")}</h1>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="btn btn-ghost">
                {locale === "en" ? "EN" : "中文"}
              </button>
              <button type="button" onClick={toggleTheme} title={t("theme")} className="btn btn-ghost">
                {theme === "dark" ? t("themeDark") : t("themeLight")}
              </button>
            </div>
          </div>

          <div className="seg" style={{ width: "100%" }}>
            {(["token", "password"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => switchMode(m)} className="seg-opt" style={{ flex: 1, justifyContent: "center" }}>
                {m === "token" ? t("loginTabToken") : t("loginTabPassword")}
              </button>
            ))}
          </div>

          {mode === "token" ? (
            <form onSubmit={onSubmitToken} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div className="field">
                <label htmlFor="login-token">{t("loginTokenLabel")}</label>
                <input
                  id="login-token"
                  type="password"
                  value={token}
                  onChange={(e) => setTokenValue(e.target.value)}
                  placeholder={t("loginPlaceholder")}
                  autoFocus
                  className="input"
                  style={{ fontFamily: "monospace", borderColor: error ? "var(--color-danger)" : undefined }}
                />
              </div>
              <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{t("loginTokenHint")}</p>
              {error && <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0 }}>{t("loginError")}</p>}

              <label className="checkbox" style={{ marginTop: "var(--space-2)" }}>
                <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                {t("keepSignedIn")}
              </label>

              <button type="submit" disabled={submitting || token.trim() === ""} className="btn btn-primary btn-block">
                {t("signIn")}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmitPassword} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div className="field">
                <label htmlFor="login-handle">{t("handle")}</label>
                <input
                  id="login-handle"
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={t("handle")}
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="input"
                  style={{ borderColor: error ? "var(--color-danger)" : undefined }}
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">{t("password")}</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password")}
                  className="input"
                  style={{ borderColor: error ? "var(--color-danger)" : undefined }}
                />
              </div>
              {error && <p style={{ fontSize: 13, color: "var(--color-danger)", margin: 0 }}>{t("loginErrorPassword")}</p>}

              <label className="checkbox" style={{ marginTop: "var(--space-2)" }}>
                <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} />
                {t("keepSignedIn")}
              </label>

              <button type="submit" disabled={submitting || handle.trim() === "" || password === ""} className="btn btn-primary btn-block">
                {t("signIn")}
              </button>
            </form>
          )}

          <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{t("loginFooter")}</p>
        </div>
      </div>
    </main>
  );
}
