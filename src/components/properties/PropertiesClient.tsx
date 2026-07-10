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
  ArrowUp,
  ArrowDown,
  CircleAlert,
} from "lucide-react";
import { cn, formatCurrency, signedClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, SummaryTile, inputCls } from "@/components/properties/shared";
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
  monthlyNet: number[];
  hasTenants: boolean;
  occupiedMonths: number;
  occupancyMonths: number;
  occupancyPct: number | null;
  currentTenantName: string | null;
  monthlyRent: number | null;
  purchasePrice: number | null;
  yieldPct: number | null;
}

export default function PropertiesClient({
  rows,
  year,
  availableYears,
  elapsed,
}: {
  rows: Row[];
  year: number;
  availableYears: number[];
  elapsed: number;
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

  const grandIncome = activeRows.reduce((sum, r) => sum + r.income, 0);
  const grandExpenses = activeRows.reduce((sum, r) => sum + r.expenses, 0);
  const grandNet = activeRows.reduce((sum, r) => sum + r.net, 0);

  // Portfolio occupancy = Σ occupied months / Σ tracked months across active props.
  const occupiedSum = activeRows.reduce((s, r) => s + r.occupiedMonths, 0);
  const monthsSum = activeRows.reduce((s, r) => s + r.occupancyMonths, 0);
  const occupancyPct = monthsSum > 0 ? Math.round((occupiedSum / monthsSum) * 100) : null;

  // Portfolio avg yield = annualized Σ net (of priced props) / Σ purchase price.
  const priceSum = activeRows.reduce((s, r) => s + (r.purchasePrice ?? 0), 0);
  const netWithPrice = activeRows.reduce(
    (s, r) => s + (r.purchasePrice ? r.net : 0),
    0
  );
  const avgYield =
    priceSum > 0 && elapsed > 0
      ? ((netWithPrice / elapsed) * 12 / priceSum) * 100
      : null;

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
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-amber/10">
            <Building2 className="w-5 h-5 text-accent-amber" />
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
          <Button onClick={() => setAdding((a) => !a)}>
            <Plus className="w-4 h-4" />
            Add property
          </Button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={handleCreate}
          className="bg-[var(--card)] border border-[var(--border)] border-t-2 border-t-accent-amber/40 rounded-xl p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">New property</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setAdding(false)}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <div className="sm:col-span-4">
              <Field label="Street & number" required>
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
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
              <CircleAlert className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save property
            </Button>
          </div>
        </form>
      )}

      {/* Portfolio KPI strip */}
      {activeRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryTile label="Properties" value={activeRows.length} variant="count" />
          <SummaryTile
            label="Occupied"
            value={`${occupiedSum}/${monthsSum}`}
            variant="count"
            caption={occupancyPct !== null ? `${occupancyPct}% of months` : "—"}
          />
          <SummaryTile
            label="Avg yield"
            value={avgYield !== null ? `${avgYield.toFixed(1)}%` : "—"}
            variant="percent"
          />
          <SummaryTile label={`Income · ${year}`} value={grandIncome} tone="pos" />
          <SummaryTile label={`Expenses · ${year}`} value={grandExpenses} tone="neg" />
          <SummaryTile label={`Net · ${year}`} value={grandNet} tone="net" />
        </div>
      )}

      {/* Active property list */}
      {activeRows.length === 0 ? (
        archivedRows.length === 0 && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-12 text-center">
            <Building2 className="w-12 h-12 text-[var(--border)] mx-auto mb-4" />
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">
              No properties yet
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              Add a property, then log its rental income and expenses for the year.
            </p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" />
              Add your first property
            </Button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeRows.map((r) => (
            <PropertyCard
              key={r.id}
              row={r}
              elapsed={elapsed}
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
                  elapsed={elapsed}
                  compact
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
  elapsed,
  busy,
  compact,
  onArchive,
  onUnarchive,
}: {
  row: Row;
  elapsed: number;
  busy: boolean;
  compact?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
}) {
  const bars = r.monthlyNet.slice(0, Math.max(1, elapsed));
  const maxAbs = Math.max(1, ...bars.map((v) => Math.abs(v)));

  return (
    <div
      className={cn(
        "relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm transition-all duration-200",
        r.archived
          ? "opacity-70"
          : "hover:border-accent-amber/50 hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      <Link
        href={`/properties/${r.id}`}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
      >
        {/* Zone A — identity */}
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

        {/* Zone B — occupancy */}
        {!compact && r.hasTenants && (
          <div className="flex items-center gap-1.5 text-xs mt-2">
            {r.currentTenantName ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-profit shrink-0" />
                <span className="truncate text-[var(--foreground)]">
                  {r.currentTenantName}
                </span>
                {r.monthlyRent != null && (
                  <span className="font-data text-[var(--muted-foreground)] shrink-0">
                    · {formatCurrency(r.monthlyRent)}/mo
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-loss shrink-0" />
                <span className="text-[var(--muted-foreground)]">Vacant</span>
              </>
            )}
          </div>
        )}

        {/* Zone C — net + split */}
        <p className={cn("text-2xl font-bold font-data mt-2", signedClass(r.net))}>
          {r.net >= 0 ? "+" : ""}
          {formatCurrency(r.net)}
        </p>
        <div className="flex items-center gap-3 text-xs mt-2">
          <span className="inline-flex items-center gap-1 text-profit font-data">
            <ArrowUp className="w-3 h-3" />
            {formatCurrency(r.income)}
          </span>
          <span className="inline-flex items-center gap-1 text-loss font-data">
            <ArrowDown className="w-3 h-3" />
            {formatCurrency(r.expenses)}
          </span>
        </div>

        {/* Zone D — sparkline */}
        {!compact && r.txCount > 0 && (
          <div className="flex items-end gap-0.5 h-5 mt-3">
            {bars.map((v, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm min-h-[2px]",
                  v >= 0 ? "bg-profit/70" : "bg-loss/70"
                )}
                style={{
                  height: `${Math.max(8, Math.min(100, (Math.abs(v) / maxAbs) * 100))}%`,
                }}
              />
            ))}
          </div>
        )}

        {/* Zone E — footer */}
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mt-2 pt-2 border-t border-[var(--border)]">
          <span>
            {r.txCount} entr{r.txCount !== 1 ? "ies" : "y"}
          </span>
          {r.yieldPct != null && (
            <span className="font-data">{r.yieldPct.toFixed(1)}% yield</span>
          )}
        </div>
      </Link>

      {/* Archive / unarchive control (outside the Link so it doesn't navigate) */}
      {(onArchive || onUnarchive) && (
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onArchive ?? onUnarchive}
            disabled={busy}
            title={onArchive ? "Archive property" : "Restore property"}
            className="focus-visible:ring-offset-[var(--card)]"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : onArchive ? (
              <Archive className="w-4 h-4" />
            ) : (
              <ArchiveRestore className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
