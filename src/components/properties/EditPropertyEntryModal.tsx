"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  type PropertyTransactionDTO,
} from "@/lib/property";

export default function EditPropertyEntryModal({
  propertyId,
  tx,
  onClose,
  onSaved,
}: {
  propertyId: string;
  tx: PropertyTransactionDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<"INCOME" | "EXPENSE">(tx.type);
  const [date, setDate] = useState(tx.date);
  const [category, setCategory] = useState(tx.category);
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function switchType(t: "INCOME" | "EXPENSE") {
    setType(t);
    const list = t === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!list.some((c) => c.key === category)) setCategory(list[0].key);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type,
          category,
          amount: Number(amount),
          description: description || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to save entry");
      }
      onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Edit entry</h3>
          <button type="button" onClick={onClose} className="pressable text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                type === t
                  ? t === "INCOME"
                    ? "bg-[#00D68F]/15 text-[#00D68F]"
                    : "bg-[#FF4D6A]/15 text-[#FF4D6A]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {t === "INCOME" ? "Income" : "Expense"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Date</span>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Amount</span>
            <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {cats.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Description (optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. July rent" className={inputCls} />
        </label>

        {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="pressable text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">Cancel</button>
          <button type="submit" disabled={saving} className="pressable inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#FFB547]";
