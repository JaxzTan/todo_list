"use client";

import { Fragment, useState } from "react";
import { buildClientTree } from "@/lib/client/tree";
import { patchNode } from "@/lib/client/mutations";
import { useI18n } from "@/lib/client/i18n";
import { StatusPill } from "./StatusPill";
import { AddNodeDialog } from "./AddNodeDialog";
import { ReasonPrompt } from "./ReasonPrompt";
import type { NodeKind, NodeRecord, TreeNode } from "@/lib/client/types";

function EditableTitle({ title, onReword }: { title: string; onReword: (title: string, reason: string) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [reason, setReason] = useState("");

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} style={{ textAlign: "left", background: "none", border: 0, color: "inherit", font: "inherit", cursor: "pointer" }}>
        {title}
      </button>
    );
  }

  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-1)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && value.trim() !== title && reason.trim()) onReword(value.trim(), reason.trim());
        setEditing(false);
      }}
    >
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="input" style={{ width: "auto", fontSize: 13 }} />
      {value.trim() !== title && (
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} required className="input" style={{ width: 160, fontSize: 12 }} />
      )}
      <button type="submit" className="btn btn-ghost" style={{ fontSize: 12 }}>
        {t("save")}
      </button>
    </form>
  );
}

function AttrEditor({ node, slug, onChanged }: { node: NodeRecord; slug: string; onChanged: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-ghost" style={{ padding: "0 4px" }}>
        ⋯
      </button>
      {open && (
        <form
          className="popover"
          style={{ right: 0, top: "100%", marginTop: 4 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await patchNode(slug, node.id, {
              due: (form.get("due") as string) || null,
              prio: (form.get("prio") as never) || null,
              owner: (form.get("owner") as string) || null,
            });
            setOpen(false);
            onChanged();
          }}
        >
          <div className="field">
            <label htmlFor={`due-${node.id}`}>{t("due")}</label>
            <input id={`due-${node.id}`} name="due" type="date" defaultValue={node.due ? node.due.slice(0, 10) : ""} className="input" />
          </div>
          <div className="field" style={{ marginTop: "var(--space-2)" }}>
            <label htmlFor={`prio-${node.id}`}>{t("prio")}</label>
            <select id={`prio-${node.id}`} name="prio" defaultValue={node.prio ?? ""} className="input">
              <option value="">—</option>
              <option value="high">high</option>
              <option value="med">med</option>
              <option value="low">low</option>
            </select>
          </div>
          <div className="field" style={{ marginTop: "var(--space-2)" }}>
            <label htmlFor={`owner-${node.id}`}>{t("owner")}</label>
            <input id={`owner-${node.id}`} name="owner" defaultValue={node.owner ?? ""} className="input" />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            {t("save")}
          </button>
        </form>
      )}
    </div>
  );
}

function Rows({
  tree,
  depth,
  slug,
  visibleFields,
  doingId,
  blockerByNode,
  onStart,
  onChanged,
  onSelect,
  reorderable = false,
  underStep = false,
}: {
  tree: TreeNode[];
  depth: number;
  slug: string;
  visibleFields: string[];
  doingId: string | null;
  blockerByNode: Map<string, string>;
  onStart: (nodeId: string) => void;
  onChanged: () => void;
  onSelect: (nodeId: string) => void;
  // Drag-to-reorder among siblings — only true for a STEP's own children
  // (layer-3 subtasks), per the user's ask; top-level phases/tasks keep
  // their fixed creation order.
  reorderable?: boolean;
  // True when this row list is itself a STEP's children (layer-3 subtasks).
  // Used to label/limit the "add" affordance per layer: a layer-2 step can
  // add a subtask under it, but a layer-3 subtask is a leaf (no layer 4).
  underStep?: boolean;
}) {
  const { t } = useI18n();
  const [showAddFor, setShowAddFor] = useState<string | null>(null);
  const [cuttingId, setCuttingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const optionalCount = visibleFields.filter((f) => f === "due" || f === "prio" || f === "owner").length;
  // # + TASK + STATUS + optional cols + START — kept in sync with the <thead> in BoardTree.
  const totalCols = 4 + optionalCount;

  function reorderTo(draggedId: string, targetIndex: number) {
    patchNode(slug, draggedId, { position: targetIndex }).then(onChanged);
  }

  function rowDragProps(nodeId: string) {
    if (!reorderable) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", nodeId);
        e.dataTransfer.effectAllowed = "move";
        setDraggingId(nodeId);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setOverId(null);
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setOverId(nodeId),
      onDragLeave: () => setOverId((prev) => (prev === nodeId ? null : prev)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverId(null);
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === nodeId) return;
        const withoutDragged = tree.filter((x) => x.node.id !== draggedId);
        const targetIndex = withoutDragged.findIndex((x) => x.node.id === nodeId);
        if (targetIndex >= 0) reorderTo(draggedId, targetIndex);
      },
    };
  }

  return (
    <>
      {tree.map((item) => {
        const { node } = item;
        if (node.kind === "GROUP") {
          const done = countDone(item.children);
          return (
            <Fragment key={node.id}>
              <tr className="is-group">
                <td colSpan={2}>{node.title}</td>
                <td colSpan={1 + optionalCount} style={{ textAlign: "right" }}>
                  <span className="tag tag-neutral">
                    {done.done}/{done.total}
                  </span>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" title={t("details")} onClick={() => onSelect(node.id)} className="btn btn-ghost" style={{ padding: "0 4px" }}>
                    ⤢
                  </button>
                  {cuttingId === node.id ? (
                    <ReasonPrompt
                      placeholder={t("deletePhasePrompt")}
                      onSubmit={(reason) => {
                        setCuttingId(null);
                        patchNode(slug, node.id, { archived: true, reason }).then(onChanged);
                      }}
                      onCancel={() => setCuttingId(null)}
                    />
                  ) : (
                    <button type="button" title={t("deletePhase")} onClick={() => setCuttingId(node.id)} className="btn btn-ghost" style={{ padding: "0 4px" }}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
              <Rows
                tree={item.children}
                depth={depth + 1}
                slug={slug}
                visibleFields={visibleFields}
                doingId={doingId}
                blockerByNode={blockerByNode}
                onStart={onStart}
                onChanged={onChanged}
                onSelect={onSelect}
                underStep={false}
              />
              <tr>
                <td colSpan={totalCols}>
                  {showAddFor === node.id ? (
                    <AddNodeDialog slug={slug} kind="STEP" parentId={node.id} onClose={() => setShowAddFor(null)} onAdded={() => { setShowAddFor(null); onChanged(); }} />
                  ) : (
                    <button type="button" onClick={() => setShowAddFor(node.id)} className="btn btn-ghost" style={{ paddingInline: 0, fontSize: 12 }}>
                      + {t("addStep")}
                    </button>
                  )}
                </td>
              </tr>
            </Fragment>
          );
        }

        const isDoing = node.id === doingId;
        const blocker = blockerByNode.get(node.id);
        return (
          <Fragment key={node.id}>
            <tr
              className={isDoing ? "is-active" : undefined}
              {...rowDragProps(node.id)}
              style={{
                cursor: reorderable ? "grab" : undefined,
                opacity: draggingId === node.id ? 0.4 : 1,
                boxShadow: overId === node.id ? "inset 0 2px 0 var(--color-accent)" : undefined,
              }}
            >
              <td style={{ color: "var(--ui-muted)", fontVariantNumeric: "tabular-nums" }}>{item.number}</td>
              <td style={{ paddingLeft: `calc(var(--space-4) * ${depth})` }}>
                <EditableTitle title={node.title} onReword={(title, reason) => patchNode(slug, node.id, { title, reason }).then(onChanged)} />
              </td>
              <td>
                <StatusPill status={node.status} onChange={(status, blocker) => patchNode(slug, node.id, { status, blocker }).then(onChanged)} />
              </td>
              {visibleFields.includes("due") && <td style={{ fontVariantNumeric: "tabular-nums" }}>{node.due ? node.due.slice(0, 10) : "—"}</td>}
              {visibleFields.includes("prio") && <td>{node.prio ?? "—"}</td>}
              {visibleFields.includes("owner") && <td>{node.owner ?? "—"}</td>}
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {isDoing ? (
                  <span className="text-muted" style={{ fontSize: 13 }}>{t("slot")}</span>
                ) : (
                  <button type="button" onClick={() => onStart(node.id)} className="btn btn-ghost" style={{ fontSize: 13 }}>
                    {t("start")}
                  </button>
                )}
                <button type="button" title={t("details")} onClick={() => onSelect(node.id)} className="btn btn-ghost" style={{ padding: "0 4px" }}>
                  ⤢
                </button>
                <AttrEditor node={node} slug={slug} onChanged={onChanged} />
                {cuttingId === node.id ? (
                  <ReasonPrompt
                    placeholder={t("cutStepPrompt")}
                    onSubmit={(reason) => {
                      setCuttingId(null);
                      patchNode(slug, node.id, { archived: true, reason }).then(onChanged);
                    }}
                    onCancel={() => setCuttingId(null)}
                  />
                ) : (
                  <button type="button" title="cut" onClick={() => setCuttingId(node.id)} className="btn btn-ghost" style={{ padding: "0 4px" }}>
                    ✕
                  </button>
                )}
              </td>
            </tr>
            {node.status === "stuck" && visibleFields.includes("blocker") && blocker && (
              <tr>
                <td />
                <td colSpan={totalCols - 1} style={{ paddingLeft: `calc(var(--space-4) * ${depth})`, fontSize: 12, color: "var(--color-danger)" }}>
                  ⚑ {blocker}
                </td>
              </tr>
            )}
            {item.children.length > 0 && (
              <Rows
                tree={item.children}
                depth={depth + 1}
                slug={slug}
                visibleFields={visibleFields}
                doingId={doingId}
                blockerByNode={blockerByNode}
                onStart={onStart}
                onChanged={onChanged}
                onSelect={onSelect}
                reorderable
                underStep
              />
            )}
            {!underStep && (
              <tr>
                <td />
                <td colSpan={totalCols - 1}>
                  {showAddFor === node.id ? (
                    <AddNodeDialog slug={slug} kind="STEP" parentId={node.id} onClose={() => setShowAddFor(null)} onAdded={() => { setShowAddFor(null); onChanged(); }} />
                  ) : (
                    <button type="button" onClick={() => setShowAddFor(node.id)} className="btn btn-ghost" style={{ paddingInline: 0, fontSize: 12 }}>
                      + {t("addSubtask")}
                    </button>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {reorderable && tree.length > 0 && (
        <tr
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/plain");
            if (!draggedId) return;
            const withoutDragged = tree.filter((x) => x.node.id !== draggedId);
            reorderTo(draggedId, withoutDragged.length);
          }}
        >
          <td colSpan={totalCols} style={{ height: 6, padding: 0 }} />
        </tr>
      )}
    </>
  );
}

function countDone(children: TreeNode[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const c of children) {
    if (c.node.kind === "STEP") {
      total += 1;
      if (c.node.status === "done" || c.node.status === "skipped") done += 1;
    }
    const nested = countDone(c.children);
    done += nested.done;
    total += nested.total;
  }
  return { done, total };
}

export function BoardTree({
  nodes,
  blockers,
  visibleFields,
  slug,
  onChanged,
  onSelect,
}: {
  nodes: NodeRecord[];
  blockers: { nodeId: string; description: string }[];
  visibleFields: string[];
  slug: string;
  onChanged: () => void;
  onSelect: (nodeId: string) => void;
}) {
  const { t } = useI18n();
  const tree = buildClientTree(nodes);
  const [addKind, setAddKind] = useState<NodeKind | null>(null);
  const doingNode = nodes.find((n) => n.kind === "STEP" && n.status === "doing") ?? null;
  const doingItem = doingNode ? findByNode(tree, doingNode.id) : null;
  const blockerByNode = new Map(blockers.map((b) => [b.nodeId, b.description]));

  async function onStart(nodeId: string) {
    if (doingNode && doingNode.id !== nodeId) {
      await patchNode(slug, doingNode.id, { status: "todo" });
    }
    await patchNode(slug, nodeId, { status: "doing" });
    onChanged();
  }

  const optionalCols = visibleFields.filter((f) => f === "due" || f === "prio" || f === "owner");

  return (
    <div>
      {doingItem && doingNode && (
        <div className="card" style={{ background: "var(--ui-tint)", border: "1px dashed var(--ui-tint-edge)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="card-kicker">{t("doingSlot")}</span>
            <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{doingItem.number}</span>
            <span style={{ fontWeight: 500 }}>{doingNode.title}</span>
          </div>
          <span className="text-muted" style={{ fontSize: 12 }}>{t("doingSlotHint")}</span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="table" role="table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>{t("colNumber")}</th>
              <th>{t("colTask")}</th>
              <th>{t("colStatus")}</th>
              {optionalCols.includes("due") && <th>{t("colDue")}</th>}
              {optionalCols.includes("prio") && <th>{t("colPrio")}</th>}
              {optionalCols.includes("owner") && <th>{t("owner")}</th>}
              <th style={{ textAlign: "right" }}>{t("colStart")}</th>
            </tr>
          </thead>
          <tbody>
            <Rows
              tree={tree}
              depth={0}
              slug={slug}
              visibleFields={visibleFields}
              doingId={doingNode?.id ?? null}
              blockerByNode={blockerByNode}
              onStart={onStart}
              onChanged={onChanged}
              onSelect={onSelect}
            />
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-4)" }}>
        <button type="button" onClick={() => setAddKind("STEP")} className="btn btn-ghost" style={{ paddingInline: 0 }}>
          + {t("addStep")}
        </button>
        <button type="button" onClick={() => setAddKind("GROUP")} className="btn btn-ghost" style={{ paddingInline: 0 }}>
          + {t("addGroup")}
        </button>
      </div>

      {addKind && (
        <AddNodeDialog slug={slug} kind={addKind} onClose={() => setAddKind(null)} onAdded={() => { setAddKind(null); onChanged(); }} />
      )}
    </div>
  );
}

function findByNode(tree: TreeNode[], nodeId: string): TreeNode | null {
  for (const item of tree) {
    if (item.node.id === nodeId) return item;
    const found = findByNode(item.children, nodeId);
    if (found) return found;
  }
  return null;
}
