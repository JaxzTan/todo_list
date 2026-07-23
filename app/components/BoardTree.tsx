"use client";

import { useState } from "react";
import { buildClientTree } from "@/lib/client/tree";
import { addNode, patchNode } from "@/lib/client/mutations";
import { useI18n } from "@/lib/client/i18n";
import { StatusPill } from "./StatusPill";
import type { NodeRecord, TreeNode } from "@/lib/client/types";

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-md px-2 py-1 text-left text-xs"
        style={{ color: "var(--muted)" }}
      >
        + {placeholder}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAdd(value.trim());
        setValue("");
        setEditing(false);
      }}
      className="flex gap-1.5"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setEditing(false);
        }}
        placeholder={placeholder}
        className="rounded-md border px-2 py-1 text-xs"
        style={{ borderColor: "var(--border)", background: "var(--card2)" }}
      />
    </form>
  );
}

function EditableTitle({
  title,
  onReword,
}: {
  title: string;
  onReword: (title: string, reason: string) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [reason, setReason] = useState("");

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-left text-sm">
        {title}
      </button>
    );
  }

  return (
    <form
      className="flex flex-1 flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && value.trim() !== title && reason.trim()) {
          onReword(value.trim(), reason.trim());
        }
        setEditing(false);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--card2)" }}
      />
      {value.trim() !== title && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          required
          className="rounded-md border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--card2)" }}
        />
      )}
      <button type="submit" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
        {t("save")}
      </button>
    </form>
  );
}

function AttrEditor({
  node,
  slug,
  onChanged,
}: {
  node: NodeRecord;
  slug: string;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded px-1.5 py-0.5 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        ⋯
      </button>
      {open && (
        <form
          className="absolute top-full right-0 z-20 mt-1 w-56 rounded-lg border p-3 shadow-md"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
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
          <label htmlFor={`due-${node.id}`} className="block text-[10px] font-medium" style={{ color: "var(--muted)" }}>
            {t("due")}
          </label>
          <input
            id={`due-${node.id}`}
            name="due"
            type="date"
            defaultValue={node.due ? node.due.slice(0, 10) : ""}
            className="mt-0.5 w-full rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}
          />
          <label htmlFor={`prio-${node.id}`} className="mt-2 block text-[10px] font-medium" style={{ color: "var(--muted)" }}>
            {t("prio")}
          </label>
          <select
            id={`prio-${node.id}`}
            name="prio"
            defaultValue={node.prio ?? ""}
            className="mt-0.5 w-full rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}
          >
            <option value="">—</option>
            <option value="high">high</option>
            <option value="med">med</option>
            <option value="low">low</option>
          </select>
          <label htmlFor={`owner-${node.id}`} className="mt-2 block text-[10px] font-medium" style={{ color: "var(--muted)" }}>
            {t("owner")}
          </label>
          <input
            id={`owner-${node.id}`}
            name="owner"
            defaultValue={node.owner ?? ""}
            className="mt-0.5 w-full rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--card2)" }}
          />
          <button
            type="submit"
            className="mt-2.5 w-full rounded-md py-1 text-[11px] font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {t("save")}
          </button>
        </form>
      )}
    </div>
  );
}

function Row({ tree, slug, onChanged }: { tree: TreeNode; slug: string; onChanged: () => void }) {
  const { node } = tree;
  const isGroup = node.kind === "GROUP";

  if (isGroup) {
    return (
      <div className="mt-4 first:mt-0">
        <h3 className="px-1 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>
          {node.title}
        </h3>
        <div className="mt-1.5 flex flex-col gap-1 border-l pl-3" style={{ borderColor: "var(--border)" }}>
          {tree.children.map((child) => (
            <Row key={child.node.id} tree={child} slug={slug} onChanged={onChanged} />
          ))}
          <AddRow placeholder="add step" onAdd={(title) => addNode(slug, { kind: "STEP", title, parentId: node.id }).then(onChanged)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
        style={{ background: "var(--card)" }}
      >
        <span className="w-6 shrink-0 text-right text-[11px]" style={{ color: "var(--muted)" }}>
          {tree.number}
        </span>
        <StatusPill
          status={node.status}
          onChange={(status, blocker) => patchNode(slug, node.id, { status, blocker }).then(onChanged)}
        />
        <div className="min-w-0 flex-1">
          <EditableTitle
            title={node.title}
            onReword={(title, reason) => patchNode(slug, node.id, { title, reason }).then(onChanged)}
          />
        </div>
        {node.due && (
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>
            {node.due.slice(0, 10)}
          </span>
        )}
        {node.prio && (
          <span className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>
            {node.prio}
          </span>
        )}
        {node.owner && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ background: "var(--card2)", color: "var(--muted)" }}
          >
            {node.owner}
          </span>
        )}
        <AttrEditor node={node} slug={slug} onChanged={onChanged} />
        <button
          type="button"
          title="cut"
          onClick={() => {
            const reason = window.prompt("reason for cutting this step?");
            if (reason) patchNode(slug, node.id, { archived: true, reason }).then(onChanged);
          }}
          className="text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          ✕
        </button>
      </div>

      {tree.children.length > 0 && (
        <div className="mt-1 ml-8 flex flex-col gap-1 border-l pl-3" style={{ borderColor: "var(--border)" }}>
          {tree.children.map((child) => (
            <Row key={child.node.id} tree={child} slug={slug} onChanged={onChanged} />
          ))}
        </div>
      )}
      <div className="ml-8 pl-3">
        <AddRow
          placeholder="add subtask"
          onAdd={(title) => addNode(slug, { kind: "STEP", title, parentId: node.id }).then(onChanged)}
        />
      </div>
    </div>
  );
}

export function BoardTree({ nodes, slug, onChanged }: { nodes: NodeRecord[]; slug: string; onChanged: () => void }) {
  const { t } = useI18n();
  const tree = buildClientTree(nodes);

  return (
    <div className="flex flex-col gap-1">
      {tree.map((t) => (
        <Row key={t.node.id} tree={t} slug={slug} onChanged={onChanged} />
      ))}
      <div className="mt-3 flex gap-3">
        <AddRow placeholder={t("addStep")} onAdd={(title) => addNode(slug, { kind: "STEP", title }).then(onChanged)} />
        <AddRow placeholder={t("addGroup")} onAdd={(title) => addNode(slug, { kind: "GROUP", title }).then(onChanged)} />
      </div>
    </div>
  );
}
