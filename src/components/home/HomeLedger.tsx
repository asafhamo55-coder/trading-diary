"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, EyeOff, Eye, Pencil, Save, X, Building2, Search, Layers } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import HomeCategorySelect, { type Selection } from "@/components/home/HomeCategorySelect";
import {
  buildCategoryTree,
  type HomeAccountDTO,
  type HomeCategoryDTO,
  type HomeTransactionDTO,
  type PropertyOption,
} from "@/lib/home";

interface Pending {
  categoryId?: string | null;
  propertyId?: string | null;
  isExcluded?: boolean;
}

export default function HomeLedger({
  transactions,
  accounts,
  categories,
  properties,
  year,
}: {
  transactions: HomeTransactionDTO[];
  accounts: HomeAccountDTO[];
  categories: HomeCategoryDTO[];
  properties: PropertyOption[];
  year: number;
}) {
  const router = useRouter();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  // Staged (unsaved) edits, keyed by transaction id.
  const [pending, setPending] = useState<Map<string, Pending>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HomeTransactionDTO | null>(null);

  // Filters.
  const [filter, setFilter] = useState<"all" | "review" | "excluded">("all");
  const [accountFilter, setAccountFilter] = useState("");
  const [query, setQuery] = useState("");

  // "Apply to similar" prompt state.
  const [similar, setSimilar] = useState<{
    sel: Selection;
    merchant: string;
    ids: string[];
  } | null>(null);

  const reviewCount = useMemo(
    () => transactions.filter((t) => t.needsReview).length,
    [transactions]
  );
  const excludedCount = useMemo(
    () => transactions.filter((t) => t.isExcluded).length,
    [transactions]
  );

  const q = query.trim().toLowerCase();
  const filtered = transactions.filter((t) => {
    if (filter === "review" && !t.needsReview) return false;
    if (filter === "excluded" && !t.isExcluded) return false;
    if (accountFilter && t.homeAccountId !== accountFilter) return false;
    if (
      q &&
      !t.description.toLowerCase().includes(q) &&
      !t.rawDescription.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  function stage(id: string, patch: Pending) {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id), ...patch });
      return next;
    });
  }

  // Stage a category/property on a row; if it's under review and other review
  // rows share the same merchant, offer to apply to all of them.
  function handleSelect(tx: HomeTransactionDTO, sel: Selection) {
    stage(tx.id, { categoryId: sel.categoryId, propertyId: sel.propertyId });
    const isAssign = !!(sel.categoryId || sel.propertyId);
    if (isAssign && tx.needsReview && tx.merchantKey.length >= 3) {
      const others = transactions.filter(
        (t) =>
          t.id !== tx.id &&
          t.needsReview &&
          t.merchantKey === tx.merchantKey &&
          !pending.has(t.id)
      );
      if (others.length > 0) {
        setSimilar({ sel, merchant: tx.description, ids: others.map((t) => t.id) });
      }
    }
  }

  function applySimilar() {
    if (!similar) return;
    for (const id of similar.ids) {
      stage(id, { categoryId: similar.sel.categoryId, propertyId: similar.sel.propertyId });
    }
    setSimilar(null);
  }

  function effective(t: HomeTransactionDTO) {
    const p = pending.get(t.id);
    return {
      categoryId: p?.categoryId !== undefined ? p.categoryId : t.categoryId,
      propertyId: p?.propertyId !== undefined ? p.propertyId : t.propertyId,
      isExcluded: p?.isExcluded !== undefined ? p.isExcluded : t.isExcluded,
    };
  }

  async function saveAll() {
    if (pending.size === 0) return;
    setSaving(true);
    setSaveError(null);
    const updates = Array.from(pending.entries()).map(([id, p]) => ({ id, ...p }));
    try {
      const res = await fetch("/api/home/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        setPending(new Map());
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveError(d?.error || "Save failed — nothing was changed. Please try again.");
      }
    } catch {
      setSaveError("Save failed — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/home/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Transactions · {year}
        </h3>
        {pending.size > 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {pending.size} unsaved change{pending.size !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filters */}
      {transactions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterTab>
            <FilterTab active={filter === "review"} onClick={() => setFilter("review")}>
              Needs review{reviewCount > 0 ? ` (${reviewCount})` : ""}
            </FilterTab>
            <FilterTab active={filter === "excluded"} onClick={() => setFilter("excluded")}>
              Excluded{excludedCount > 0 ? ` (${excludedCount})` : ""}
            </FilterTab>
          </div>
          {accounts.length > 1 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-8 pr-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-2">
          No transactions yet. Import a statement or add a row to get started.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-2">
          No transactions match this filter.
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((t) => {
            const eff = effective(t);
            const dirty = pending.has(t.id);
            return (
              <Row
                key={t.id}
                tx={t}
                dirty={dirty}
                effective={eff}
                accountName={accountById.get(t.homeAccountId)?.name}
                propertyTitle={eff.propertyId ? propById.get(eff.propertyId)?.title : undefined}
                tree={tree}
                properties={properties}
                onSelect={(sel: Selection) => handleSelect(t, sel)}
                onToggleExclude={() => stage(t.id, { isExcluded: !eff.isExcluded })}
                onEdit={() => setEditing(t)}
                onDelete={() => remove(t.id)}
              />
            );
          })}
        </div>
      )}

      {/* Apply-to-similar prompt */}
      {similar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSimilar(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#00D68F]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Apply to similar?</h3>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              {similar.ids.length} other transaction{similar.ids.length !== 1 ? "s" : ""} from{" "}
              <span className="font-medium text-[var(--foreground)]">{similar.merchant}</span> {similar.ids.length !== 1 ? "are" : "is"} also
              under review. Apply the same to {similar.ids.length !== 1 ? "them" : "it"} too?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSimilar(null)}
                className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2"
              >
                Just this one
              </button>
              <button
                onClick={applySimilar}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14]"
                style={{ background: "#00D68F" }}
              >
                Apply to all {similar.ids.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky save bar */}
      {pending.size > 0 && (
        <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#00D68F]/40 bg-[var(--card)] px-4 py-3 shadow-lg">
          <span className="text-sm text-[var(--foreground)]">
            {saveError ? (
              <span className="text-[#FF4D6A]">{saveError}</span>
            ) : (
              <>
                {pending.size} change{pending.size !== 1 ? "s" : ""} not saved yet
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPending(new Map())}
              disabled={saving}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-1.5"
            >
              Discard
            </button>
            <button
              onClick={saveAll}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-[#0C0F14] disabled:opacity-60"
              style={{ background: "#00D68F" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      {editing && (
        <EditModal
          tx={editing}
          tree={tree}
          properties={properties}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-[#00D68F]/15 text-[#00D68F]"
          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      )}
    >
      {children}
    </button>
  );
}

function Row({
  tx,
  dirty,
  effective,
  accountName,
  propertyTitle,
  tree,
  properties,
  onSelect,
  onToggleExclude,
  onEdit,
  onDelete,
}: {
  tx: HomeTransactionDTO;
  dirty: boolean;
  effective: { categoryId: string | null; propertyId: string | null; isExcluded: boolean };
  accountName?: string;
  propertyTitle?: string;
  tree: ReturnType<typeof buildCategoryTree>;
  properties: PropertyOption[];
  onSelect: (sel: Selection) => void;
  onToggleExclude: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const out = tx.amount < 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--muted)] transition-colors group",
        effective.isExcluded && "opacity-55",
        dirty && "bg-[#00D68F]/5 ring-1 ring-[#00D68F]/30"
      )}
    >
      <span className="text-xs text-[var(--muted-foreground)] font-data w-12 shrink-0">
        {tx.date.slice(5)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--foreground)] truncate">{tx.description}</span>
          {tx.needsReview && !dirty && (
            <span className="text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[#FFB547]/15 text-[#FFB547] shrink-0">
              Review
            </span>
          )}
          {propertyTitle && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 bg-[#FFB547]/15 text-[#FFB547] shrink-0">
              <Building2 className="w-3 h-3" />
              {propertyTitle}
            </span>
          )}
          {effective.isExcluded && (
            <span className="text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
              Excluded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {accountName && <span className="truncate">{accountName}</span>}
          {tx.notes && <span className="truncate italic">· {tx.notes}</span>}
        </div>
      </div>
      <HomeCategorySelect
        tree={tree}
        properties={properties}
        categoryId={effective.categoryId}
        propertyId={effective.propertyId}
        onSelect={onSelect}
        className="hidden md:block max-w-[200px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none"
      />
      <span
        className={cn(
          "text-sm font-data font-semibold w-24 text-right shrink-0",
          effective.isExcluded
            ? "text-[var(--muted-foreground)]"
            : out
            ? "text-[#FF4D6A]"
            : "text-[#00D68F]"
        )}
      >
        {out ? "−" : "+"}
        {formatCurrency(Math.abs(tx.amount))}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleExclude}
          title={effective.isExcluded ? "Include in spending" : "Exclude (transfer / payment)"}
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors opacity-0 group-hover:opacity-100"
        >
          {effective.isExcluded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors opacity-0 group-hover:opacity-100"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[var(--card)] transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EditModal({
  tx,
  tree,
  properties,
  onClose,
  onSaved,
}: {
  tx: HomeTransactionDTO;
  tree: ReturnType<typeof buildCategoryTree>;
  properties: PropertyOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(tx.date);
  const [direction, setDirection] = useState<"OUT" | "IN">(tx.amount < 0 ? "OUT" : "IN");
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)));
  const [description, setDescription] = useState(tx.description);
  const [sel, setSel] = useState<Selection>({ categoryId: tx.categoryId, propertyId: tx.propertyId });
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const signed = (direction === "OUT" ? -1 : 1) * Math.abs(Number(amount));
    try {
      const res = await fetch(`/api/home/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          amount: signed,
          description,
          categoryId: sel.propertyId ? null : sel.categoryId,
          propertyId: sel.propertyId,
          notes: notes || null,
        }),
      });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Edit transaction</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Original: <span className="font-data">{tx.rawDescription}</span>
        </p>
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {(["OUT", "IN"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={cn(
                "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                direction === d
                  ? d === "IN" ? "bg-[#00D68F]/15 text-[#00D68F]" : "bg-[#FF4D6A]/15 text-[#FF4D6A]"
                  : "text-[var(--muted-foreground)]"
              )}
            >
              {d === "IN" ? "In" : "Out"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Amount</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Category / property</span>
          <HomeCategorySelect
            tree={tree}
            properties={properties}
            categoryId={sel.categoryId}
            propertyId={sel.propertyId}
            onSelect={setSel}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add clarity to this row" className={inputCls} />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60" style={{ background: "#00D68F" }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#00D68F]";
