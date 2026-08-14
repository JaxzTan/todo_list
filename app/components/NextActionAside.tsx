"use client";

import { useState } from "react";
import { addNote, patchNode } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import { flatten, buildClientTree } from "@/lib/client/tree";
import { summarizeEvent } from "@/lib/client/eventSummary";
import { StatusPill } from "./StatusPill";
import type { EventRecord, NextAction, NodeRecord } from "@/lib/client/types";

const RECENT_COUNT = 5;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function NextActionAside({
  nodes,
  nextAction,
  candidates,
  events,
  slug,
  onChanged,
  onOpenLog,
}: {
  nodes: NodeRecord[];
  nextAction: NextAction | null;
  candidates: NextAction[];
  events: EventRecord[] | null;
  slug: string;
  onChanged: () => void;
  onOpenLog: () => void;
}) {
  const { t } = useI18n();
  const [addingNote, setAddingNote] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  const tree = flatten(buildClientTree(nodes));
  const numbers = new Map(tree.map((t) => [t.node.id, t.number]));
  const node = nextAction ? (nodes.find((n) => n.id === nextAction.nodeId) ?? null) : null;
  const group = node?.parentId ? (nodes.find((n) => n.id === node.parentId) ?? null) : null;
  const recent = events?.slice(0, RECENT_COUNT) ?? [];
  const sinceLabel = recent.length > 0 ? formatTime(recent[recent.length - 1]!.at) : "";

  return (
    <aside style={{ width: 308, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="card" style={{ background: "var(--ui-tint)", border: "1px solid var(--ui-tint-edge)" }}>
        <div className="card-kicker">{t("nextActionCard")}</div>
        {node && nextAction ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 500, color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>
                {nextAction.number}
              </span>
              <StatusPill status={node.status} onChange={(status, blocker) => patchNode(slug, node.id, { status, blocker }).then(onChanged)} />
            </div>
            <div className="card-title">{node.title}</div>
            {group && <div className="text-muted" style={{ fontSize: 13 }}>{group.title}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {node.due && <span className="tag tag-outline">{node.due.slice(0, 10)}</span>}
              {node.prio && <span className="tag tag-outline">{node.prio}</span>}
              {node.owner && <span className="tag tag-outline">{node.owner}</span>}
            </div>
            <div className="hr" />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                type="button"
                onClick={() => patchNode(slug, node.id, { status: "done" }).then(onChanged)}
                className="btn btn-primary"
                style={{ minHeight: 44, flex: 1 }}
              >
                {t("markDone")}
              </button>
              <StuckButton nodeId={node.id} slug={slug} status={node.status} onChanged={onChanged} />
            </div>
            {addingNote ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!noteBody.trim()) return;
                  addNote(slug, node.id, noteBody.trim()).then(() => {
                    setNoteBody("");
                    setAddingNote(false);
                    onChanged();
                  });
                }}
              >
                <input autoFocus value={noteBody} onChange={(e) => setNoteBody(e.target.value)} className="input" style={{ marginTop: "var(--space-2)" }} onBlur={() => !noteBody.trim() && setAddingNote(false)} />
              </form>
            ) : (
              <button type="button" onClick={() => setAddingNote(true)} className="btn btn-ghost" style={{ paddingInline: 0 }}>
                {t("addNote")}
              </button>
            )}
          </>
        ) : (
          <p className="card-body">— {t("boardComplete")}</p>
        )}
      </div>

      {candidates.length > 0 && (
        <div>
          <h6 style={{ color: "var(--ui-muted)" }}>{t("thenProbably")}</h6>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: "var(--space-1)" }}>
            {candidates.map((c) => (
              <div key={c.nodeId} style={{ display: "flex", gap: "var(--space-2)", fontSize: 13 }}>
                <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{c.number}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <h6 style={{ color: "var(--ui-muted)" }}>{t("changedSince").replace("{time}", sinceLabel)}</h6>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
            {recent.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: "var(--space-2)", fontSize: 12 }}>
                <span className="tag tag-neutral" style={{ flexShrink: 0 }}>{t(`actor_${e.source}` as DictKey)}</span>
                <span style={{ flex: 1, textDecoration: e.revertedBy ? "line-through" : "none", opacity: e.revertedBy ? 0.6 : 1 }}>
                  {summarizeEvent(e, numbers)}
                </span>
                <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{formatTime(e.at)}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={onOpenLog} className="btn btn-ghost" style={{ marginTop: "var(--space-2)", paddingInline: 0 }}>
            {t("viewFullLog")}
          </button>
        </div>
      )}

      <p className="text-muted" style={{ fontSize: 11 }}>{t("doingSlotFooter")}</p>
    </aside>
  );
}

function StuckButton({
  nodeId,
  slug,
  status,
  onChanged,
}: {
  nodeId: string;
  slug: string;
  status: NodeRecord["status"];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [plan, setPlan] = useState("");

  if (status === "stuck") return null;

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-secondary" style={{ minHeight: 44, width: "100%" }}>
        {t("stuck")}
      </button>
      {open && (
        <form
          className="popover"
          style={{ width: 240, right: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!description.trim()) return;
            patchNode(slug, nodeId, { status: "stuck", blocker: { description: description.trim(), unblockPlan: plan.trim() || undefined } }).then(() => {
              setOpen(false);
              setDescription("");
              setPlan("");
              onChanged();
            });
          }}
        >
          <input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("whatsBlocking")} className="input" />
          <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder={t("unblockPlan")} className="input" style={{ marginTop: "var(--space-2)" }} />
          <div className="dialog-actions">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
              {t("cancel")}
            </button>
            <button type="submit" disabled={!description.trim()} className="btn btn-primary">
              {t("save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
