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
  FileQuestion,
  ArrowDownToDot,
  ArrowUpFromDot,
} from "lucide-react";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type { Trade } from "@/lib/types";

const LEG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format a leg's filledAt (ISO date or datetime string) as a compact "Mon D".
function formatLegDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${LEG_MONTHS[m - 1]} ${d}`;
}

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
      router.push("/trade/trades");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }
  if (!trade) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-4">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
            <FileQuestion className="h-8 w-8 text-[var(--muted-foreground)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Trade not found</h1>
          <p className="text-[var(--muted-foreground)] mb-6 max-w-sm">
            The trade you are looking for does not exist or may have been deleted.
          </p>
          <Link
            href="/trade/trades"
            className="pressable inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-[#3B82F6]/20 hover:bg-[#3B82F6]/90 transition-colors"
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
      {/* Sticky navigation */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/trade/trades"
            className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trades
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[#FF4D6A] hover:border-[#FF4D6A]/40 transition-colors disabled:opacity-60"
              title="Permanently delete this trade"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Delete</span>
            </button>
            <Link
              href={`/trade/trades/${trade.id}/edit`}
              className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className={cn(
              "flex items-center justify-center h-14 w-14 rounded-2xl ring-1",
              isProfit || pnl === 0
                ? "bg-[#00D68F]/10 ring-[#00D68F]/20"
                : "bg-[#FF4D6A]/10 ring-[#FF4D6A]/20"
            )}
          >
            {isLoss ? (
              <TrendingDown className="h-7 w-7 text-[#FF4D6A]" />
            ) : (
              <TrendingUp className="h-7 w-7 text-[#00D68F]" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{trade.symbol}</h1>
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
            <p className="text-sm text-[var(--muted-foreground)] mt-1.5">
              <span className="font-data">{trade.tradeDate}</span>
              {trade.tradeType && ` \u00B7 ${trade.tradeType}`}
              {trade.isSwingContinuation && " \u00B7 Swing Continuation"}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-8">
          <StatCard
            label={isPartial ? "Realized P&L" : "P&L"}
            large
            accent={
              hasRealized
                ? isProfit
                  ? "#00D68F"
                  : isLoss
                  ? "#FF4D6A"
                  : undefined
                : undefined
            }
          >
            <span
              className={cn(
                "font-data",
                isProfit && "text-[#00D68F]",
                isLoss && "text-[#FF4D6A]"
              )}
            >
              {hasRealized ? formatCurrency(pnl) : "Open"}
            </span>
          </StatCard>
          <StatCard label="Position Value">
            <span className="font-data">
              {formatCurrency(trade.totalPositionValue ?? 0)}
            </span>
          </StatCard>
          <StatCard label="Avg Buy">
            <span className="font-data">
              {trade.avgBuyPrice ? formatCurrency(trade.avgBuyPrice) : "\u2014"}
            </span>
          </StatCard>
          <StatCard label="Avg Sell">
            <span className="font-data">
              {trade.avgSellPrice && trade.avgSellPrice > 0
                ? formatCurrency(trade.avgSellPrice)
                : "\u2014"}
            </span>
          </StatCard>
          <StatCard label="Total Shares">
            <span className="font-data">{trade.totalShares ?? 0}</span>
          </StatCard>
          <StatCard label="R/R">
            <span
              className={cn(
                "font-data",
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
                "font-data",
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
            <span className="font-data">
              {formatCurrency(trade.totalCommissions ?? 0)}
            </span>
          </StatCard>
        </div>

        {/* Trade Legs */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8 shadow-sm">
          <h2 className="text-base font-semibold mb-5">Trade Legs</h2>

          {buyLegs.length > 0 && (
            <div className="mb-6 last:mb-0">
              <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#00D68F]">
                <ArrowDownToDot className="h-4 w-4" />
                Buy Legs
              </h3>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Price</th>
                      <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Commission
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyLegs.map((leg) => (
                      <tr
                        key={leg.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="px-3 py-2 font-data text-[var(--muted-foreground)]">
                          {leg.legOrder}
                        </td>
                        <td className="px-3 py-2 font-data text-[var(--muted-foreground)]">
                          {formatLegDate(leg.filledAt)}
                        </td>
                        <td className="px-3 py-2 text-right font-data">
                          {formatCurrency(leg.price)}
                        </td>
                        <td className="px-3 py-2 text-right font-data">
                          {leg.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-data text-[var(--muted-foreground)]">
                          {formatCurrency(leg.commission)}
                        </td>
                        <td className="px-3 py-2 text-right font-data font-semibold">
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
              <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF4D6A]">
                <ArrowUpFromDot className="h-4 w-4" />
                Sell Legs
              </h3>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Price</th>
                      <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Commission
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellLegs.map((leg) => (
                      <tr
                        key={leg.id}
                        className="border-b border-[var(--border)] last:border-b-0"
                      >
                        <td className="px-3 py-2 font-data text-[var(--muted-foreground)]">
                          {leg.legOrder}
                        </td>
                        <td className="px-3 py-2 font-data text-[var(--muted-foreground)]">
                          {formatLegDate(leg.filledAt)}
                        </td>
                        <td className="px-3 py-2 text-right font-data">
                          {formatCurrency(leg.price)}
                        </td>
                        <td className="px-3 py-2 text-right font-data">
                          {leg.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-data text-[var(--muted-foreground)]">
                          {formatCurrency(leg.commission)}
                        </td>
                        <td className="px-3 py-2 text-right font-data font-semibold">
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
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8 shadow-sm">
            <h2 className="text-base font-semibold mb-5">
              Post-Trade Analysis
            </h2>
            <div className="space-y-5">
              {trade.entryReason && (
                <div className="border-l-2 border-[var(--border)] pl-4">
                  <h3 className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted-foreground)] mb-1.5">
                    Entry Reason
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{trade.entryReason}</p>
                </div>
              )}
              {trade.exitReason && (
                <div className="border-l-2 border-[var(--border)] pl-4">
                  <h3 className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted-foreground)] mb-1.5">
                    Exit Reason
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{trade.exitReason}</p>
                </div>
              )}
              {trade.conclusions && (
                <div className="border-l-2 border-[#3B82F6]/40 pl-4">
                  <h3 className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted-foreground)] mb-1.5">
                    Conclusions
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{trade.conclusions}</p>
                </div>
              )}
              {trade.notes && (
                <div className="border-l-2 border-[var(--border)] pl-4">
                  <h3 className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted-foreground)] mb-1.5">
                    Notes
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{trade.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Tags */}
        {trade.tradeErrors.length > 0 && (
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8 shadow-sm">
            <h2 className="text-base font-semibold mb-4">Error Tags</h2>
            <div className="flex flex-wrap gap-2">
              {trade.tradeErrors.map((err) => (
                <span
                  key={err.errorDefinition.id}
                  className="inline-flex items-center rounded-lg bg-[#FF4D6A]/10 px-3 py-1.5 text-xs font-medium text-[#FF4D6A] ring-1 ring-[#FF4D6A]/20"
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
            <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 mb-8 shadow-sm">
              <h2 className="text-base font-semibold mb-4">
                Money Left on Table
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-[var(--muted)]/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                    Daily High
                  </div>
                  <div className="text-sm font-data font-semibold">
                    {trade.dailyHigh ? formatCurrency(trade.dailyHigh) : "\u2014"}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--muted)]/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                    Daily Close
                  </div>
                  <div className="text-sm font-data font-semibold">
                    {trade.dailyClose
                      ? formatCurrency(trade.dailyClose)
                      : "\u2014"}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--muted)]/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                    vs High
                  </div>
                  <div className="text-sm font-data font-semibold text-[var(--muted-foreground)]">
                    {trade.moneyLeftHighPct !== null
                      ? formatPercent(trade.moneyLeftHighPct)
                      : "\u2014"}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--muted)]/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                    vs Close
                  </div>
                  <div className="text-sm font-data font-semibold text-[var(--muted-foreground)]">
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
  accent,
}: {
  label: string;
  children: React.ReactNode;
  large?: boolean;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-sm"
      style={
        accent
          ? {
              borderColor: `${accent}55`,
              backgroundColor: `${accent}0D`,
            }
          : undefined
      }
    >
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1.5">
        {label}
      </div>
      <div className={cn("font-semibold", large ? "text-xl" : "text-sm")}>
        {children}
      </div>
    </div>
  );
}
