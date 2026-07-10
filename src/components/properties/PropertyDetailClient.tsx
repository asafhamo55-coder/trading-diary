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
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Home,
  BarChart3,
  Receipt,
  CircleAlert,
} from "lucide-react";
import { cn, formatCurrency, signedClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  SummaryTile,
  SegmentedControl,
  SectionHeader,
  inputCls,
  MONTH_ABBR,
} from "@/components/properties/shared";
import YearPicker from "@/components/layout/YearPicker";
import TenantsSection from "@/components/properties/TenantsSection";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  categoryLabel,
  getCategory,
  monthlyNet,
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
  purchaseDate: string | null;
  notes: string | null;
  archivedAt: string | null;
}

export default function PropertyDetailClient({
  property,
  year,
  availableYears,
  summary,
  prevSummary,
  transactions,
  tenants,
  today,
  elapsed,
  occupancy,
  yieldPct,
}: {
  property: PropertyInfo;
  year: number;
  availableYears: number[];
  summary: PropertyYearSummary;
  prevSummary: PropertyYearSummary;
  transactions: PropertyTransactionDTO[];
  tenants: TenantDTO[];
  today: string;
  elapsed: number;
  occupancy: { occupiedMonths: number; totalMonths: number; pct: number };
  yieldPct: number | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingProperty, setDeletingProperty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    purchasePrice: property.purchasePrice != null ? String(property.purchasePrice) : "",
    purchaseDate: property.purchaseDate ?? "",
  });

  function cancelEditDetails() {
    setDetails({
      street: property.street ?? "",
      unit: property.unit ?? "",
      city: property.city ?? "",
      state: property.state ?? "",
      zip: property.zip ?? "",
      purchasePrice: property.purchasePrice != null ? String(property.purchasePrice) : "",
      purchaseDate: property.purchaseDate ?? "",
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
          purchasePrice: details.purchasePrice ? Number(details.purchasePrice) : null,
          purchaseDate: details.purchaseDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save details");
      }
      setEditingDetails(false);
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
      if (res.ok) router.refresh();
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
        router.push("/properties");
        router.refresh();
      }
    } finally {
      setDeletingProperty(false);
    }
  }

  // Cash-flow: signed net per month for the selected year.
  const net = monthlyNet(transactions);
  const cashMaxAbs = Math.max(1, ...net.map((v) => Math.abs(v)));

  // Year-over-year change vs. prior year's net (only when prior year has data).
  const prevHasData = prevSummary.byCategory.length > 0 && prevSummary.net !== 0;
  const yoyPct = prevHasData
    ? ((summary.net - prevSummary.net) / Math.abs(prevSummary.net)) * 100
    : null;

  const monthsTracked = new Set(transactions.map((t) => t.month)).size;

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
            {property.title}
          </h1>
          <p className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {property.address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <YearPicker years={availableYears} selected={year} />
          {/* Actions menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Property actions"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-50 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleToggleArchive();
                    }}
                    disabled={archiving}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-60"
                  >
                    {isArchived ? (
                      <>
                        <ArchiveRestore className="w-4 h-4" />
                        Restore property
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        Archive property
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-loss hover:bg-loss/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete property
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile
          label={`Net · ${year}`}
          value={summary.net}
          tone="net"
          caption={
            yoyPct != null
              ? `${yoyPct >= 0 ? "+" : ""}${yoyPct.toFixed(0)}% YoY`
              : undefined
          }
          captionTone={yoyPct != null ? signedClass(yoyPct) : undefined}
        />
        <SummaryTile
          label="Yield"
          value={yieldPct != null ? `${yieldPct.toFixed(1)}%` : "—"}
          variant="percent"
          caption={yieldPct == null ? "Add purchase price" : undefined}
        />
        <SummaryTile
          label="Occupancy"
          value={occupancy.totalMonths > 0 ? `${Math.round(occupancy.pct)}%` : "—"}
          variant="percent"
          caption={
            occupancy.totalMonths > 0
              ? `${occupancy.occupiedMonths}/${occupancy.totalMonths} mo`
              : undefined
          }
        />
        <SummaryTile
          label="Entries"
          value={transactions.length}
          variant="count"
          caption={`${monthsTracked} month${monthsTracked !== 1 ? "s" : ""} tracked`}
        />
      </div>

      {/* Cash flow */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        <SectionHeader
          icon={<BarChart3 className="w-3.5 h-3.5 text-accent-amber" />}
          title={`Cash flow · ${year}`}
          meta="net per month"
        />
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4">
            No entries for {year} yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-1.5 h-24 items-end">
              {net.map((v, i) => {
                const future = i >= elapsed;
                return (
                  <div
                    key={i}
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
                        : { height: `${Math.max(4, (Math.abs(v) / cashMaxAbs) * 100)}%` }
                    }
                  />
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
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
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
              <div className="sm:col-span-3">
                <Field label="Purchase price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={details.purchasePrice}
                    onChange={(e) => setDetails({ ...details, purchasePrice: e.target.value })}
                    placeholder="450000"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="Purchase date">
                  <input
                    type="date"
                    value={details.purchaseDate}
                    onChange={(e) => setDetails({ ...details, purchaseDate: e.target.value })}
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
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                Purchase
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <DetailItem
                  label="Purchase price"
                  value={
                    property.purchasePrice != null
                      ? formatCurrency(property.purchasePrice)
                      : null
                  }
                />
                <DetailItem label="Purchase date" value={property.purchaseDate} />
              </dl>
            </div>
          </div>
        )}
      </div>

      {/* Tenants */}
      <TenantsSection
        propertyId={property.id}
        tenants={tenants}
        today={today}
      />

      {/* Tax summary */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        <SectionHeader
          icon={<FileText className="w-3.5 h-3.5 text-accent-amber" />}
          title={`Tax summary · ${year}`}
          meta="Schedule E style"
        />

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
              percentOf={summary.expenses}
            />
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Net operating income
              </span>
              <span className={cn("text-lg font-bold font-data", signedClass(summary.net))}>
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
        className="bg-[var(--card)] border border-[var(--border)] border-t-2 border-t-accent-amber/40 rounded-xl p-5 shadow-sm space-y-4"
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Add entry</h3>
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
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
        <SectionHeader
          icon={<Receipt className="w-3.5 h-3.5 text-accent-amber" />}
          title={`Entries · ${year}`}
        />
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-2">
            No entries recorded for {year}.
          </p>
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
                      className="border-b border-[var(--border)]/60 last:border-0 group hover:bg-[var(--muted)]/40 transition-colors"
                    >
                      <td
                        className="py-3 text-[var(--muted-foreground)] font-data whitespace-nowrap"
                        title={t.date}
                      >
                        {t.date.slice(5)}
                      </td>
                      <td className="py-3 text-[var(--foreground)]">
                        {categoryLabel(t.category)}
                      </td>
                      <td className="py-3 text-[var(--muted-foreground)] truncate max-w-[200px]">
                        {t.description || "—"}
                      </td>
                      <td
                        className={cn(
                          "py-3 text-right font-data font-semibold whitespace-nowrap",
                          t.type === "INCOME" ? "text-profit" : "text-loss"
                        )}
                      >
                        {t.type === "INCOME" ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="danger-ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteTx(t.id)}
                          aria-label="Delete entry"
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked list */}
            <div className="sm:hidden divide-y divide-[var(--border)]">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--foreground)] truncate">
                      {categoryLabel(t.category)}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] truncate">
                      {t.date.slice(5)}
                      {t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={cn(
                        "font-data font-semibold text-sm whitespace-nowrap",
                        t.type === "INCOME" ? "text-profit" : "text-loss"
                      )}
                    >
                      {t.type === "INCOME" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </span>
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
    </div>
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
