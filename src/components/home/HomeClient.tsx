"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home as HomeIcon,
  Plus,
  Upload,
  Trash2,
  Loader2,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Tag,
  EyeOff,
  Eye,
  Pencil,
  AlertCircle,
  CreditCard,
  Landmark,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";
import ImportDialog from "@/components/home/ImportDialog";
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
} from "@/lib/home";

const ACCENT = "#00D68F";

export default function HomeClient({
  accounts,
  categories,
  transactions,
  year,
  availableYears,
  reviewCount,
}: {
  accounts: HomeAccountDTO[];
  categories: HomeCategoryDTO[];
  transactions: HomeTransactionDTO[];
  year: number;
  availableYears: number[];
  reviewCount: number;
}) {
  const router = useRouter();
  const [addingAccount, setAddingAccount] = useState(false);
  const [addingTx, setAddingTx] = useState(false);
  const [importing, setImporting] = useState(false);

  const activeAccounts = accounts.filter((a) => !a.archivedAt);
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const totals = useMemo(() => {
    let income = 0;
    let spend = 0;
    for (const t of transactions) {
      if (isIncome(t)) income += t.amount;
      else if (isSpend(t)) spend += -t.amount;
    }
    const net = income - spend;
    const savingsRate = income > 0 ? net / income : 0;
    return { income, spend, net, savingsRate };
  }, [transactions]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: `${ACCENT}1A` }}
          >
            <HomeIcon className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Home</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Household spending & cash flow · {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {availableYears.length > 0 && (
            <YearPicker years={availableYears} selected={year} />
          )}
          <Link
            href="/home/categories"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[color:var(--border)] transition-colors"
          >
            <Tag className="w-4 h-4" />
            Categories
          </Link>
          <button
            onClick={() => setAddingTx(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[color:var(--border)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add row
          </button>
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#0C0F14] transition-colors"
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
          className="flex items-center gap-2 rounded-xl border border-[#FFB547]/40 bg-[#FFB547]/10 px-4 py-3 text-sm hover:bg-[#FFB547]/15 transition-colors"
        >
          <AlertCircle className="w-4 h-4 text-[#FFB547]" />
          <span className="text-[var(--foreground)]">
            <span className="font-semibold">{reviewCount}</span> transaction
            {reviewCount !== 1 ? "s" : ""} need review
          </span>
        </Link>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile
          label={`Income · ${year}`}
          value={totals.income}
          icon={<TrendingUp className="w-5 h-5" />}
          valueColor="text-[#00D68F]"
        />
        <SummaryTile
          label={`Spending · ${year}`}
          value={totals.spend}
          icon={<TrendingDown className="w-5 h-5" />}
          valueColor="text-[#FF4D6A]"
        />
        <SummaryTile
          label={`Net · ${year}`}
          value={totals.net}
          icon={<Wallet className="w-5 h-5" />}
          valueColor={totals.net >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          signed
        />
        <SummaryTile
          label="Savings rate"
          value={totals.savingsRate}
          icon={<PiggyBank className="w-5 h-5" />}
          valueColor={totals.savingsRate >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          percent
        />
      </div>

      {/* Accounts / sources */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Accounts
          </h3>
          {!addingAccount && (
            <button
              onClick={() => setAddingAccount(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
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
          <p className="text-sm text-[var(--muted-foreground)]">
            Add your Bank of America and American Express accounts, then import
            statements or add rows manually.
          </p>
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

      {/* Ledger */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
          Transactions · {year}
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-2">
            No transactions yet. Import a statement or add a row to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {transactions.map((t) => (
              <TxRow
                key={t.id}
                tx={t}
                account={accountById.get(t.homeAccountId)}
                category={t.categoryId ? catById.get(t.categoryId) : undefined}
                categoryTree={tree}
                onChange={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Summary tile ─────────────────────────────────────────────── */
function SummaryTile({
  label,
  value,
  icon,
  valueColor,
  signed,
  percent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueColor: string;
  signed?: boolean;
  percent?: boolean;
}) {
  const text = percent
    ? `${Math.round(value * 100)}%`
    : `${signed && value >= 0 ? "+" : ""}${formatCurrency(value)}`;
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--muted-foreground)] font-medium">{label}</span>
        <div className="text-[var(--muted-foreground)]">{icon}</div>
      </div>
      <p className={cn("text-2xl font-bold font-data", valueColor)}>{text}</p>
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
    <div className="group inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-3 pr-2 py-1.5">
      <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
      <span className="text-sm text-[var(--foreground)]">{account.name}</span>
      <span className="text-xs text-[var(--muted-foreground)]">
        {accountTypeShort(account.type)}
        {account.last4 ? ` ·${account.last4}` : ""}
      </span>
      <button
        onClick={remove}
        disabled={busy}
        title="Remove account (and its transactions)"
        className="text-[var(--muted-foreground)] hover:text-[#FF4D6A] opacity-0 group-hover:opacity-100 transition-opacity"
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
    <form onSubmit={submit} className="rounded-lg border border-[var(--border)] p-4 mb-3 space-y-3">
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
      {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Add account
        </button>
      </div>
    </form>
  );
}

/* ── Category select (grouped two-level) ──────────────────────── */
function CategorySelect({
  tree,
  value,
  onChange,
  className,
}: {
  tree: ReturnType<typeof buildCategoryTree>;
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={className ?? inputCls}
    >
      <option value="">Uncategorized</option>
      {tree.map((parent) => (
        <optgroup key={parent.id} label={parent.name}>
          {/* Allow assigning the parent itself, plus each child. */}
          <option value={parent.id}>{parent.name} (general)</option>
          {parent.children.map((c) => (
            <option key={c.id} value={c.id}>
              {parent.name} › {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/* ── Add transaction form ─────────────────────────────────────── */
function AddTransactionForm({
  accounts,
  categoryTree,
  onDone,
  onCancel,
}: {
  accounts: HomeAccountDTO[];
  categoryTree: ReturnType<typeof buildCategoryTree>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [homeAccountId, setHomeAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState<"OUT" | "IN">("OUT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
          categoryId,
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
    <form onSubmit={submit} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Add transaction</h3>
        <button type="button" onClick={onCancel} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
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
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Category</span>
          <CategorySelect tree={categoryTree} value={categoryId} onChange={setCategoryId} />
        </label>
        <label className="block sm:col-span-3">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any clarity you want to add" className={inputCls} />
        </label>
      </div>
      {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60" style={{ background: ACCENT }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add transaction
        </button>
      </div>
    </form>
  );
}

/* ── Ledger row ───────────────────────────────────────────────── */
function TxRow({
  tx,
  account,
  category,
  categoryTree,
  onChange,
}: {
  tx: HomeTransactionDTO;
  account?: HomeAccountDTO;
  category?: HomeCategoryDTO;
  categoryTree: ReturnType<typeof buildCategoryTree>;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/home/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/home/transactions/${tx.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  const out = tx.amount < 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--muted)] transition-colors group",
        tx.isExcluded && "opacity-55"
      )}
    >
      <span className="text-xs text-[var(--muted-foreground)] font-data w-12 shrink-0">
        {tx.date.slice(5)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--foreground)] truncate">{tx.description}</span>
          {tx.needsReview && (
            <span className="text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[#FFB547]/15 text-[#FFB547] shrink-0">
              Review
            </span>
          )}
          {tx.isExcluded && (
            <span className="text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] shrink-0">
              Excluded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {account && <span className="truncate">{account.name}</span>}
          {tx.notes && <span className="truncate italic">· {tx.notes}</span>}
        </div>
      </div>
      {/* Category assign */}
      <CategorySelect
        tree={categoryTree}
        value={tx.categoryId}
        onChange={(id) => patch({ categoryId: id })}
        className="hidden md:block max-w-[190px] rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none"
      />
      <span
        className={cn(
          "text-sm font-data font-semibold w-24 text-right shrink-0",
          tx.isExcluded ? "text-[var(--muted-foreground)]" : out ? "text-[#FF4D6A]" : "text-[#00D68F]"
        )}
      >
        {out ? "−" : "+"}
        {formatCurrency(Math.abs(tx.amount))}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => patch({ isExcluded: !tx.isExcluded, excludeReason: tx.isExcluded ? null : "Manually excluded" })}
          disabled={busy}
          title={tx.isExcluded ? "Include in spending" : "Exclude (transfer / payment)"}
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors opacity-0 group-hover:opacity-100"
        >
          {tx.isExcluded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setEditing((e) => !e)}
          title="Edit"
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors opacity-0 group-hover:opacity-100"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={remove}
          disabled={busy}
          title="Delete"
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[var(--card)] transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {editing && (
        <EditTxModal
          tx={tx}
          categoryTree={categoryTree}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

/* ── Edit modal ───────────────────────────────────────────────── */
function EditTxModal({
  tx,
  categoryTree,
  onClose,
  onSaved,
}: {
  tx: HomeTransactionDTO;
  categoryTree: ReturnType<typeof buildCategoryTree>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(tx.date);
  const [direction, setDirection] = useState<"OUT" | "IN">(tx.amount < 0 ? "OUT" : "IN");
  const [amount, setAmount] = useState(String(Math.abs(tx.amount)));
  const [description, setDescription] = useState(tx.description);
  const [categoryId, setCategoryId] = useState<string | null>(tx.categoryId);
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const signed = (direction === "OUT" ? -1 : 1) * Math.abs(Number(amount));
    try {
      const res = await fetch(`/api/home/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, amount: signed, description, categoryId, notes: notes || null }),
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
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Category</span>
          <CategorySelect tree={categoryTree} value={categoryId} onChange={setCategoryId} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add clarity to this row" className={inputCls} />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60" style={{ background: ACCENT }}>
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
