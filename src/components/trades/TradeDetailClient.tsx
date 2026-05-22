"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Pencil,
  TrendingUp,
  TrendingDown,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type { Trade } from "@/lib/types";

export default function TradeDetailClient({ trade }: { trade: Trade | null }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!trade) return;
    if (
      !confirm(
        `Permanently delete this ${trade.direction} ${trade.symbol} trade from ${trade.tradeDate}?\n\nThis can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/trades/${trade.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      router.push("/trades");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }
  if (!trade) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Trade not found</h1>
          <p className="text-[var(--muted-foreground)] mb-6">
            The trade you are looking for does not exist.
          </p>
          <Link
            href="/trades"
            className="inline-flex items-center gap-1.5 text-sm text-[#3B82F6] hover:text-[#3B82F6]/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trades
          </Link>
        </div>
      </div>
    );
  }

  const pnl = trade.totalPnL ?? 0;
  const isProfit = pnl > 0;
  const isLoss = pnl < 0;
  const totalShares = trade.totalShares ?? 0;
  const sharesOpen = trade.sharesInProcess ?? 0;
  const isPartial =
    !trade.isCompleted &&
    totalShares > 0 &&
    sharesOpen > 0 &&
    sharesOpen < totalShares;
  const hasRealized = trade.isCompleted || isPartial;
  const buyLegs = trade.entries
    .filter((e) => e.legType === "BUY")
    .sort((a, b) => a.legOrder - b.legOrder);
  const sellLegs = trade.entries
    .filter((e) => e.legType === "SELL")
    .sort((a, b) => a.legOrder - b.legOrder);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/trades"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trades
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:border-[#FF4D6A]/40 transition-colors disabled:opacity-60"
              title="Permanently delete this trade"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </button>
            <Link
              href={`/trades/${trade.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className={cn(
              "flex items-center justify-center h-12 w-12 rounded-xl",
              isProfit || pnl === 0
                ? "bg-[#00D68F]/10"
                : "bg-[#FF4D6A]/10"
            )}
          >
            {isLoss ? (
              <TrendingDown className="h-6 w-6 text-[#FF4D6A]" />
            ) : (
              <TrendingUp className="h-6 w-6 text-[#00D68F]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{trade.symbol}</h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                  trade.direction === "LONG"
                    ? "bg-[#00D68F]/10 text-[#00D68F]"
                    : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                )}
              >
                {trade.direction}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
                  trade.isCompleted
                    ? "bg-[#00D68F]/10 text-[#00D68F]"
                    : isPartial
                    ? "bg-[#FFB547]/10 text-[#FFB547]"
                    : "bg-[#3B82F6]/10 text-[#3B82F6]"
                )}
                title={
                  isPartial
                    ? `Partial exit — ${sharesOpen} of ${totalShares} shares still open`
                    : undefined
                }
              >
                {trade.isCompleted
                  ? "Closed"
                  : isPartial
                  ? `Partial (${sharesOpen}/${totalShares} open)`
                  : "Open"}
              </span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              {trade.tradeDate}
              {trade.tradeType && ` \u00B7 ${trade.tradeType}`}
              {trade.isSwingContinuation && " \u00B7 Swing Continuation"}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <StatCard label={isPartial ? "Realized P&L" : "P&L"} large>
            <span
              className={cn(
                "font-mono",
                isProfit && "text-[#00D68F]",
                isLoss && "text-[#FF4D6A]"
              )}
            >
              {hasRealized ? formatCurrency(pnl) : "Open"}
            </span>
          </StatCard>
          <StatCard label="Position Value">
            <span className="font-mono">
              {formatCurrency(trade.totalPositionValue ?? 0)}
            </span>
          </StatCard>
          <StatCard label="Avg Buy">
            <span className="font-mono">
              {trade.avgBuyPrice ? formatCurrency(trade.avgBuyPrice) : "\u2014"}
            </span>
          </StatCard>
          <StatCard label="Avg Sell">
            <span className="font-mono">
              {trade.avgSellPrice && trade.avgSellPrice > 0
                ? formatCurrency(trade.avgSellPrice)
                : "\u2014"}
            </span>
          </StatCard>
          <StatCard label="Total Shares">
            <span className="font-mono">{trade.totalShares ?? 0}</span>
          </StatCard>
          <StatCard label="R/R">
            <span
              className={cn(
                "font-mono",
                isProfit && "text-[#00D68F]",
                isLoss && "text-[#FF4D6A]"
              )}
            >
              {hasRealized ? formatNumber(trade.riskReward ?? 0) : "\u2014"}
            </span>
          </StatCard>
          <StatCard label="Return on Position">
            <span
              className={cn(
                "font-mono",
                isProfit && "text-[#00D68F]",
                isLoss && "text-[#FF4D6A]"
              )}
            >
              {hasRealized
                ? formatPercent(trade.returnOnPosition ?? 0)
                : "\u2014"}
            </span>
          </StatCard>
          <StatCard label="Commissions">
            <span className="font-mono">
              {formatCurrency(trade.totalCommissions ?? 0)}
            </span>
          </StatCard>
        </div>

        {/* Trade Legs */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8">
          <h2 className="text-base font-semibold mb-4">Trade Legs</h2>

          {buyLegs.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Buy Legs
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                      <th className="pb-2 text-left font-medium">#</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Quantity</th>
                      <th className="pb-2 text-right font-medium">
                        Commission
                      </th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyLegs.map((leg, i) => (
                      <tr
                        key={leg.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="py-2 text-[var(--muted-foreground)]">
                          {leg.legOrder}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(leg.price)}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {leg.quantity}
                        </td>
                        <td className="py-2 text-right font-mono text-[var(--muted-foreground)]">
                          {formatCurrency(leg.commission)}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(leg.price * leg.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sellLegs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Sell Legs
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                      <th className="pb-2 text-left font-medium">#</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Quantity</th>
                      <th className="pb-2 text-right font-medium">
                        Commission
                      </th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellLegs.map((leg) => (
                      <tr
                        key={leg.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="py-2 text-[var(--muted-foreground)]">
                          {leg.legOrder}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(leg.price)}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {leg.quantity}
                        </td>
                        <td className="py-2 text-right font-mono text-[var(--muted-foreground)]">
                          {formatCurrency(leg.commission)}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(leg.price * leg.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Post-Trade Analysis */}
        {(trade.entryReason ||
          trade.exitReason ||
          trade.conclusions ||
          trade.notes) && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8">
            <h2 className="text-base font-semibold mb-4">
              Post-Trade Analysis
            </h2>
            <div className="space-y-4">
              {trade.entryReason && (
                <div>
                  <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-1">
                    Entry Reason
                  </h3>
                  <p className="text-sm">{trade.entryReason}</p>
                </div>
              )}
              {trade.exitReason && (
                <div>
                  <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-1">
                    Exit Reason
                  </h3>
                  <p className="text-sm">{trade.exitReason}</p>
                </div>
              )}
              {trade.conclusions && (
                <div>
                  <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-1">
                    Conclusions
                  </h3>
                  <p className="text-sm">{trade.conclusions}</p>
                </div>
              )}
              {trade.notes && (
                <div>
                  <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-1">
                    Notes
                  </h3>
                  <p className="text-sm">{trade.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Tags */}
        {trade.tradeErrors.length > 0 && (
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8">
            <h2 className="text-base font-semibold mb-4">Error Tags</h2>
            <div className="flex flex-wrap gap-2">
              {trade.tradeErrors.map((err) => (
                <span
                  key={err.errorDefinition.id}
                  className="inline-flex items-center rounded-lg bg-[#FF4D6A]/10 px-3 py-1.5 text-xs font-medium text-[#FF4D6A]"
                >
                  {err.errorDefinition.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Money Left on Table */}
        {trade.direction === "LONG" &&
          (trade.moneyLeftHighPct !== null ||
            trade.moneyLeftClosePct !== null) && (
            <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8">
              <h2 className="text-base font-semibold mb-4">
                Money Left on Table
              </h2>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">
                    Daily High
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {trade.dailyHigh ? formatCurrency(trade.dailyHigh) : "\u2014"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">
                    Daily Close
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {trade.dailyClose
                      ? formatCurrency(trade.dailyClose)
                      : "\u2014"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">
                    vs High
                  </div>
                  <div className="text-sm font-mono font-semibold text-[var(--muted-foreground)]">
                    {trade.moneyLeftHighPct !== null
                      ? formatPercent(trade.moneyLeftHighPct)
                      : "\u2014"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">
                    vs Close
                  </div>
                  <div className="text-sm font-mono font-semibold text-[var(--muted-foreground)]">
                    {trade.moneyLeftClosePct !== null
                      ? formatPercent(trade.moneyLeftClosePct)
                      : "\u2014"}
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  children,
  large,
}: {
  label: string;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
      <div className="text-xs text-[var(--muted-foreground)] mb-1">{label}</div>
      <div className={cn("font-semibold", large ? "text-xl" : "text-sm")}>
        {children}
      </div>
    </div>
  );
}
