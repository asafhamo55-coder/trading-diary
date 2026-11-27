"use client";

import PropertyRecommendations from "@/components/advisor/PropertyRecommendations";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  MapPin,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Home,
  BarChart3,
  Receipt,
  CircleAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn, formatCurrency, signedClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  SegmentedControl,
  SectionHeader,
  inputCls,
  MONTH_ABBR,
} from "@/components/properties/shared";
import YearPicker from "@/components/layout/YearPicker";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/ui/badge";
import { useDisplayCurrency } from "@/components/ui/currency";
import { notifyPropertiesChanged } from "@/components/layout/use-property-nav";
import { formatShortDate, type AttentionItem } from "@/lib/property-attention";
import type { PropertyRecord } from "@/lib/property-profile";
import { AttentionPanel } from "@/components/properties/AttentionPanel";
import { PropertyRecordSections } from "@/components/properties/record/PropertyRecordSections";
import TenantsSection from "@/components/properties/TenantsSection";
import PropertyValueSection from "@/components/properties/PropertyValueSection";
import EditPropertyEntryModal from "@/components/properties/EditPropertyEntryModal";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  categoryLabel,
  getCategory,
  monthlyNet,
  forReturns,
  taxOnlyCount,
  currentTenantOf,
  type BuildingCash,
  type PropertyYearSummary,
  type PropertyTransactionDTO,
  type TenantDTO,
} from "@/lib/property";

interface PropertyInfo {
  id: string;
  title: string;
  address: string;
  street: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchasePrice: number | null;
  downPayment: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  valueAsOf: string | null;
  mortgageBalance: number | null;
  mortgageAsOf: string | null;
  usage: string;
  notes: string | null;
  archivedAt: string | null;
}

export default function PropertyDetailClient({
  property,
  year,
  availableYears,
  summary,
  taxSummary,
  prevSummary,
  transactions,
  tenants,
  today,
  elapsed,
  occupancy,
  yieldPct,
  cash,
  record,
  attention,
}: {
  property: PropertyInfo;
  year: number;
  availableYears: number[];
  /** Performance view — tax-only entries excluded. Drives every figure below. */
  summary: PropertyYearSummary;
  /** Tax view — every entry, including the tax-only ones. Schedule E section. */
  taxSummary: PropertyYearSummary;
  prevSummary: PropertyYearSummary;
  transactions: PropertyTransactionDTO[];
  tenants: TenantDTO[];
  today: string;
  elapsed: number;
  occupancy: { occupiedMonths: number; totalMonths: number; pct: number };
  yieldPct: number | null;
  /** Building-level return on the cash invested; null for an archived property. */
  cash: BuildingCash | null;
  /** Loans, insurance, tax, management, utilities, tax basis, maintenance, documents. */
  record: PropertyRecord;
  /** "Needs attention" items for this property (same rules as the list). */
  attention: AttentionItem[];
}) {
  const router = useRouter();
  const { money } = useDisplayCurrency();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingProperty, setDeletingProperty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [editingTx, setEditingTx] = useState<PropertyTransactionDTO | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [togglingTxId, setTogglingTxId] = useState<string | null>(null);
  const isArchived = property.archivedAt !== null;

  // Editable property details (address parts + purchase info).
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [details, setDetails] = useState({
    street: property.street ?? "",
    unit: property.unit ?? "",
    city: property.city ?? "",
    state: property.state ?? "",
    zip: property.zip ?? "",
  });

  function cancelEditDetails() {
    setDetails({
      street: property.street ?? "",
      unit: property.unit ?? "",
      city: property.city ?? "",
      state: property.state ?? "",
      zip: property.zip ?? "",
    });
    setDetailsError(null);
    setEditingDetails(false);
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setDetailsError(null);
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: details.street,
          unit: details.unit || null,
          city: details.city || null,
          state: details.state || null,
          zip: details.zip || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save details");
      }
      setEditingDetails(false);
      notifyPropertiesChanged();
      router.refresh();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  }

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

  async function handleToggleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !isArchived }),
      });
      if (res.ok) {
        notifyPropertiesChanged();
        router.refresh();
      }
    } finally {
      setArchiving(false);
    }
  }

  async function handleDeleteProperty() {
    setDeletingProperty(true);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        notifyPropertiesChanged();
        router.push("/properties");
        router.refresh();
      }
    } finally {
      setDeletingProperty(false);
    }
  }

  // Cash-flow: signed net per month, tax-only entries excluded like every
  // other performance figure on this page.
  const returnsTx = forReturns(transactions);
  const flaggedCount = taxOnlyCount(transactions);
  const net = monthlyNet(returnsTx);
  const cashMaxAbs = Math.max(1, ...net.map((v) => Math.abs(v)));

  // Year-over-year change vs. prior year's net (only when prior year has data).
  const prevHasData = prevSummary.byCategory.length > 0 && prevSummary.net !== 0;
  const yoyPct = prevHasData
    ? ((summary.net - prevSummary.net) / Math.abs(prevSummary.net)) * 100
    : null;

  const monthsTracked = new Set(transactions.map((t) => t.month)).size;
  const isResidence = property.usage === "residence";
  const currentTenant = currentTenantOf(tenants, today);
  const equity = property.currentValue != null ? property.currentValue - (property.mortgageBalance ?? 0) : null;

  // Flip an entry between "counts toward returns" and "tax report only".
  async function handleToggleTaxOnly(tx: PropertyTransactionDTO) {
    setTogglingTxId(tx.id);
    try {
      const res = await fetch(
        `/api/properties/${property.id}/transactions/${tx.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxOnly: !tx.taxOnly }),
        }
      );
      if (res.ok) router.refresh();
    } finally {
      setTogglingTxId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        back={{ href: "/properties", label: "All properties" }}
        title={property.title}
        meta={
          isArchived ? (
            <StatusPill tone="neutral" label="Archived" />
          ) : isResidence ? (
            <StatusPill tone="info" label="Primary residence" icon={<Home aria-hidden />} />
          ) : currentTenant ? (
            <StatusPill tone="success" label="Leased" />
          ) : (
            <StatusPill tone="danger" label="Vacant" />
          )
        }
        description={
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {property.address}
            </span>
            {!isResidence && currentTenant ? (
              <span className="num text-xs">
                {currentTenant.name}
                {currentTenant.monthlyRent != null ? ` · ${money(currentTenant.monthlyRent)}/mo` : ""}
                {currentTenant.leaseEnd ? ` · lease ends ${formatShortDate(currentTenant.leaseEnd)}` : " · month-to-month"}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <YearPicker years={availableYears} selected={year} />
            {/* Actions menu */}
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Property actions"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <MoreVertical className="size-4" aria-hidden />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div role="menu" className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-elevated py-1 shadow-lg">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        handleToggleArchive();
                      }}
                      disabled={archiving}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-subtle disabled:opacity-60"
                    >
                      {isArchived ? (
                        <>
                          <ArchiveRestore className="size-4" aria-hidden />
                          Restore property
                        </>
                      ) : (
                        <>
                          <Archive className="size-4" aria-hidden />
                          Archive property
                        </>
                      )}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDelete(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger-subtle"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete property
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-loss/40 bg-loss/10 px-4 py-3">
          <span className="text-sm text-[var(--foreground)]">
            Delete <span className="font-semibold">{property.title}</span> and all its entries & tenants? This can&apos;t be undone.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={handleDeleteProperty} disabled={deletingProperty}>
              {deletingProperty && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, delete
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Archived banner */}
      {isArchived && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            This property is <span className="font-medium text-[var(--foreground)]">archived</span> — hidden from the active list, but all records are preserved.
          </span>
          <Button onClick={handleToggleArchive} disabled={archiving}>
            {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />}
            Restore
          </Button>
        </div>
      )}

      {/* Snapshot KPIs */}
      <section aria-label="Property summary" className="space-y-2">
        <div className={cn("grid grid-cols-2 gap-3", isResidence ? "sm:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-5")}>
          <Kpi
            label="Value"
            value={property.currentValue != null ? money(property.currentValue, "USD", { compact: true }) : "—"}
            valueTone={property.currentValue == null ? "muted" : "default"}
            hint={property.valueAsOf ? `as of ${formatShortDate(property.valueAsOf)}` : "add a current value"}
          />
          <Kpi
            label="Mortgage"
            value={property.mortgageBalance != null ? money(property.mortgageBalance, "USD", { compact: true }) : "—"}
            valueTone={property.mortgageBalance == null ? "muted" : "default"}
            hint={property.mortgageAsOf ? `as of ${formatShortDate(property.mortgageAsOf)}` : property.mortgageBalance == null ? "not set" : undefined}
          />
          <Kpi
            label="Equity"
            value={equity != null ? money(equity, "USD", { compact: true }) : "—"}
            valueTone={equity == null ? "muted" : equity >= 0 ? "positive" : "negative"}
            hint={
              equity != null && property.currentValue
                ? `${Math.round((equity / property.currentValue) * 100)}% of value${property.mortgageBalance == null ? " · no mortgage on file" : ""}`
                : undefined
            }
          />
          <Kpi
            label={`Net ${elapsed > 0 && elapsed < 12 ? "YTD" : year}`}
            value={money(summary.net, "USD", { compact: true, signed: true })}
            valueTone={summary.net > 0 ? "positive" : summary.net < 0 ? "negative" : "default"}
            delta={
              yoyPct != null
                ? {
                    value: `${yoyPct >= 0 ? "+" : "−"}${Math.abs(yoyPct).toFixed(0)}%`,
                    direction: yoyPct > 0 ? "up" : yoyPct < 0 ? "down" : "flat",
                    sentiment: yoyPct >= 0 ? "positive" : "negative",
                    label: "vs last year",
                  }
                : undefined
            }
          />
          {!isResidence ? (
            <Kpi
              label="Cash-on-cash"
              value={
                cash?.cashOnCashPct != null
                  ? `${cash.cashOnCashPct >= 0 ? "+" : "−"}${Math.abs(cash.cashOnCashPct).toFixed(1)}%`
                  : "—"
              }
              valueTone={cash?.cashOnCashPct == null ? "muted" : cash.cashOnCashPct >= 0 ? "positive" : "negative"}
              hint={
                cash?.cashOnCashPct != null
                  ? `on ${money(cash.downPayment, "USD", { compact: true })}${cash.unitCount > 1 ? ` · ${cash.unitCount} units` : ""}`
                  : isArchived
                    ? "archived"
                    : "add a down payment"
              }
            />
          ) : null}
        </div>
        {!isResidence ? (
          <p className="num flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
            <span>Yield {yieldPct != null ? `${yieldPct.toFixed(1)}%` : "— (add purchase price)"}</span>
            <span>
              Occupancy{" "}
              {occupancy.totalMonths > 0
                ? `${Math.round(occupancy.pct)}% (${occupancy.occupiedMonths}/${occupancy.totalMonths} mo)`
                : "—"}
            </span>
            <span>
              {transactions.length} entr{transactions.length === 1 ? "y" : "ies"}
              {flaggedCount > 0 ? ` · ${flaggedCount} tax-only` : ""} · {monthsTracked} month
              {monthsTracked !== 1 ? "s" : ""} tracked
            </span>
          </p>
        ) : null}
      </section>

      {/* Needs attention + recommendations */}
      <div className={cn("grid grid-cols-1 gap-4", attention.length > 0 && "lg:grid-cols-2")}>
        {attention.length > 0 ? <AttentionPanel items={attention} /> : null}
        <PropertyRecommendations propertyId={property.id} />
      </div>

      {/* Cash flow */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<BarChart3 className="w-3.5 h-3.5 text-accent-amber" />}
          title={`Cash flow · ${year}`}
          meta="net per month"
        />
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <BarChart3 className="w-8 h-8 text-[var(--border)] mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No entries for {year} yet.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-1.5 h-28">
              {net.map((v, i) => {
                const future = i >= elapsed;
                return (
                  <div key={i} className="flex h-full min-w-0 flex-col items-center justify-end">
                    {future ? null : (
                      <span
                        className={cn(
                          "mb-0.5 max-w-full truncate text-[9px] leading-none tabular-nums sm:text-[10px]",
                          v >= 0 ? "text-profit" : "text-loss"
                        )}
                      >
                        {formatCompactAmount(v)}
                      </span>
                    )}
                    <div
                      title={future ? undefined : formatCurrency(v)}
                      className={cn(
                        "w-full rounded-sm",
                        future
                          ? "bg-[var(--muted)] opacity-20 min-h-[4px]"
                          : cn("min-h-[2px]", v >= 0 ? "bg-profit/70" : "bg-loss/70")
                      )}
                      style={
                        future
                          ? undefined
                          : { height: `${Math.max(4, (Math.abs(v) / cashMaxAbs) * 80)}%` }
                      }
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-12 gap-1.5 mt-1">
              {MONTH_ABBR.map((m) => (
                <span
                  key={m}
                  className="text-center text-[10px] text-[var(--muted-foreground)]"
                >
                  {m.slice(0, 1)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-profit" /> Positive month
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-loss" /> Negative month
              </span>
            </div>
          </>
        )}
      </div>

      {/* Property details — structured address + purchase info */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            icon={<Home className="w-3.5 h-3.5 text-accent-amber" />}
            title="Property details"
          />
          {!editingDetails && (
            <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </div>

        {editingDetails ? (
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-4">
                <Field label="Street & number" required>
                  <input
                    required
                    value={details.street}
                    onChange={(e) => setDetails({ ...details, street: e.target.value })}
                    placeholder="123 Maple St"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Unit #">
                  <input
                    value={details.unit}
                    onChange={(e) => setDetails({ ...details, unit: e.target.value })}
                    placeholder="4B"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="City">
                  <input
                    value={details.city}
                    onChange={(e) => setDetails({ ...details, city: e.target.value })}
                    placeholder="Springfield"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="sm:col-span-1">
                <Field label="State">
                  <input
                    value={details.state}
                    onChange={(e) => setDetails({ ...details, state: e.target.value })}
                    placeholder="CA"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="ZIP code">
                  <input
                    value={details.zip}
                    onChange={(e) => setDetails({ ...details, zip: e.target.value })}
                    placeholder="90210"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
            {detailsError && (
              <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
                <CircleAlert className="w-4 h-4 shrink-0" /> {detailsError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEditDetails}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingDetails}>
                {savingDetails && <Loader2 className="w-4 h-4 animate-spin" />}
                Save details
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                Address
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <DetailItem label="Street & number" value={property.street} />
                <DetailItem label="Unit #" value={property.unit} />
                <DetailItem label="City" value={property.city} />
                <DetailItem label="State" value={property.state} />
                <DetailItem label="ZIP code" value={property.zip} />
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Value & appreciation */}
      <PropertyValueSection
        propertyId={property.id}
        property={{
          purchasePrice: property.purchasePrice,
          downPayment: property.downPayment,
          purchaseDate: property.purchaseDate,
          currentValue: property.currentValue,
          valueAsOf: property.valueAsOf,
          mortgageBalance: property.mortgageBalance,
          mortgageAsOf: property.mortgageAsOf,
          usage: property.usage,
        }}
        today={today}
      />

      {/* Tenants */}
      <TenantsSection
        propertyId={property.id}
        tenants={tenants}
        today={today}
      />

      {/* The property record */}
      <section aria-labelledby="record-heading" className="space-y-3">
        <h2 id="record-heading" className="text-lg font-semibold tracking-tight text-foreground">
          Property record
        </h2>
        <PropertyRecordSections
          propertyId={property.id}
          record={record}
          purchasePrice={property.purchasePrice}
          today={today}
          expenseOptions={transactions
            .filter((t) => t.type === "EXPENSE")
            .map((t) => ({ value: t.id, label: `${formatShortDate(t.date)} · ${categoryLabel(t.category)} · ${money(t.amount)}` }))}
        />
      </section>

      {/* Tax summary */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<FileText className="w-3.5 h-3.5 text-accent-amber" />}
          title={`Tax summary · ${year}`}
          meta="Schedule E style"
        />

        {taxSummary.byCategory.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <FileText className="w-8 h-8 text-[var(--border)] mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No entries for {year} yet. Add rental income and expenses below.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <SummaryGroup
              title="Income"
              rows={taxSummary.byCategory.filter((c) => c.type === "INCOME")}
              total={taxSummary.income}
              tone="pos"
            />
            <SummaryGroup
              title="Expenses"
              rows={taxSummary.byCategory.filter((c) => c.type === "EXPENSE")}
              total={taxSummary.expenses}
              tone="neg"
              percentOf={taxSummary.expenses}
            />
            <div className="flex items-center justify-between rounded-lg bg-[var(--muted)]/40 px-3 py-2.5 mt-1">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--foreground)]">
                  Net operating income
                </span>
                {flaggedCount > 0 && (
                  <span className="block text-xs text-[var(--muted-foreground)] mt-0.5">
                    Includes {flaggedCount} tax-only entr
                    {flaggedCount !== 1 ? "ies" : "y"} left out of the figures above
                  </span>
                )}
              </span>
              <span className={cn("text-lg font-bold font-data tracking-tight tabular-nums shrink-0", signedClass(taxSummary.net))}>
                {taxSummary.net >= 0 ? "+" : ""}
                {formatCurrency(taxSummary.net)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add entry */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-border bg-surface p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Add entry</h3>
        <SegmentedControl
          value={form.type}
          onChange={setType}
          options={[
            { value: "EXPENSE", label: "Expense", activeClassName: "bg-loss/15 text-loss" },
            { value: "INCOME", label: "Income", activeClassName: "bg-profit/15 text-profit" },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Date" required>
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
          <Field label="Amount" required>
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
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
            <CircleAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add entry
          </Button>
        </div>
      </form>

      {/* Transactions list */}
      <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <SectionHeader
          icon={<Receipt className="w-3.5 h-3.5 text-accent-amber" />}
          title={`Entries · ${year}`}
          meta={
            flaggedCount > 0
              ? `${flaggedCount} of ${transactions.length} counted for tax only`
              : undefined
          }
        />
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <Receipt className="w-8 h-8 text-[var(--border)] mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No entries recorded for {year}.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block max-h-[480px] overflow-auto rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--card)] z-10">
                  <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Category</th>
                    <th className="text-left pb-3 font-medium">Description</th>
                    <th className="text-right pb-3 font-medium">Amount</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className={cn(
                        "border-b border-[var(--border)]/60 last:border-0 group hover:bg-[var(--muted)]/40 transition-colors",
                        t.taxOnly && "opacity-60"
                      )}
                    >
                      <td
                        className="py-3 text-[var(--muted-foreground)] font-data whitespace-nowrap"
                        title={t.date}
                      >
                        {t.date.slice(5)}
                      </td>
                      <td className="py-3 text-[var(--foreground)]">
                        <span className="inline-flex items-center gap-1.5">
                          {categoryLabel(t.category)}
                          {t.taxOnly && <TaxOnlyBadge />}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--muted-foreground)] truncate max-w-[200px]">
                        {t.description || "—"}
                      </td>
                      <td
                        className={cn(
                          "py-3 text-right font-data font-semibold tabular-nums whitespace-nowrap",
                          t.type === "INCOME" ? "text-profit" : "text-loss",
                          t.taxOnly && "line-through decoration-from-font"
                        )}
                      >
                        {t.type === "INCOME" ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="py-3 text-right">
                        <div
                          className={cn(
                            "inline-flex items-center gap-0.5 transition-opacity",
                            // A flagged row keeps its toggle visible, so the
                            // state is always reversible without hunting.
                            t.taxOnly
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                          )}
                        >
                          <TaxOnlyToggle
                            taxOnly={t.taxOnly}
                            busy={togglingTxId === t.id}
                            onClick={() => handleToggleTaxOnly(t)}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingTx(t)}
                            aria-label="Edit entry"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="danger-ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteTx(t.id)}
                            aria-label="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked list */}
            <div className="sm:hidden divide-y divide-[var(--border)]">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3",
                    t.taxOnly && "opacity-60"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--foreground)] truncate">
                      <span className="inline-flex items-center gap-1.5">
                        {categoryLabel(t.category)}
                        {t.taxOnly && <TaxOnlyBadge />}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] truncate">
                      {t.date.slice(5)}
                      {t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        "font-data font-semibold tabular-nums text-sm whitespace-nowrap",
                        t.type === "INCOME" ? "text-profit" : "text-loss",
                        t.taxOnly && "line-through decoration-from-font"
                      )}
                    >
                      {t.type === "INCOME" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </span>
                    <TaxOnlyToggle
                      taxOnly={t.taxOnly}
                      busy={togglingTxId === t.id}
                      onClick={() => handleToggleTaxOnly(t)}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditingTx(t)}
                      aria-label="Edit entry"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteTx(t.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editingTx && (
        <EditPropertyEntryModal
          propertyId={property.id}
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}

/** Marks an entry as kept for the tax report but out of the performance figures. */
function TaxOnlyBadge() {
  return (
    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)]">
      Tax only
    </span>
  );
}

function TaxOnlyToggle({
  taxOnly,
  busy,
  onClick,
}: {
  taxOnly: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={busy}
      title={
        taxOnly
          ? "Counted for tax only — click to include it in gain & yield"
          : "Counted everywhere — click to keep it for tax only"
      }
      aria-label={taxOnly ? "Include entry in gain & yield" : "Count entry for tax only"}
      aria-pressed={taxOnly}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : taxOnly ? (
        <EyeOff className="w-4 h-4" />
      ) : (
        <Eye className="w-4 h-4" />
      )}
    </Button>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--muted-foreground)]">{label}</dt>
      <dd
        className={cn(
          "text-sm mt-0.5",
          value ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function SummaryGroup({
  title,
  rows,
  total,
  tone,
  percentOf,
}: {
  title: string;
  rows: { key: string; label: string; total: number }[];
  total: number;
  tone: "pos" | "neg";
  percentOf?: number;
}) {
  if (rows.length === 0) return null;
  const color = tone === "pos" ? "text-profit" : "text-loss";
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
          const pct =
            percentOf && percentOf > 0 ? Math.round((r.total / percentOf) * 100) : null;
          return (
            <div key={r.key} className="flex items-center justify-between text-sm gap-2">
              <span className="text-[var(--foreground)] min-w-0">
                {r.label}
                {cat?.taxLine && (
                  <span className="text-[var(--muted-foreground)] text-xs ml-2">
                    {cat.taxLine}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {pct != null && (
                  <span className="font-data text-[var(--muted-foreground)] text-xs w-9 text-right">
                    {pct}%
                  </span>
                )}
                <span className="font-data text-[var(--muted-foreground)]">
                  {formatCurrency(r.total)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Short bar label: "$850", "-$1.2k", "$12k". */
function formatCompactAmount(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs < 1000) return `${sign}$${Math.round(abs)}`;
  const k = abs / 1000;
  return `${sign}$${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
}
