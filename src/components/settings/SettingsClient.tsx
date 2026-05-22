"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  Plus,
  X,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface AccountFields {
  calendarYear: number;
  startingBalance: number;
  accountOpenBalance: number;
  commissionPerShare: number;
  minimumCommission: number;
}

interface Leverage {
  id: string;
  symbol: string;
  leverage: number;
}

interface FundTx {
  id: string;
  amount: number;
  comment: string | null;
  occurredAt: string;
}

interface Props {
  account: AccountFields;
  leverages: Leverage[];
  funds: FundTx[];
  fundsMigrationNeeded: boolean;
}

export default function SettingsClient({
  account,
  leverages: initialLeverages,
  funds: initialFunds,
  fundsMigrationNeeded,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Account fields
  const [calendarYear, setCalendarYear] = useState(account.calendarYear.toString());
  const [startingBalance, setStartingBalance] = useState(account.startingBalance.toString());
  const [accountOpenBalance, setAccountOpenBalance] = useState(account.accountOpenBalance.toString());
  const [commissionPerShare, setCommissionPerShare] = useState(account.commissionPerShare.toString());
  const [minimumCommission, setMinimumCommission] = useState(account.minimumCommission.toString());

  // Leverages
  const [leverages, setLeverages] = useState(initialLeverages);
  const [newSymbol, setNewSymbol] = useState("");
  const [newLeverage, setNewLeverage] = useState("");

  // Funds
  const [funds, setFunds] = useState(initialFunds);
  const [fundAmount, setFundAmount] = useState("");
  const [fundComment, setFundComment] = useState("");
  const [fundDate, setFundDate] = useState(new Date().toISOString().slice(0, 10));
  const [fundType, setFundType] = useState<"deposit" | "withdrawal">("deposit");

  // UI state
  const [saving, setSaving] = useState(false);
  const [savingFund, setSavingFund] = useState(false);
  const [savingMigration, setSavingMigration] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const netFunds = useMemo(
    () => funds.reduce((s, t) => s + t.amount, 0),
    [funds]
  );

  function showMessage(text: string, ok: boolean) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleSaveAccount() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        accountSettings: {
          calendarYear: parseInt(calendarYear) || account.calendarYear,
          startingBalance: parseFloat(startingBalance),
          accountOpenBalance: parseFloat(accountOpenBalance),
          commissionPerShare: parseFloat(commissionPerShare),
          minimumCommission: parseFloat(minimumCommission),
        },
      };
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      showMessage("Saved.", true);
      startTransition(() => router.refresh());
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed to save", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLeverage() {
    const symbol = newSymbol.trim();
    const lev = parseFloat(newLeverage);
    if (!symbol || isNaN(lev) || lev <= 0) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetLeverage: { symbol, leverage: lev } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeverages((prev) => {
        const without = prev.filter((l) => l.symbol !== symbol);
        return [...without, { id: `tmp-${Date.now()}`, symbol, leverage: lev }].sort(
          (a, b) => a.symbol.localeCompare(b.symbol)
        );
      });
      setNewSymbol("");
      setNewLeverage("");
      startTransition(() => router.refresh());
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed", false);
    }
  }

  async function handleRemoveLeverage(symbol: string) {
    if (!confirm(`Remove leverage entry for ${symbol}?`)) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAssetLeverage: symbol }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeverages((prev) => prev.filter((l) => l.symbol !== symbol));
      startTransition(() => router.refresh());
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed", false);
    }
  }

  async function handleRunFundsMigration() {
    setSavingMigration(true);
    try {
      const res = await fetch("/api/admin/migrate-add-funds", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      showMessage("Funds table ready — reload to use it.", true);
      startTransition(() => router.refresh());
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed", false);
    } finally {
      setSavingMigration(false);
    }
  }

  async function handleAddFund() {
    const num = parseFloat(fundAmount);
    if (isNaN(num) || num <= 0) {
      showMessage("Enter a positive amount", false);
      return;
    }
    setSavingFund(true);
    try {
      const signedAmount = fundType === "deposit" ? num : -num;
      const res = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: signedAmount,
          occurredAt: fundDate,
          comment: fundComment || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setFunds((prev) =>
        [
          {
            id: created.id,
            amount: created.amount,
            comment: created.comment,
            occurredAt: created.occurredAt,
          },
          ...prev,
        ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      );
      setFundAmount("");
      setFundComment("");
      showMessage(
        `${fundType === "deposit" ? "Deposit" : "Withdrawal"} recorded.`,
        true
      );
      startTransition(() => router.refresh());
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed", false);
    } finally {
      setSavingFund(false);
    }
  }

  async function handleDeleteFund(id: string) {
    if (!confirm("Delete this fund transaction?")) return;
    try {
      const res = await fetch(`/api/funds/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFunds((prev) => prev.filter((f) => f.id !== id));
      startTransition(() => router.refresh());
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed", false);
    }
  }

  const inputClass =
    "w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[#3B82F6] transition-colors";
  const labelClass = "block text-sm font-medium text-[var(--muted-foreground)] mb-1";

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Account configuration, leverages, and fund transactions
        </p>
      </div>

      {message && (
        <div
          className={cn(
            "mb-6 rounded-lg border px-4 py-2.5 text-sm max-w-3xl",
            message.ok
              ? "border-[#00D68F]/30 bg-[#00D68F]/10 text-[#00D68F]"
              : "border-[#FF4D6A]/30 bg-[#FF4D6A]/10 text-[#FF4D6A]"
          )}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6 max-w-3xl">
        {/* Account Settings */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Account Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Calendar Year</label>
              <input
                type="number"
                value={calendarYear}
                onChange={(e) => setCalendarYear(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Starting Balance ($)</label>
              <input
                type="number"
                step="0.01"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Account Open Balance ($)</label>
              <input
                type="number"
                step="0.01"
                value={accountOpenBalance}
                onChange={(e) => setAccountOpenBalance(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Commission Per Share</label>
              <input
                type="number"
                step="0.000001"
                value={commissionPerShare}
                onChange={(e) => setCommissionPerShare(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Minimum Commission ($)</label>
              <input
                type="number"
                step="0.01"
                value={minimumCommission}
                onChange={(e) => setMinimumCommission(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleSaveAccount}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Account Settings
            </button>
          </div>
        </div>

        {/* Funds */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#A78BFA]" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Deposits & Withdrawals
              </h2>
            </div>
            {!fundsMigrationNeeded && (
              <div className="text-right">
                <p className="text-xs text-[var(--muted-foreground)]">Net adjustments</p>
                <p
                  className={cn(
                    "text-sm font-bold font-data",
                    netFunds >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {netFunds >= 0 ? "+" : ""}
                  {formatCurrency(netFunds)}
                </p>
              </div>
            )}
          </div>

          {fundsMigrationNeeded ? (
            <div className="rounded-lg border border-[#FFB547]/30 bg-[#FFB547]/10 p-4 text-sm">
              <div className="flex items-start gap-2 text-[#FFB547]">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">One-time setup needed</p>
                  <p className="mt-1 text-[#FFB547]/80 text-xs">
                    The fund-transactions table doesn&apos;t exist yet. Click below to create it.
                  </p>
                  <button
                    onClick={handleRunFundsMigration}
                    disabled={savingMigration}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-3 py-1.5 text-xs font-medium text-[var(--background)] hover:bg-[#FFB547]/90 disabled:opacity-60"
                  >
                    {savingMigration && <Loader2 className="w-3 h-3 animate-spin" />}
                    Set up funds table
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Add form */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
                <div className="md:col-span-3">
                  <label className={labelClass}>Type</label>
                  <div className="flex rounded-lg border border-[var(--border)] overflow-hidden h-[38px]">
                    <button
                      type="button"
                      onClick={() => setFundType("deposit")}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors",
                        fundType === "deposit"
                          ? "bg-[#00D68F]/15 text-[#00D68F]"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      )}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundType("withdrawal")}
                      className={cn(
                        "flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors",
                        fundType === "withdrawal"
                          ? "bg-[#FF4D6A]/15 text-[#FF4D6A]"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      )}
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      Withdraw
                    </button>
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="1000.00"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Date</label>
                  <input
                    type="date"
                    value={fundDate}
                    onChange={(e) => setFundDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-3 flex items-end">
                  <button
                    onClick={handleAddFund}
                    disabled={savingFund || !fundAmount}
                    className="w-full inline-flex items-center justify-center gap-2 h-[38px] rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-60"
                  >
                    {savingFund ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add
                  </button>
                </div>
                <div className="md:col-span-12">
                  <label className={labelClass}>Comment (optional)</label>
                  <input
                    type="text"
                    value={fundComment}
                    onChange={(e) => setFundComment(e.target.value)}
                    placeholder="e.g. wire transfer, broker rebate, tax payment..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Transaction list */}
              {funds.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                  No deposits or withdrawals yet.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)] text-xs">
                        <th className="px-2 py-2 text-left font-medium">Date</th>
                        <th className="px-2 py-2 text-left font-medium">Type</th>
                        <th className="px-2 py-2 text-right font-medium">Amount</th>
                        <th className="px-2 py-2 text-left font-medium">Comment</th>
                        <th className="px-2 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {funds.map((f) => {
                        const isDeposit = f.amount >= 0;
                        return (
                          <tr
                            key={f.id}
                            className="border-b border-[#2A3040]/50 last:border-0"
                          >
                            <td className="px-2 py-2 font-mono text-[var(--muted-foreground)] text-xs">
                              {f.occurredAt}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                                  isDeposit
                                    ? "bg-[#00D68F]/10 text-[#00D68F]"
                                    : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                                )}
                              >
                                {isDeposit ? (
                                  <ArrowUpCircle className="w-3 h-3" />
                                ) : (
                                  <ArrowDownCircle className="w-3 h-3" />
                                )}
                                {isDeposit ? "Deposit" : "Withdraw"}
                              </span>
                            </td>
                            <td
                              className={cn(
                                "px-2 py-2 text-right font-mono font-semibold",
                                isDeposit ? "text-[#00D68F]" : "text-[#FF4D6A]"
                              )}
                            >
                              {isDeposit ? "+" : ""}
                              {formatCurrency(f.amount)}
                            </td>
                            <td className="px-2 py-2 text-[var(--foreground)] text-xs">
                              {f.comment || (
                                <span className="text-[var(--border)]">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                onClick={() => handleDeleteFund(f.id)}
                                className="p-1 rounded text-[var(--muted-foreground)] hover:text-[#FF4D6A] transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Asset Leverages */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Asset Leverages
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Leverage multipliers applied to leveraged instruments (Oil, S&amp;P,
            EUR-USD, etc.).
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="Symbol"
              className={`${inputClass} max-w-[160px]`}
            />
            <input
              type="number"
              value={newLeverage}
              onChange={(e) => setNewLeverage(e.target.value)}
              placeholder="Leverage"
              step="0.5"
              className={`${inputClass} max-w-[140px]`}
            />
            <button
              onClick={handleAddLeverage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#3B82F6]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add / Update
            </button>
          </div>

          {leverages.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No leverages configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)] text-xs">
                    <th className="text-left py-2 font-medium">Symbol</th>
                    <th className="text-right py-2 font-medium">Leverage</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {leverages.map((l) => (
                    <tr key={l.id} className="border-b border-[#2A3040]/50 last:border-0">
                      <td className="py-2 font-medium text-[var(--foreground)]">
                        {l.symbol}
                      </td>
                      <td className="py-2 text-right text-[var(--foreground)] font-data">
                        {l.leverage}x
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRemoveLeverage(l.symbol)}
                          className="p-1 rounded text-[var(--muted-foreground)] hover:text-[#FF4D6A] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
