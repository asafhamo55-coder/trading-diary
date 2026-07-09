"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  FileText,
  MapPin,
  X,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";
import TenantsSection from "@/components/properties/TenantsSection";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  categoryLabel,
  getCategory,
  type PropertyYearSummary,
  type PropertyTransactionDTO,
  type TenantDTO,
} from "@/lib/property";

interface PropertyInfo {
  id: string;
  nickname: string;
  address: string;
  purchasePrice: number | null;
  purchaseDate: string | null;
  notes: string | null;
}

export default function PropertyDetailClient({
  property,
  year,
  availableYears,
  summary,
  transactions,
  tenants,
  today,
}: {
  property: PropertyInfo;
  year: number;
  availableYears: number[];
  summary: PropertyYearSummary;
  transactions: PropertyTransactionDTO[];
  tenants: TenantDTO[];
  today: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingProperty, setDeletingProperty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    date: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    category: EXPENSE_CATEGORIES[0].key,
    amount: "",
    description: "",
  });

  const activeCategories =
    form.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function setType(type: "INCOME" | "EXPENSE") {
    const cats = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    setForm((f) => ({ ...f, type, category: cats[0].key }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${property.id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          type: form.type,
          category: form.category,
          amount: Number(form.amount),
          description: form.description || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to add entry");
      }
      setForm((f) => ({ ...f, amount: "", description: "" }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTx(txId: string) {
    try {
      const res = await fetch(
        `/api/properties/${property.id}/transactions/${txId}`,
        { method: "DELETE" }
      );
      if (res.ok) router.refresh();
    } catch {
      /* ignore */
    }
  }

  async function handleDeleteProperty() {
    setDeletingProperty(true);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/properties");
        router.refresh();
      }
    } finally {
      setDeletingProperty(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link
            href="/properties"
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            All properties
          </Link>
          <h1 className="text-2xl font-bold text-[var(--foreground)] truncate">
            {property.nickname}
          </h1>
          <p className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {property.address}
          </p>
        </div>
        <YearPicker years={availableYears} selected={year} />
      </div>

      {/* Tenants */}
      <TenantsSection
        propertyId={property.id}
        tenants={tenants}
        today={today}
      />

      {/* Tax summary */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-[#FFB547]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Tax summary · {year}
          </h3>
          <span className="text-xs text-[var(--muted-foreground)]">
            · Schedule E style
          </span>
        </div>

        {summary.byCategory.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4">
            No entries for {year} yet. Add rental income and expenses below.
          </p>
        ) : (
          <div className="space-y-4">
            <SummaryGroup
              title="Income"
              rows={summary.byCategory.filter((c) => c.type === "INCOME")}
              total={summary.income}
              tone="pos"
            />
            <SummaryGroup
              title="Expenses"
              rows={summary.byCategory.filter((c) => c.type === "EXPENSE")}
              total={summary.expenses}
              tone="neg"
            />
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Net operating income
              </span>
              <span
                className={cn(
                  "text-lg font-bold font-data",
                  summary.net >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                )}
              >
                {summary.net >= 0 ? "+" : ""}
                {formatCurrency(summary.net)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add entry */}
      <form
        onSubmit={handleAdd}
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Add entry</h3>
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                form.type === t
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Date">
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputCls}
            >
              {activeCategories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className={inputCls}
            />
          </Field>
          <Field label="Description (optional)">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. July rent"
              className={inputCls}
            />
          </Field>
        </div>
        {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-4 py-2 text-sm font-medium text-[#0C0F14] hover:bg-[#FFB547]/90 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add entry
          </button>
        </div>
      </form>

      {/* Transactions list */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Entries · {year}
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-2">
            No entries recorded for {year}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
                  <th className="text-left pb-3 font-medium">Date</th>
                  <th className="text-left pb-3 font-medium">Category</th>
                  <th className="text-left pb-3 font-medium hidden sm:table-cell">Description</th>
                  <th className="text-right pb-3 font-medium">Amount</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-[#2A3040]/40 last:border-0 group">
                    <td className="py-2.5 text-[var(--muted-foreground)] font-data whitespace-nowrap">
                      {t.date.slice(5)}
                    </td>
                    <td className="py-2.5 text-[var(--foreground)]">
                      {categoryLabel(t.category)}
                    </td>
                    <td className="py-2.5 text-[var(--muted-foreground)] hidden sm:table-cell truncate max-w-[200px]">
                      {t.description || "—"}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-data font-semibold whitespace-nowrap",
                        t.type === "INCOME" ? "text-[#00D68F]" : "text-[#FF4D6A]"
                      )}
                    >
                      {t.type === "INCOME" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteTx(t.id)}
                        aria-label="Delete entry"
                        className="text-[var(--muted-foreground)] hover:text-[#FF4D6A] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--muted-foreground)]">Delete this property and all entries?</span>
            <button
              onClick={handleDeleteProperty}
              disabled={deletingProperty}
              className="inline-flex items-center gap-1 rounded-lg bg-[#FF4D6A] px-3 py-1.5 font-medium text-white hover:bg-[#FF4D6A]/90 disabled:opacity-60"
            >
              {deletingProperty && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[#FF4D6A] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete property
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#FFB547]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryGroup({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: { key: string; label: string; total: number }[];
  total: number;
  tone: "pos" | "neg";
}) {
  if (rows.length === 0) return null;
  const color = tone === "pos" ? "text-[#00D68F]" : "text-[#FF4D6A]";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {title}
        </span>
        <span className={cn("text-sm font-data font-semibold", color)}>
          {formatCurrency(total)}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => {
          const cat = getCategory(r.key);
          return (
            <div key={r.key} className="flex items-center justify-between text-sm">
              <span className="text-[var(--foreground)]">
                {r.label}
                {cat?.taxLine && (
                  <span className="text-[var(--muted-foreground)] text-xs ml-2">
                    {cat.taxLine}
                  </span>
                )}
              </span>
              <span className="font-data text-[var(--muted-foreground)]">
                {formatCurrency(r.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
