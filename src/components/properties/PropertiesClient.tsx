"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Plus,
  MapPin,
  X,
  Loader2,
  Archive,
  ArchiveRestore,
  ChevronDown,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";

interface Row {
  id: string;
  title: string;
  address: string;
  archived: boolean;
  txCount: number;
  income: number;
  expenses: number;
  net: number;
}

export default function PropertiesClient({
  rows,
  year,
  availableYears,
}: {
  rows: Row[];
  year: number;
  availableYears: number[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    street: "",
    unit: "",
    city: "",
    state: "",
    zip: "",
    purchasePrice: "",
    purchaseDate: "",
  });

  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeRows = rows.filter((r) => !r.archived);
  const archivedRows = rows.filter((r) => r.archived);

  const grandNet = activeRows.reduce((sum, r) => sum + r.net, 0);
  const grandIncome = activeRows.reduce((sum, r) => sum + r.income, 0);
  const grandExpenses = activeRows.reduce((sum, r) => sum + r.expenses, 0);

  async function setArchived(id: string, archived: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: form.street,
          unit: form.unit || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
          purchaseDate: form.purchaseDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to add property");
      }
      setForm({
        street: "",
        unit: "",
        city: "",
        state: "",
        zip: "",
        purchasePrice: "",
        purchaseDate: "",
      });
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add property");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "#FFB5471A" }}
          >
            <Building2 className="w-5 h-5" style={{ color: "#FFB547" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Properties</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Rental income & expenses · tax-ready · {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <YearPicker years={availableYears} selected={year} />
          <button
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-3 py-2 text-sm font-medium text-[#0C0F14] hover:bg-[#FFB547]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add property
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={handleCreate}
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">New property</h3>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <div className="sm:col-span-4">
              <Field label="Street & number">
                <input
                  required
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  placeholder="123 Maple St"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Unit # (optional)">
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="4B"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="City">
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Springfield"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="State">
                <input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  placeholder="CA"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="ZIP code">
                <input
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  placeholder="90210"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Purchase price (optional)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  placeholder="450000"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Purchase date (optional)">
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
          {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-4 py-2 text-sm font-medium text-[#0C0F14] hover:bg-[#FFB547]/90 transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save property
            </button>
          </div>
        </form>
      )}

      {/* Portfolio summary */}
      {activeRows.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <SummaryTile label={`Income · ${year}`} value={grandIncome} tone="pos" />
          <SummaryTile label={`Expenses · ${year}`} value={grandExpenses} tone="neg" />
          <SummaryTile label={`Net · ${year}`} value={grandNet} tone="net" />
        </div>
      )}

      {/* Active property list */}
      {activeRows.length === 0 ? (
        archivedRows.length === 0 && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-12 text-center">
            <Building2 className="w-12 h-12 text-[var(--border)] mx-auto mb-4" />
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">
              No properties yet
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              Add a property, then log its rental income and expenses for the year.
            </p>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-4 py-2 text-sm font-medium text-[#0C0F14] hover:bg-[#FFB547]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add your first property
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeRows.map((r) => (
            <PropertyCard
              key={r.id}
              row={r}
              busy={busyId === r.id}
              onArchive={() => setArchived(r.id, true)}
            />
          ))}
        </div>
      )}

      {/* Archived */}
      {archivedRows.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                showArchived ? "rotate-0" : "-rotate-90"
              )}
            />
            Archived ({archivedRows.length})
          </button>
          {showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              {archivedRows.map((r) => (
                <PropertyCard
                  key={r.id}
                  row={r}
                  busy={busyId === r.id}
                  onUnarchive={() => setArchived(r.id, false)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PropertyCard({
  row: r,
  busy,
  onArchive,
  onUnarchive,
}: {
  row: Row;
  busy: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 transition-colors",
        r.archived ? "opacity-70" : "hover:border-[#FFB547]/50"
      )}
    >
      <Link href={`/properties/${r.id}`} className="block">
        <div className="mb-3 pr-9">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
              {r.title}
            </h3>
            {r.archived && (
              <span className="text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)]">
                Archived
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] truncate mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            {r.address}
          </p>
        </div>
        <p
          className={cn(
            "text-2xl font-bold font-data",
            r.net >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
          )}
        >
          {r.net >= 0 ? "+" : ""}
          {formatCurrency(r.net)}
        </p>
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mt-2">
          <span>
            {formatCurrency(r.income)} in · {formatCurrency(r.expenses)} out
          </span>
          <span>
            {r.txCount} entr{r.txCount !== 1 ? "ies" : "y"}
          </span>
        </div>
      </Link>
      {/* Archive / unarchive control (outside the Link so it doesn't navigate) */}
      {(onArchive || onUnarchive) && (
        <button
          onClick={onArchive ?? onUnarchive}
          disabled={busy}
          title={onArchive ? "Archive property" : "Restore property"}
          className="absolute top-4 right-4 p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : onArchive ? (
            <Archive className="w-4 h-4" />
          ) : (
            <ArchiveRestore className="w-4 h-4" />
          )}
        </button>
      )}
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

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pos" | "neg" | "net";
}) {
  const color =
    tone === "pos"
      ? "text-[#00D68F]"
      : tone === "neg"
      ? "text-[#FF4D6A]"
      : value >= 0
      ? "text-[#00D68F]"
      : "text-[#FF4D6A]";
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
      <p className={cn("text-lg md:text-xl font-bold font-data", color)}>
        {tone === "net" && value >= 0 ? "+" : ""}
        {formatCurrency(value)}
      </p>
    </div>
  );
}
