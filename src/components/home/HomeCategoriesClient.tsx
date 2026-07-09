"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Check, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCategoryTree, type HomeCategoryDTO, type HomeCategoryKind } from "@/lib/home";

const KIND_LABEL: Record<HomeCategoryKind, string> = {
  SPENDING: "Spending",
  INCOME: "Income",
  TRANSFER: "Transfer",
};

export default function HomeCategoriesClient({
  categories,
}: {
  categories: HomeCategoryDTO[];
}) {
  const router = useRouter();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const [addingParent, setAddingParent] = useState(false);
  const [newParent, setNewParent] = useState("");
  const [newKind, setNewKind] = useState<HomeCategoryKind>("SPENDING");
  const [busy, setBusy] = useState(false);

  async function createCategory(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/home/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addParent(e: React.FormEvent) {
    e.preventDefault();
    if (!newParent.trim()) return;
    await createCategory({ name: newParent.trim(), kind: newKind });
    setNewParent("");
    setAddingParent(false);
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#00D68F]" />
            Categories
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Two-level groups used to categorize your spending. Rename, add, or remove freely.
          </p>
        </div>
        {!addingParent && (
          <button
            onClick={() => setAddingParent(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#0C0F14]"
            style={{ background: "#00D68F" }}
          >
            <Plus className="w-4 h-4" />
            Add group
          </button>
        )}
      </div>

      {addingParent && (
        <form onSubmit={addParent} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-end gap-3 flex-wrap">
          <label className="block flex-1 min-w-[180px]">
            <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Group name</span>
            <input autoFocus value={newParent} onChange={(e) => setNewParent(e.target.value)} placeholder="e.g. Pets" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Kind</span>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as HomeCategoryKind)} className={inputCls}>
              {(["SPENDING", "INCOME", "TRANSFER"] as const).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60" style={{ background: "#00D68F" }}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Add
            </button>
            <button type="button" onClick={() => setAddingParent(false)} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {tree.map((parent) => (
          <ParentGroup key={parent.id} parent={parent} onChange={() => router.refresh()} onAddChild={createCategory} />
        ))}
      </div>
    </div>
  );
}

function ParentGroup({
  parent,
  onChange,
  onAddChild,
}: {
  parent: ReturnType<typeof buildCategoryTree>[number];
  onChange: () => void;
  onAddChild: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [newChild, setNewChild] = useState("");
  const [busy, setBusy] = useState(false);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!newChild.trim()) return;
    setBusy(true);
    await onAddChild({ name: newChild.trim(), parentId: parent.id });
    setNewChild("");
    setBusy(false);
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: parent.color ?? "#64748B" }} />
        <EditableName id={parent.id} name={parent.name} onChange={onChange} strong />
        <span className="text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)]">
          {KIND_LABEL[parent.kind]}
        </span>
        <div className="flex-1" />
        <DeleteButton id={parent.id} onChange={onChange} title="Delete group and its subcategories" />
      </div>
      <div className="flex flex-wrap gap-2 pl-5">
        {parent.children.map((c) => (
          <div key={c.id} className="group inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-2.5 pr-1.5 py-1">
            <EditableName id={c.id} name={c.name} onChange={onChange} />
            <DeleteButton id={c.id} onChange={onChange} small title="Delete subcategory" />
          </div>
        ))}
        <form onSubmit={addChild} className="inline-flex items-center gap-1">
          <input
            value={newChild}
            onChange={(e) => setNewChild(e.target.value)}
            placeholder="+ subcategory"
            className="w-32 rounded-lg border border-dashed border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:border-[#00D68F]"
          />
          {newChild.trim() && (
            <button type="submit" disabled={busy} className="p-1 text-[#00D68F]">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function EditableName({
  id,
  name,
  onChange,
  strong,
}: {
  id: string;
  name: string;
  onChange: () => void;
  strong?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value.trim() || value === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/home/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim() }),
      });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setEditing(false); setValue(name); }
          }}
          className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#00D68F]"
        />
        <button onClick={save} disabled={busy} className="p-0.5 text-[#00D68F]">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setEditing(false); setValue(name); }} className="p-0.5 text-[var(--muted-foreground)]">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "text-left hover:underline decoration-dotted",
        strong ? "text-sm font-semibold text-[var(--foreground)]" : "text-xs text-[var(--foreground)]"
      )}
    >
      {name}
    </button>
  );
}

function DeleteButton({
  id,
  onChange,
  small,
  title,
}: {
  id: string;
  onChange: () => void;
  small?: boolean;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/home/categories/${id}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={remove}
      disabled={busy}
      title={title}
      className={cn(
        "text-[var(--muted-foreground)] hover:text-[#FF4D6A] transition-opacity",
        small ? "opacity-0 group-hover:opacity-100" : ""
      )}
    >
      {busy ? <Loader2 className={small ? "w-3.5 h-3.5 animate-spin" : "w-4 h-4 animate-spin"} /> : <Trash2 className={small ? "w-3.5 h-3.5" : "w-4 h-4"} />}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#00D68F]";
