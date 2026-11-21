"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  CircleAlert,
  KeyRound,
  LayoutGrid,
  Loader2,
  Percent,
  Plus,
  Scale,
  Table2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { useDisplayCurrency } from "@/components/ui/currency";
import { Field, inputCls } from "@/components/properties/shared";
import YearPicker from "@/components/layout/YearPicker";
import { notifyPropertiesChanged } from "@/components/layout/use-property-nav";
import { isResidence, portfolioKpis, type PropertyRow } from "@/lib/property-portfolio";
import type { AttentionItem } from "@/lib/property-attention";
import { PropertyCard, ResidenceCard, fmtPct } from "./PropertyCard";
import { PropertiesTable } from "./PropertiesTable";
import { AttentionPanel } from "./AttentionPanel";
import { EquityChart, MonthlyNetChart } from "./PropertiesCharts";

const EMPTY_FORM = {
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  purchasePrice: "",
  purchaseDate: "",
  residence: false,
  currentValue: "",
  mortgageBalance: "",
};

/* ── Cards | Table, remembered per browser ───────────────────────────── */

type View = "table" | "cards";
const VIEW_KEY = "properties-view-v1";
const VIEW_EVENT = "properties-view-change";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

function subscribeView(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(VIEW_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VIEW_EVENT, cb);
  };
}

function useView(): [View, (v: View) => void] {
  const view = React.useSyncExternalStore(subscribeView, readView, () => "table" as View);
  const set = React.useCallback((v: View) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  }, []);
  return [view, set];
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const options: { value: View; label: string; icon: React.ElementType }[] = [
    { value: "cards", label: "Cards", icon: LayoutGrid },
    { value: "table", label: "Table", icon: Table2 },
  ];
  return (
    <div
      role="group"
      aria-label="Layout"
      className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-subtle p-0.5 max-md:hidden"
    >
      {options.map((o) => {
        const active = view === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PropertiesClient({
  rows,
  attention,
  year,
  availableYears,
  elapsed,
}: {
  rows: PropertyRow[];
  attention: AttentionItem[];
  year: number;
  availableYears: number[];
  elapsed: number;
}) {
  const router = useRouter();
  const { money } = useDisplayCurrency();
  const [view, setView] = useView();
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [showArchived, setShowArchived] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // The family's own home counts in net worth but not in rental returns, so it
  // is listed on its own and left out of every rental figure and chart.
  const homes = rows.filter((r) => !r.archived && isResidence(r));
  const rentals = rows.filter((r) => !r.archived && !isResidence(r));
  const archivedRows = rows.filter((r) => r.archived);
  const k = portfolioKpis(rows, elapsed);
  const partialYear = elapsed > 0 && elapsed < 12;

  async function setArchived(id: string, archived: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (res.ok) {
        notifyPropertiesChanged();
        router.refresh();
      }
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
          usage: form.residence ? "residence" : "rental",
          currentValue: form.currentValue ? Number(form.currentValue) : null,
          valueAsOf: form.currentValue ? new Date().toISOString().slice(0, 10) : null,
          mortgageBalance: form.mortgageBalance ? Number(form.mortgageBalance) : null,
          mortgageAsOf: form.mortgageBalance ? new Date().toISOString().slice(0, 10) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to add property");
      }
      setForm(EMPTY_FORM);
      setAdding(false);
      notifyPropertiesChanged();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add property");
    } finally {
      setSaving(false);
    }
  }

  const cardGrid = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rentals.map((r) => (
        <PropertyCard
          key={r.id}
          row={r}
          elapsed={elapsed}
          busy={busyId === r.id}
          onArchive={() => setArchived(r.id, true)}
        />
      ))}
    </div>
  );

  const nothingYet = rentals.length === 0 && homes.length === 0 && archivedRows.length === 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Properties"
        description={`Rental income, expenses and equity · tax-ready · ${year}`}
        actions={
          <>
            <YearPicker years={availableYears} selected={year} />
            {rentals.length > 0 ? <ViewToggle view={view} onChange={setView} /> : null}
            <Button onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
              <Plus className="size-4" aria-hidden />
              Add property
            </Button>
          </>
        }
      />

      {adding && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-foreground">New property</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setAdding(false)}
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
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
            <label className="sm:col-span-6 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.residence}
                onChange={(e) => setForm({ ...form, residence: e.target.checked })}
                className="size-4 accent-[var(--ring)]"
              />
              This is our primary residence (counts in net worth, not in rental returns)
            </label>
            <div className="sm:col-span-3">
              <Field label="Current value (optional)">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.currentValue}
                  onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                  placeholder="750000"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Mortgage balance (optional)">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.mortgageBalance}
                  onChange={(e) => setForm({ ...form, mortgageBalance: e.target.value })}
                  placeholder="400000"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
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

      {nothingYet ? (
        <EmptyState
          icon={<Building2 />}
          title="No properties yet"
          titleAs="h2"
          description="Add a property, then log its rental income and expenses for the year."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Add your first property
            </Button>
          }
        />
      ) : null}

      {/* Headline figures: rentals only */}
      {rentals.length > 0 ? (
        <section aria-label="Rental portfolio summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            label="Portfolio value"
            icon={<Building2 />}
            value={k.valuedCount ? money(k.value, "USD", { compact: true }) : "—"}
            hint={
              k.valuedCount < k.rentals
                ? `${k.valuedCount} of ${k.rentals} valued`
                : `${k.rentals} rental${k.rentals === 1 ? "" : "s"}`
            }
          />
          <Kpi
            label="Equity"
            icon={<Scale />}
            value={k.valuedCount ? money(k.equity, "USD", { compact: true }) : "—"}
            hint={
              [
                k.missingMortgage > 0 ? `${k.missingMortgage} missing mortgage` : "value − mortgage",
                k.homeEquity != null ? `+ home ${money(k.homeEquity, "USD", { compact: true })}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            }
          />
          <Kpi
            label={`Net cash flow${partialYear ? " YTD" : ` ${year}`}`}
            icon={<Wallet />}
            value={money(k.net, "USD", { compact: true, signed: true })}
            valueTone={k.net > 0 ? "positive" : k.net < 0 ? "negative" : "default"}
            hint={k.avgNetPerMonth != null ? `${money(k.avgNetPerMonth, "USD", { signed: true })}/mo avg` : undefined}
          />
          <Kpi
            label="Cash-on-cash"
            icon={<Percent />}
            value={fmtPct(k.cashOnCashPct)}
            valueTone={k.cashOnCashPct == null ? "muted" : k.cashOnCashPct >= 0 ? "positive" : "negative"}
            hint={k.cashInvested > 0 ? `on ${money(k.cashInvested, "USD", { compact: true })} invested` : "add down payments"}
          />
          <Kpi
            label="Units leased now"
            icon={<KeyRound />}
            value={`${k.leased}/${k.rentals}`}
            hint={k.leased === k.rentals ? "fully leased" : `${k.rentals - k.leased} vacant`}
          />
          <Kpi
            label="Appreciation vs cost"
            icon={<TrendingUp />}
            value={k.appreciationPct != null ? fmtPct(k.appreciationPct * 100) : "—"}
            valueTone={k.appreciationPct == null ? "muted" : k.appreciationPct >= 0 ? "positive" : "negative"}
            hint={
              k.netIfSold != null ? (
                <span title="After 6% realtor + 2% closing costs">
                  {money(k.appreciationGain, "USD", { compact: true, signed: true })} · net if sold{" "}
                  {money(k.netIfSold, "USD", { compact: true, signed: true })}
                  <span className="sr-only"> after 6% realtor and 2% closing costs</span>
                </span>
              ) : undefined
            }
          />
        </section>
      ) : null}

      {/* Attention + primary residence */}
      {rentals.length > 0 || homes.length > 0 ? (
        <div className={cn("grid grid-cols-1 gap-4", homes.length > 0 && "lg:grid-cols-3")}>
          <AttentionPanel items={attention} className={homes.length > 0 ? "lg:col-span-2" : undefined} />
          {homes.length > 0 ? (
            <section aria-labelledby="residence-heading" className="flex flex-col gap-3">
              <h2 id="residence-heading" className="sr-only">
                Primary residence
              </h2>
              {homes.map((h) => (
                <ResidenceCard key={h.id} row={h} />
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      {/* The list */}
      {rentals.length > 0 ? (
        <section aria-labelledby="rentals-heading" className="space-y-3">
          <h2 id="rentals-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Rentals <span className="num text-sm font-normal text-muted-foreground">({rentals.length})</span>
          </h2>
          {view === "table" ? (
            <>
              <div className="max-md:hidden">
                <PropertiesTable
                  rows={rentals}
                  elapsed={elapsed}
                  busyId={busyId}
                  onArchive={(id) => setArchived(id, true)}
                />
              </div>
              {/* Phones: the table falls back to cards. */}
              <div className="md:hidden">{cardGrid}</div>
            </>
          ) : (
            cardGrid
          )}
        </section>
      ) : null}

      {/* Charts */}
      {rentals.length > 0 ? (
        <section aria-label="Charts" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MonthlyNetChart rows={rentals} year={year} elapsed={elapsed} />
          <EquityChart rows={rentals} />
        </section>
      ) : null}

      {/* Archived */}
      {archivedRows.length > 0 ? (
        <section aria-label="Archived properties">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            aria-expanded={showArchived}
            aria-controls="archived-properties"
            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              className={cn("size-4 transition-transform", showArchived ? "rotate-0" : "-rotate-90")}
              aria-hidden
            />
            Archived ({archivedRows.length})
          </button>
          {showArchived ? (
            <div id="archived-properties" className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
