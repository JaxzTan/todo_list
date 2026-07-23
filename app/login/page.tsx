"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth";
import { useI18n } from "@/lib/client/i18n";

export default function LoginPage() {
  const { status, login } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authed") router.replace("/boards");
  }, [status, router]);

  async function onSubmit(e: React.FormEvent) {
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

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <button
        type="button"
        onClick={() => setLocale(locale === "en" ? "zh" : "en")}
        className="absolute top-5 right-5 rounded-lg border px-3 py-1.5 text-xs font-medium"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        {locale === "en" ? "中文" : "EN"}
      </button>

      <div className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--accent)" }}>
        <span
          className="inline-block h-6 w-6 rounded-md"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        {t("appName")}
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border p-6 shadow-sm"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h1 className="text-lg font-semibold">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {t("loginSub")}
        </p>

        <input
          type="password"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          placeholder={t("loginPlaceholder")}
          autoFocus
          className="mt-5 w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:ring-2"
          style={{
            borderColor: error ? "var(--danger)" : "var(--border)",
            background: "var(--card2)",
            color: "var(--text)",
          }}
        />
        {error && (
          <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
            {t("loginError")}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || token.trim() === ""}
          className="mt-4 w-full rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {t("signIn")}
        </button>
      </form>
    </main>
  );
}
