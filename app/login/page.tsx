"use client";

import { useEffect, useState } from "react";
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
      const ok = await login(token.trim());
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
      const ok = await loginWithPassword(handle.trim(), password);
      if (ok) router.replace("/boards");
      else setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-8)", padding: "var(--space-4)" }}>
      <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: "var(--space-2)" }}>
        <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="btn btn-secondary">
          {locale === "en" ? "EN" : "中文"}
        </button>
        <button type="button" onClick={toggleTheme} title={t("theme")} className="btn btn-secondary">
          {theme === "dark" ? t("themeDark") : t("themeLight")}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 18, fontWeight: 500, color: "var(--color-accent)" }}>
        {t("appName")}
      </div>

      <div className="card elev-md" style={{ width: "min(360px, 100%)", padding: "var(--space-6)" }}>
        <h1 style={{ fontSize: 20 }}>{t("loginTitle")}</h1>
        <p className="text-muted" style={{ fontSize: 13 }}>{mode === "token" ? t("loginSub") : t("loginSubPassword")}</p>

        <div className="seg" style={{ marginTop: "var(--space-4)", width: "100%" }}>
          {(["token", "password"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => switchMode(m)} className="seg-opt" style={{ flex: 1, justifyContent: "center" }}>
              {m === "token" ? t("loginTabToken") : t("loginTabPassword")}
            </button>
          ))}
        </div>

        {mode === "token" ? (
          <form onSubmit={onSubmitToken}>
            <input
              type="password"
              value={token}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder={t("loginPlaceholder")}
              autoFocus
              className="input"
              style={{ marginTop: "var(--space-4)", fontFamily: "monospace", borderColor: error ? "var(--color-danger)" : undefined }}
            />
            {error && <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--color-danger)" }}>{t("loginError")}</p>}
            <button type="submit" disabled={submitting || token.trim() === ""} className="btn btn-primary btn-block">
              {t("signIn")}
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitPassword}>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={t("handle")}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="input"
              style={{ marginTop: "var(--space-4)", borderColor: error ? "var(--color-danger)" : undefined }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              className="input"
              style={{ marginTop: "var(--space-2)", borderColor: error ? "var(--color-danger)" : undefined }}
            />
            {error && <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--color-danger)" }}>{t("loginErrorPassword")}</p>}
            <button type="submit" disabled={submitting || handle.trim() === "" || password === ""} className="btn btn-primary btn-block">
              {t("signIn")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
