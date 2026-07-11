"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home as HomeIcon,
  Plus,
  Upload,
  Loader2,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Tag,
  BarChart3,
  AlertCircle,
  CreditCard,
  Landmark,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";
import ImportDialog from "@/components/home/ImportDialog";
import ExportButton, { toCsv } from "@/components/ui/ExportButton";
import HomeLedger from "@/components/home/HomeLedger";
import HomeCategorySelect, { type Selection } from "@/components/home/HomeCategorySelect";
import {
  ACCOUNT_TYPES,
  accountTypeShort,
  buildCategoryTree,
  isSpend,
  isIncome,
  type HomeAccountDTO,
  type HomeCategoryDTO,
  type HomeTransactionDTO,
  type HomeAccountType,
  type PropertyOption,
} from "@/lib/home";

const ACCENT = "#00D68F";

export default function HomeClient({
  accounts,
  categories,
  transactions,
  year,
  availableYears,
  reviewCount,
  properties,
}: {
  accounts: HomeAccountDTO[];
  categories: HomeCategoryDTO[];
  transactions: HomeTransactionDTO[];
  year: number;
  availableYears: number[];
  reviewCount: number;
  properties: PropertyOption[];
}) {
  const router = useRouter();
  const [addingAccount, setAddingAccount] = useState(false);
  const [addingTx, setAddingTx] = useState(false);
  const [importing, setImporting] = useState(false);

  // Local mirror of transactions so ledger edits apply instantly (optimistic),
  // without a full server round-trip / page refresh. Re-syncs whenever the
  // server sends fresh data (import, add row, edit, year change, etc.).
  const [txs, setTxs] = useState(transactions);
  useEffect(() => setTxs(transactions), [transactions]);

  // Apply a batch of saved edits to local state, mirroring the server's rules.
  function applyEdits(updates: {
    id: string;
    categoryId?: string | null;
    propertyId?: string | null;
    isExcluded?: boolean;
    notes?: string | null;
  }[]) {
    const byId = new Map(updates.map((u) => [u.id, u]));
    setTxs((prev) =>
      prev.map((t) => {
        const u = byId.get(t.id);
        if (!u) return t;
        const next = { ...t };
        if (u.categoryId !== undefined) {
          next.categoryId = u.categoryId || null;
          if (u.categoryId) {
            next.needsReview = false;
            next.propertyId = null;
          }
        }
        if (u.propertyId !== undefined) {
          next.propertyId = u.propertyId || null;
          if (u.propertyId) {
            next.needsReview = false;
            next.categoryId = null;
          }
        }
        if (u.isExcluded !== undefined) {
          next.isExcluded = u.isExcluded;
          if (u.isExcluded) next.needsReview = false;
        }
        if (u.notes !== undefined) next.notes = u.notes;
        return next;
      })
    );
  }

  function removeTx(id: string) {
    setTxs((prev) => prev.filter((t) => t.id !== id));
  }

  const activeAccounts = accounts.filter((a) => !a.archivedAt);
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  function buildTransactionsCsv() {
    const headers = ["Date", "Account", "Description", "Category / Property", "Amount", "Excluded", "Notes", "Original"];
    const rows = txs.map((t) => {
      const bucket = t.propertyId
        ? propById.get(t.propertyId)?.title ?? "Property"
        : t.categoryId
        ? catById.get(t.categoryId)?.name ?? ""
        : t.needsReview
        ? "Needs review"
        : "";
      return [
        t.date,
        accountById.get(t.homeAccountId)?.name ?? "",
        t.description,
        bucket,
        t.amount.toFixed(2),
        t.isExcluded ? "yes" : "",
        t.notes ?? "",
        t.rawDescription,
      ];
    });
    return toCsv(headers, rows);
  }

  const totals = useMemo(() => {
    let income = 0;
    let spend = 0;
    for (const t of txs) {
      if (isIncome(t)) income += t.amount;
      else if (isSpend(t)) spend += -t.amount;
    }
    const net = income - spend;
    const savingsRate = income > 0 ? net / income : 0;
    return { income, spend, net, savingsRate };
  }, [txs]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm ring-1 ring-inset"
            style={{ background: `${ACCENT}1A`, borderColor: `${ACCENT}33` }}
          >
            <HomeIcon className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Home</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Household spending & cash flow · {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {availableYears.length > 0 && (
            <YearPicker years={availableYears} selected={year} />
          )}
          <Link href="/home/insights" className={secondaryBtn}>
            <BarChart3 className="w-4 h-4" />
            Insights
          </Link>
          <Link href="/home/categories" className={secondaryBtn}>
            <Tag className="w-4 h-4" />
            Categories
          </Link>
          {txs.length > 0 && (
            <ExportButton
              filename={`hamo-home-${year}.csv`}
              title={`Hamo Home transactions ${year}`}
              buildCsv={buildTransactionsCsv}
            />
          )}
          <button onClick={() => setAddingTx(true)} className={secondaryBtn}>
            <Plus className="w-4 h-4" />
            Add row
          </button>
          <button
            onClick={() => setImporting(true)}
            className="pressable inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#0C0F14] shadow-sm transition-[filter] hover:brightness-105"
            style={{ background: ACCENT }}
          >
            <Upload className="w-4 h-4" />
            Import statement
          </button>
        </div>
      </div>

      {/* Review queue banner */}
      {reviewCount > 0 && (
        <Link
          href="/home/review"
          className="pressable group flex items-center gap-3 rounded-xl border border-[#FFB547]/40 bg-[#FFB547]/10 px-4 py-3 text-sm shadow-sm transition-colors hover:bg-[#FFB547]/15"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFB547]/15 shrink-0">
            <AlertCircle className="w-4 h-4 text-[#FFB547]" />
          </span>
          <span className="text-[var(--foreground)] flex-1">
            <span className="font-semibold">{reviewCount}</span> transaction
            {reviewCount !== 1 ? "s" : ""} need review
          </span>
          <span className="text-xs font-medium text-[#FFB547] opacity-0 group-hover:opacity-100 transition-opacity">
            Resolve →
          </span>
        </Link>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <SummaryTile
          label={`Income · ${year}`}
          value={totals.income}
          icon={<TrendingUp className="w-5 h-5" />}
          valueColor="text-[#00D68F]"
          accent="#00D68F"
        />
        <SummaryTile
          label={`Spending · ${year}`}
          value={totals.spend}
          icon={<TrendingDown className="w-5 h-5" />}
          valueColor="text-[#FF4D6A]"
          accent="#FF4D6A"
        />
        <SummaryTile
          label={`Net · ${year}`}
          value={totals.net}
          icon={<Wallet className="w-5 h-5" />}
          valueColor={totals.net >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          accent={totals.net >= 0 ? "#00D68F" : "#FF4D6A"}
          signed
        />
        <SummaryTile
          label="Savings rate"
          value={totals.savingsRate}
          icon={<PiggyBank className="w-5 h-5" />}
          valueColor={totals.savingsRate >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          accent={totals.savingsRate >= 0 ? "#00D68F" : "#FF4D6A"}
          percent
        />
      </div>

      {/* Accounts / sources */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Accounts
          </h3>
          {!addingAccount && (
            <button
              onClick={() => setAddingAccount(true)}
              className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <Plus className="w-4 h-4" />
              Add account
            </button>
          )}
        </div>
        {addingAccount && (
          <AddAccountForm
            onDone={() => {
              setAddingAccount(false);
              router.refresh();
            }}
            onCancel={() => setAddingAccount(false)}
          />
        )}
        {activeAccounts.length === 0 && !addingAccount ? (
          <div className="flex flex-col items-center text-center rounded-lg border border-dashed border-[var(--border)] px-6 py-8">
            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--muted)] mb-3">
              <Landmark className="w-5 h-5 text-[var(--muted-foreground)]" />
            </span>
            <p className="text-sm font-medium text-[var(--foreground)]">No accounts yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm">
              Add your Bank of America and American Express accounts, then import
              statements or add rows manually.
            </p>
            <button
              onClick={() => setAddingAccount(true)}
              className="pressable mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#0C0F14] shadow-sm transition-[filter] hover:brightness-105"
              style={{ background: ACCENT }}
            >
              <Plus className="w-4 h-4" />
              Add account
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-1">
            {activeAccounts.map((a) => (
              <AccountChip key={a.id} account={a} onChange={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>

      {/* Add transaction */}
      {addingTx && (
        <AddTransactionForm
          accounts={activeAccounts}
          categoryTree={tree}
          properties={properties}
          onDone={() => {
            setAddingTx(false);
            router.refresh();
          }}
          onCancel={() => setAddingTx(false)}
        />
      )}

      {/* Import statement */}
      {importing && (
        <ImportDialog accounts={activeAccounts} onClose={() => setImporting(false)} />
      )}

      {/* Ledger with staged "Save changes" */}
      <HomeLedger
        transactions={txs}
        accounts={accounts}
        categories={categories}
        properties={properties}
        year={year}
        onApplyEdits={applyEdits}
        onRemove={removeTx}
      />
    </div>
  );
}

/* ── Summary tile ─────────────────────────────────────────────── */
function SummaryTile({
  label,
  value,
  icon,
  valueColor,
  accent,
  signed,
  percent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueColor: string;
  accent?: string;
  signed?: boolean;
  percent?: boolean;
}) {
  const text = percent
    ? `${Math.round(value * 100)}%`
    : `${signed && value >= 0 ? "+" : ""}${formatCurrency(value)}`;
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm transition-all hover:border-[var(--muted-foreground)]/25 hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--muted-foreground)] font-medium">{label}</span>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={accent ? { background: `${accent}1A`, color: accent } : undefined}
        >
          {icon}
        </div>
      </div>
      <p className={cn("text-2xl font-bold font-data tracking-tight", valueColor)}>{text}</p>
    </div>
  );
}

/* ── Account chip ─────────────────────────────────────────────── */
function AccountChip({
  account,
  onChange,
}: {
  account: HomeAccountDTO;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = account.type === "AMEX" || account.type === "BOFA_CARD" ? CreditCard : Landmark;
  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/home/accounts/${account.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="group inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-2.5 pr-2 py-1.5 shadow-sm transition-colors hover:border-[var(--muted-foreground)]/30">
      <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--muted)]">
        <Icon className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
      </span>
      <span className="text-sm font-medium text-[var(--foreground)]">{account.name}</span>
      <span className="text-xs text-[var(--muted-foreground)] font-data">
        {accountTypeShort(account.type)}
        {account.last4 ? ` ·${account.last4}` : ""}
      </span>
      <button
        onClick={remove}
        disabled={busy}
        title="Remove account (and its transactions)"
        className="pressable p-0.5 rounded text-[var(--muted-foreground)] hover:text-[#FF4D6A] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/* ── Add account form ─────────────────────────────────────────── */
function AddAccountForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<HomeAccountType>("BOFA_CHECKING");
  const [last4, setLast4] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/home/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, last4: last4 || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to add account");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 mb-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as HomeAccountType)}
            className={inputCls}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Joint Checking"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Last 4 (optional)</span>
          <input
            value={last4}
            maxLength={4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
            placeholder="1234"
            className={inputCls}
          />
        </label>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[#FF4D6A]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="pressable text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="pressable inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#0C0F14] shadow-sm transition-[filter] hover:brightness-105 disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Add account
        </button>
      </div>
    </form>
  );
}

/* ── Add transaction form ─────────────────────────────────────── */
function AddTransactionForm({
  accounts,
  categoryTree,
  properties,
  onDone,
  onCancel,
}: {
  accounts: HomeAccountDTO[];
  categoryTree: ReturnType<typeof buildCategoryTree>;
  properties: PropertyOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [homeAccountId, setHomeAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState<"OUT" | "IN">("OUT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sel, setSel] = useState<Selection>({ categoryId: null, propertyId: null });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!homeAccountId) {
      setError("Add an account first");
      return;
    }
    setSaving(true);
    const signed = (direction === "OUT" ? -1 : 1) * Math.abs(Number(amount));
    try {
      const res = await fetch("/api/home/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeAccountId,
          date,
          amount: signed,
          description,
          categoryId: sel.propertyId ? null : sel.categoryId,
          propertyId: sel.propertyId,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to add row");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add row");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Add transaction</h3>
        <button type="button" onClick={onCancel} className="pressable p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5">
        {(["OUT", "IN"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              direction === d
                ? d === "IN"
                  ? "bg-[#00D68F]/15 text-[#00D68F]"
                  : "bg-[#FF4D6A]/15 text-[#FF4D6A]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {d === "IN" ? "Money in" : "Money out"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Account</span>
          <select value={homeAccountId} onChange={(e) => setHomeAccountId(e.target.value)} className={inputCls}>
            {accounts.length === 0 && <option value="">No accounts yet</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Date</span>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Amount</span>
          <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Description</span>
          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Whole Foods" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Category / property</span>
          <HomeCategorySelect
            tree={categoryTree}
            properties={properties}
            categoryId={sel.categoryId}
            propertyId={sel.propertyId}
            onSelect={setSel}
            className={inputCls}
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any clarity you want to add" className={inputCls} />
        </label>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[#FF4D6A]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="pressable inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#0C0F14] shadow-sm transition-[filter] hover:brightness-105 disabled:opacity-60" style={{ background: ACCENT }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add transaction
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors focus:outline-none focus:border-[#00D68F] focus:ring-2 focus:ring-[#00D68F]/20";

const secondaryBtn =
  "pressable inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)]/30";
