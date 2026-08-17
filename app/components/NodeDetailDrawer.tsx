"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { patchNode, addNote } from "@/lib/client/mutations";
import { useI18n, type DictKey } from "@/lib/client/i18n";
import { summarizeEvent } from "@/lib/client/eventSummary";
import type { EventRecord, NodeRecord, StepStatus } from "@/lib/client/types";

const STATUS_ORDER: StepStatus[] = ["todo", "doing", "stuck", "done", "skipped"];
const REVERTIBLE = new Set(["STATUS_CHANGED", "ATTR_SET", "NODE_REWORDED", "NODE_ADDED", "NODE_CUT"]);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function NodeDetailDrawer({
  nodeId,
  nodes,
  numbers,
  events,
  blockers,
  slug,
  onClose,
  onChanged,
  onSelectNode,
}: {
  nodeId: string;
  nodes: NodeRecord[];
  numbers: Map<string, string>;
  events: EventRecord[];
  blockers: { nodeId: string; description: string }[];
  slug: string;
  onClose: () => void;
  onChanged: () => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const { t } = useI18n();
  const [pendingStuck, setPendingStuck] = useState(false);
  const [stuckDescription, setStuckDescription] = useState("");
  const [stuckPlan, setStuckPlan] = useState("");
  const [remarkDraft, setRemarkDraft] = useState("");

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const parent = node.parentId ? (nodes.find((n) => n.id === node.parentId) ?? null) : null;
  const kindLabel =
    node.kind === "GROUP" ? t("dayKindPhase") : parent?.kind === "STEP" ? t("dayKindSubtask") : t("dayKindTask");
  const subtasks = nodes.filter((n) => n.parentId === node.id && !n.archivedAt);
  const blockerDescription = node.status === "stuck" ? (blockers.find((b) => b.nodeId === node.id)?.description ?? null) : null;
  const nodeEvents = events.filter((e) => e.nodeId === node.id);
  const remarks = nodeEvents.filter((e) => e.type === "NOTE_ADDED").slice().reverse();

  function setStatus(status: StepStatus) {
    if (status === node!.status) return;
    if (status === "stuck") {
      setPendingStuck(true);
      return;
    }
    patchNode(slug, node!.id, { status }).then(onChanged);
  }

  function submitStuck(e: React.FormEvent) {
    e.preventDefault();
    if (!stuckDescription.trim()) return;
    patchNode(slug, node!.id, {
      status: "stuck",
      blocker: { description: stuckDescription.trim(), unblockPlan: stuckPlan.trim() || undefined },
    }).then(onChanged);
    setPendingStuck(false);
    setStuckDescription("");
    setStuckPlan("");
  }

  function toggleFlag() {
    patchNode(slug, node!.id, { flagged: !node!.flagged }).then(onChanged);
  }

  function clearBlocker() {
    patchNode(slug, node!.id, { status: "todo" }).then(onChanged);
  }

  async function submitRemark() {
    const body = remarkDraft.trim();
    if (!body) return;
    await addNote(slug, node!.id, body);
    setRemarkDraft("");
    onChanged();
  }

  async function revert(id: string) {
    await api.post(`/api/boards/${slug}/events/${id}/revert`);
    onChanged();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 18, display: "flex", justifyContent: "flex-end" }}>
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        style={{ flex: 1, border: 0, cursor: "pointer", background: "rgba(10,10,18,.42)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={node.title}
        style={{
          boxSizing: "border-box",
          width: 394,
          maxWidth: "100%",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--ui-line)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--ui-line)" }}>
          <span className="text-muted" style={{ fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase" }}>
            {t("details")}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-accent)" }}>{numbers.get(node.id) ?? ""}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ minHeight: 36 }}>
            {t("close")}
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="tag tag-outline" style={{ alignSelf: "flex-start" }}>{kindLabel}</span>
            <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 20, lineHeight: 1.3 }}>{node.title}</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 12.5 }}>
              {t("parentLabel")} · {parent ? `${numbers.get(parent.id) ?? ""} ${parent.title}` : t("topLevel")}
            </p>
          </div>

          <button
            type="button"
            onClick={toggleFlag}
            aria-pressed={node.flagged}
            style={{
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 46,
              padding: "0 14px",
              cursor: "pointer",
              border: `1px solid ${node.flagged ? "var(--color-danger)" : "var(--color-divider)"}`,
              background: node.flagged ? "var(--ui-tint)" : "transparent",
              borderRadius: "var(--radius-md)",
              textAlign: "left",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 15, color: node.flagged ? "var(--color-danger)" : "inherit" }}>⚑</span>
            <span style={{ flex: 1, fontSize: 14 }}>{node.flagged ? t("flagOn") : t("flagOff")}</span>
          </button>

          {node.kind === "STEP" && (
            <div>
              <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65 }}>
                {t("setStatus")}
              </h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={s === node!.status}
                    className={s === node!.status ? "tag tag-accent" : "tag tag-neutral"}
                    style={{ cursor: "pointer", border: "none", minHeight: 32, padding: "0 12px" }}
                  >
                    {t(`status_${s}` as DictKey)}
                  </button>
                ))}
              </div>

              {pendingStuck && (
                <form onSubmit={submitStuck} className="popover" style={{ position: "static", width: "auto", marginTop: 8 }}>
                  <input autoFocus value={stuckDescription} onChange={(e) => setStuckDescription(e.target.value)} placeholder={t("whatsBlocking")} className="input" />
                  <input value={stuckPlan} onChange={(e) => setStuckPlan(e.target.value)} placeholder={t("unblockPlan")} className="input" style={{ marginTop: 8 }} />
                  <div className="dialog-actions">
                    <button type="button" onClick={() => setPendingStuck(false)} className="btn btn-secondary">{t("cancel")}</button>
                    <button type="submit" disabled={!stuckDescription.trim()} className="btn btn-primary">{t("save")}</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {blockerDescription && (
            <div style={{ border: "1px solid var(--color-danger)", background: "var(--ui-tint)", borderRadius: "var(--radius-md)", padding: "12px 13px", display: "flex", flexDirection: "column", gap: 9 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-danger)" }}>{t("blockerLabel")}</span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{blockerDescription}</p>
              <button type="button" className="btn btn-ghost" onClick={clearBlocker} style={{ minHeight: 40, alignSelf: "flex-start" }}>
                {t("clearBlocker")}
              </button>
            </div>
          )}

          <div>
            <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65 }}>
              {t("attrs")}
            </h3>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13.5 }}>
              <dt style={{ opacity: 0.65 }}>{t("due")}</dt>
              <dd style={{ margin: 0 }}>{node.due ? node.due.slice(0, 10) : "—"}</dd>
              <dt style={{ opacity: 0.65 }}>{t("prio")}</dt>
              <dd style={{ margin: 0 }}>{node.prio ?? "—"}</dd>
              <dt style={{ opacity: 0.65 }}>{t("owner")}</dt>
              <dd style={{ margin: 0 }}>{node.owner ?? "—"}</dd>
              <dt style={{ opacity: 0.65 }}>{t("quadrantLabel")}</dt>
              <dd style={{ margin: 0 }}>{node.quadrant ? t(`quadrant_${node.quadrant}` as DictKey) : "—"}</dd>
              <dt style={{ opacity: 0.65 }}>{t("scheduledLabel")}</dt>
              <dd style={{ margin: 0 }}>{node.scheduledAt ? new Date(node.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</dd>
            </dl>
          </div>

          {subtasks.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65 }}>
                {t("subtasksLabel")}
              </h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {subtasks.map((sb) => (
                  <li key={sb.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNode(sb.id)}
                      style={{ boxSizing: "border-box", width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, minHeight: 40, padding: "0 10px", cursor: "pointer", background: "transparent", border: "1px solid var(--ui-line)", borderRadius: "var(--radius-sm)", font: "inherit", fontSize: 13.5, color: "inherit" }}
                    >
                      <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.65 }}>{numbers.get(sb.id) ?? ""}</span>
                      <span style={{ flex: 1 }}>{sb.title}</span>
                      <span style={{ opacity: 0.65, fontSize: 12.5 }}>{t(`status_${sb.status}` as DictKey)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65 }}>
              {t("remark")}
            </h3>
            <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {remarks.map((rm) => (
                <li key={rm.id} style={{ display: "flex", gap: 9, fontSize: 13.5, lineHeight: 1.5 }}>
                  <span style={{ flex: "none", fontVariantNumeric: "tabular-nums", opacity: 0.65 }}>{formatTime(rm.at)}</span>
                  <span style={{ flex: 1 }}>{String((rm.payload as { body?: unknown }).body ?? "")}</span>
                </li>
              ))}
            </ul>
            {remarks.length === 0 && <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.65 }}>{t("noRemarks")}</p>}
            <textarea
              aria-label={t("addRemark")}
              rows={2}
              value={remarkDraft}
              onChange={(e) => setRemarkDraft(e.target.value)}
              placeholder={t("remarkPlaceholder")}
              className="input"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={submitRemark} disabled={!remarkDraft.trim()} style={{ minHeight: 42 }}>
                {t("addRemark")}
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65 }}>
              {t("history")}
            </h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {nodeEvents.map((ev) => (
                <li key={ev.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--color-divider)", opacity: ev.revertedBy ? 0.6 : 1 }}>
                  <span style={{ flex: "none", width: 42, fontVariantNumeric: "tabular-nums", opacity: 0.65, fontSize: 12 }}>{formatTime(ev.at)}</span>
                  <span className="tag tag-neutral" style={{ flex: "none" }}>{t(`actor_${ev.source}` as DictKey)}</span>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: ev.revertedBy ? "line-through" : "none" }}>{summarizeEvent(ev, numbers)}</span>
                  {ev.revertedBy ? (
                    <span className="tag tag-outline" style={{ flex: "none" }}>{t("reverted")}</span>
                  ) : REVERTIBLE.has(ev.type) ? (
                    <button type="button" onClick={() => revert(ev.id)} className="btn btn-ghost" style={{ flex: "none" }}>
                      {t("revert")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
