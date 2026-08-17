"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/app/components/AppShell";
import { BoardTree } from "@/app/components/BoardTree";
import { MatrixView } from "@/app/components/MatrixView";
import { QuadrantsView } from "@/app/components/QuadrantsView";
import { DayView } from "@/app/components/DayView";
import { NextActionAside } from "@/app/components/NextActionAside";
import { FieldsPopover } from "@/app/components/FieldsPopover";
import { EventLogDialog } from "@/app/components/EventLogDialog";
import { api, downloadText, setToken } from "@/lib/client/api";
import { isAuthError } from "@/lib/client/auth";
import { useI18n } from "@/lib/client/i18n";
import { flatten, buildClientTree } from "@/lib/client/tree";
import type { BoardDetailResponse, EventRecord } from "@/lib/client/types";

interface ReportResponse {
  report: { body: string };
}

type Tab = "board" | "matrix" | "quadrants";
type MainView = "tasks" | "day";

export default function BoardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [detail, setDetail] = useState<BoardDetailResponse | null>(null);
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [tab, setTab] = useState<Tab>("board");
  const [mainView, setMainView] = useState<MainView>("tasks");
  const [report, setReport] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const onAuthError = useCallback(
    (err: unknown) => {
      if (!isAuthError(err)) throw err;
      setToken(null);
      router.replace("/login");
    },
    [router],
  );

  const reload = useCallback(() => {
    api.get<BoardDetailResponse>(`/api/boards/${slug}`).then(setDetail, onAuthError);
    api.get<{ events: EventRecord[] }>(`/api/boards/${slug}/events`).then((r) => setEvents(r.events), onAuthError);
  }, [slug, onAuthError]);

  function onDeleteBoard() {
    api.del(`/api/boards/${slug}`).then(() => router.push("/boards"), onAuthError);
  }

  useEffect(reload, [reload]);

  if (!detail) {
    return (
      <AppShell>
        <div />
      </AppShell>
    );
  }

  const numbers = new Map(flatten(buildClientTree(detail.nodes)).map((n) => [n.node.id, n.number]));

  return (
    <AppShell
      crumb={
        <>
          <span className="text-muted">/</span>
          <span style={{ fontWeight: 500 }}>{detail.board.title}</span>
          <span className="tag tag-outline">{detail.board.type}</span>
          <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
            {detail.counts.done}/{detail.counts.total}
          </span>
        </>
      }
      controls={
        <>
          {mainView === "tasks" && (
            <div className="seg">
              <button type="button" aria-pressed={tab === "board"} onClick={() => setTab("board")} className="seg-opt">
                {t("tabBoard")}
              </button>
              <button type="button" aria-pressed={tab === "matrix"} onClick={() => setTab("matrix")} className="seg-opt">
                {t("tabMatrix")}
              </button>
              <button type="button" aria-pressed={tab === "quadrants"} onClick={() => setTab("quadrants")} className="seg-opt">
                {t("tabQuadrants")}
              </button>
            </div>
          )}
          <div className="seg">
            <button type="button" aria-pressed={mainView === "day"} onClick={() => setMainView("day")} className="seg-opt">
              {t("tabDay")}
            </button>
            <button type="button" aria-pressed={mainView === "tasks"} onClick={() => setMainView("tasks")} className="seg-opt">
              {t("tabTasks")}
            </button>
          </div>
          <FieldsPopover board={detail.board} slug={slug} onChanged={reload} />
          <button type="button" onClick={() => setShowLog(true)} className="btn btn-secondary">
            {t("log")} {events && events.length > 0 ? events.length : ""}
          </button>
        </>
      }
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <button type="button" onClick={() => downloadText(`/api/boards/${slug}/markdown`, `${slug}.md`)} className="btn btn-ghost" style={{ paddingInline: 0 }}>
            {t("downloadMarkdown")}
          </button>
          <button
            type="button"
            onClick={() => api.get<ReportResponse>(`/api/boards/${slug}/report`).then((r) => setReport(r.report.body), onAuthError)}
            className="btn btn-ghost"
            style={{ paddingInline: 0 }}
          >
            {t("downloadReport")}
          </button>
          <div style={{ marginLeft: "auto" }}>
            {confirmingDelete ? (
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 12, color: "var(--color-danger)" }}>
                {t("deleteBoardConfirm")}
                <button type="button" onClick={onDeleteBoard} className="btn btn-danger">
                  {t("deleteBoard")}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="btn btn-ghost">
                  {t("cancel")}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} className="btn btn-ghost" style={{ color: "var(--color-danger)" }}>
                {t("deleteBoard")}
              </button>
            )}
          </div>
        </div>

        {report && (
          <div className="card" style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <pre style={{ flex: 1, fontSize: 12, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{report}</pre>
              <button type="button" onClick={() => setReport(null)} className="btn btn-ghost">
                {t("close")}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "flex-start" }}>
          <NextActionAside
            nodes={detail.nodes}
            nextAction={detail.nextAction}
            candidates={detail.candidates}
            events={events}
            slug={slug}
            onChanged={reload}
            onOpenLog={() => setShowLog(true)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {mainView === "day" ? (
              <DayView nodes={detail.nodes} numbers={numbers} slug={slug} onChanged={reload} />
            ) : tab === "board" ? (
              <BoardTree nodes={detail.nodes} blockers={detail.blockers} visibleFields={detail.board.visibleFields} slug={slug} onChanged={reload} />
            ) : tab === "matrix" ? (
              <MatrixView nodes={detail.nodes} nextActionNodeId={detail.nextAction?.nodeId ?? null} slug={slug} onChanged={reload} />
            ) : (
              <QuadrantsView nodes={detail.nodes} nextActionNodeId={detail.nextAction?.nodeId ?? null} slug={slug} onChanged={reload} />
            )}
          </div>
        </div>
      </div>

      {showLog && <EventLogDialog slug={slug} numbers={numbers} onClose={() => { setShowLog(false); reload(); }} />}
    </AppShell>
  );
}
