"use client";

import { use, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/components/AppShell";
import { BoardTree } from "@/app/components/BoardTree";
import { MatrixView } from "@/app/components/MatrixView";
import { api, downloadText } from "@/lib/client/api";
import { useI18n } from "@/lib/client/i18n";
import type { BoardDetailResponse } from "@/lib/client/types";

interface ReportResponse {
  report: { body: string };
}

type Tab = "board" | "matrix";

export default function BoardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { t } = useI18n();
  const [detail, setDetail] = useState<BoardDetailResponse | null>(null);
  const [tab, setTab] = useState<Tab>("board");
  const [report, setReport] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.get<BoardDetailResponse>(`/api/boards/${slug}`).then(setDetail);
  }, [slug]);

  useEffect(reload, [reload]);

  return (
    <AppShell activeSlug={slug}>
      {detail && (
        <div className="mx-auto max-w-3xl px-8 py-8">
          <header>
            <h1 className="text-xl font-semibold">{detail.board.title}</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {detail.board.goal}
            </p>

            <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
              <span>
                {detail.counts.done}/{detail.counts.total}
              </span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${detail.counts.total === 0 ? 0 : (detail.counts.done / detail.counts.total) * 100}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => downloadText(`/api/boards/${slug}/markdown`, `${slug}.md`)}
                className="ml-auto underline"
              >
                {t("downloadMarkdown")}
              </button>
              <button
                type="button"
                onClick={() => api.get<ReportResponse>(`/api/boards/${slug}/report`).then((r) => setReport(r.report.body))}
                className="underline"
              >
                {t("downloadReport")}
              </button>
            </div>

            <div
              className="mt-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <span className="font-semibold" style={{ color: "var(--accent)" }}>
                {t("nextAction")}:{" "}
              </span>
              {detail.nextAction ? detail.nextAction.text : `— ${t("boardComplete")}`}
            </div>
          </header>

          <div className="mt-6 flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
            {(["board", "matrix"] as const).map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTab(tb)}
                className="border-b-2 px-3 py-2 text-xs font-semibold"
                style={{
                  borderColor: tab === tb ? "var(--accent)" : "transparent",
                  color: tab === tb ? "var(--accent)" : "var(--muted)",
                }}
              >
                {tb === "board" ? t("tabBoard") : t("tabMatrix")}
              </button>
            ))}
          </div>

          {report && (
            <div
              className="mt-5 rounded-lg border p-4"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <pre className="flex-1 text-xs whitespace-pre-wrap">{report}</pre>
                <button type="button" onClick={() => setReport(null)} className="text-xs" style={{ color: "var(--muted)" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="mt-5">
            {tab === "board" ? (
              <BoardTree nodes={detail.nodes} slug={slug} onChanged={reload} />
            ) : (
              <MatrixView nodes={detail.nodes} slug={slug} onChanged={reload} />
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
