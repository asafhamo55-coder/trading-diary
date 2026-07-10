"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
} from "lucide-react";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import type { Trade } from "@/lib/types";
import { calculateMonthlyAnalytics } from "@/lib/calculations/monthly";

type DirectionTab = "overall" | "long" | "short";

export default function MonthlyDetailClient({
  month,
  trades,
}: {
  month: number;
  trades: Trade[];
}) {
  const [dirTab, setDirTab] = useState<DirectionTab>("overall");

  const analyticsTrades = useMemo(
    () =>
      trades.map((t) => ({
        ...t,
        tradeDate: new Date(t.tradeDate),
      })),
    [trades]
  );

  const analytics = useMemo(
    () => calculateMonthlyAnalytics(analyticsTrades),
    [analyticsTrades]
  );

  const monthName = MONTH_NAMES[month - 1] ?? "Unknown";
  const prevMonth = month > 1 ? month - 1 : 12;
  const nextMonth = month < 12 ? month + 1 : 1;

  const dirStats =
    dirTab === "long"
      ? analytics.long
      : dirTab === "short"
        ? analytics.short
        : analytics.overall;

  const winStats =
    dirTab === "long"
      ? analytics.winners.long
      : dirTab === "short"
        ? analytics.winners.short
        : analytics.winners.overall;

  const loseStats =
    dirTab === "long"
      ? analytics.losers.long
      : dirTab === "short"
        ? analytics.losers.short
        : analytics.losers.overall;

  // Include partial-exit trades (have realized P&L but still open)
  const completedTrades = trades.filter((t) => {
    if (t.totalPnL === null) return false;
    if (t.isCompleted) return true;
    const total = t.totalShares ?? 0;
    const open = t.sharesInProcess ?? 0;
    return total > 0 && open < total;
  });
  const sortedByPnL = [...completedTrades].sort(
    (a, b) => (b.totalPnL ?? 0) - (a.totalPnL ?? 0)
  );
  const top3 = sortedByPnL.slice(0, 3);
  const bottom3 = sortedByPnL.slice(-3).reverse();

  return (
    <div className="flex-1 p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-7">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <Link
            href={`/trade/monthly/${prevMonth}`}
            aria-label="Previous month"
            className="pressable shrink-0 p-2 rounded-xl bg-[var(--muted)] border border-[var(--border)] hover:border-[#3B82F6]/50 hover:text-[#3B82F6] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--muted-foreground)]" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] truncate">{monthName}</h1>
            <p className="text-[var(--muted-foreground)] text-xs sm:text-sm mt-0.5">Monthly Deep Dive</p>
          </div>
          <Link
            href={`/trade/monthly/${nextMonth}`}
            aria-label="Next month"
            className="pressable shrink-0 p-2 rounded-xl bg-[var(--muted)] border border-[var(--border)] hover:border-[#3B82F6]/50 hover:text-[#3B82F6] transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[var(--muted-foreground)]" />
          </Link>
        </div>
        <Link
          href="/trade/monthly"
          className="pressable shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[#3B82F6] transition-colors hover:border-[#3B82F6]/50"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Overview</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-12 text-center shadow-sm">
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B82F6]/10 ring-1 ring-inset ring-[#3B82F6]/20">
              <CalendarDays className="w-6 h-6 text-[#3B82F6]" />
            </span>
            <p className="text-base font-semibold text-[var(--foreground)] mt-1">No trades in {monthName}</p>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
              Nothing was logged this month. Use the arrows above to browse other months.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
            {[
              {
                label: "Total Trades",
                value: analytics.overall.tradeCount.toString(),
              },
              {
                label: "Total P&L",
                value: formatCurrency(analytics.overall.totalPnL),
                color:
                  analytics.overall.totalPnL >= 0
                    ? "text-[#00D68F]"
                    : "text-[#FF4D6A]",
              },
              {
                label: "Win Rate",
                value: formatPercent(analytics.overall.winRate),
              },
              {
                label: "Avg R/R",
                value: formatNumber(analytics.overall.avgRiskReward),
              },
              {
                label: "Profit Factor",
                value:
                  analytics.overall.profitFactor === Infinity
                    ? "Inf"
                    : formatNumber(analytics.overall.profitFactor),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)] mb-1.5">{stat.label}</p>
                <p
                  className={cn(
                    "font-data text-2xl font-bold tracking-tight tabular-nums",
                    stat.color ?? "text-[var(--foreground)]"
                  )}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Direction Breakdown */}
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                Direction Breakdown
              </h2>
              <div className="inline-flex gap-1 rounded-xl bg-[var(--muted)] p-1">
                {(["overall", "long", "short"] as DirectionTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDirTab(tab)}
                    className={cn(
                      "pressable px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                      dirTab === tab
                        ? "bg-[#3B82F6] text-white shadow-sm"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 rounded-xl bg-[var(--muted)]/40 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Trades</p>
                <p className="font-data text-xl font-bold tabular-nums text-[var(--foreground)] mt-0.5">
                  {dirStats.tradeCount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total P&L</p>
                <p
                  className={cn(
                    "font-data text-xl font-bold tabular-nums mt-0.5",
                    dirStats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {formatCurrency(dirStats.totalPnL)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Avg P&L</p>
                <p
                  className={cn(
                    "font-data text-xl font-bold tabular-nums mt-0.5",
                    dirStats.avgPnLPerTrade >= 0
                      ? "text-[#00D68F]"
                      : "text-[#FF4D6A]"
                  )}
                >
                  {formatCurrency(dirStats.avgPnLPerTrade)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Win Rate</p>
                <p className="font-data text-xl font-bold tabular-nums text-[var(--foreground)] mt-0.5">
                  {formatPercent(dirStats.winRate)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Profit Factor</p>
                <p className="font-data text-xl font-bold tabular-nums text-[var(--foreground)] mt-0.5">
                  {dirStats.profitFactor === Infinity
                    ? "Inf"
                    : formatNumber(dirStats.profitFactor)}
                </p>
              </div>
            </div>
          </div>

          {/* Winners vs Losers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <WinLossCard
              variant="win"
              count={winStats.count}
              totalPnL={winStats.totalPnL}
              avgPnL={winStats.avgPnL}
            />
            <WinLossCard
              variant="loss"
              count={loseStats.count}
              totalPnL={loseStats.totalPnL}
              avgPnL={loseStats.avgPnL}
            />
          </div>

          {/* Strategy Performance */}
          {analytics.byStrategy.length > 0 && (
            <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
                Strategy Performance
              </h2>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                        Strategy
                      </th>
                      <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                        Count
                      </th>
                      <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                        Total P&L
                      </th>
                      <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                        Avg P&L
                      </th>
                      <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                        Win Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byStrategy.map((s) => (
                      <tr
                        key={s.strategy}
                        className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--muted)]/50"
                      >
                        <td className="py-2.5 font-medium text-[var(--foreground)]">{s.strategy}</td>
                        <td className="py-2.5 text-right font-data tabular-nums text-[var(--muted-foreground)]">
                          {s.tradeCount}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-data font-semibold tabular-nums",
                            s.totalPnL >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                          )}
                        >
                          {formatCurrency(s.totalPnL)}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-data tabular-nums",
                            s.avgPnL >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                          )}
                        >
                          {formatCurrency(s.avgPnL)}
                        </td>
                        <td className="py-2.5 text-right font-data tabular-nums text-[var(--foreground)]">
                          {formatPercent(s.winRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Winners & Losers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-[#FFB547]" />
                <h3 className="font-semibold text-[var(--foreground)]">Top 3 Winners</h3>
              </div>
              <div className="space-y-2.5">
                {top3.map((trade, i) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--muted)] px-3.5 py-3 transition-colors hover:bg-[#00D68F]/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFB547]/15 font-data text-xs font-bold text-[#FFB547] tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                          {trade.symbol}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate">
                          {trade.tradeType}
                        </p>
                      </div>
                    </div>
                    <span className="font-data text-sm font-bold text-[#00D68F] tabular-nums shrink-0">
                      +{formatCurrency(trade.totalPnL ?? 0)}
                    </span>
                  </div>
                ))}
                {top3.length === 0 && (
                  <p className="py-3 text-center text-sm text-[var(--muted-foreground)]">No winning trades</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-[#FF4D6A]" />
                <h3 className="font-semibold text-[var(--foreground)]">Top 3 Losers</h3>
              </div>
              <div className="space-y-2.5">
                {bottom3.map((trade, i) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--muted)] px-3.5 py-3 transition-colors hover:bg-[#FF4D6A]/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF4D6A]/15 font-data text-xs font-bold text-[#FF4D6A] tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                          {trade.symbol}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate">
                          {trade.tradeType}
                        </p>
                      </div>
                    </div>
                    <span className="font-data text-sm font-bold text-[#FF4D6A] tabular-nums shrink-0">
                      {formatCurrency(trade.totalPnL ?? 0)}
                    </span>
                  </div>
                ))}
                {bottom3.length === 0 && (
                  <p className="py-3 text-center text-sm text-[var(--muted-foreground)]">No losing trades</p>
                )}
              </div>
            </div>
          </div>

          {/* Trades List */}
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                Trades
              </h2>
              <span className="font-data text-xs text-[var(--muted-foreground)] tabular-nums">
                {trades.length} total
              </span>
            </div>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                      Date
                    </th>
                    <th className="text-left py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                      Symbol
                    </th>
                    <th className="text-left py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                      Direction
                    </th>
                    <th className="text-left py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                      Type
                    </th>
                    <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                      P&L
                    </th>
                    <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                      R/R
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--muted)]/50"
                    >
                      <td className="py-2.5 font-data tabular-nums text-[var(--muted-foreground)] whitespace-nowrap">{t.tradeDate}</td>
                      <td className="py-2.5 font-semibold text-[var(--foreground)]">
                        {t.symbol}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            t.direction === "LONG"
                              ? "bg-[#00D68F]/10 text-[#00D68F]"
                              : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                          )}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2.5 text-[var(--muted-foreground)]">
                        {t.tradeType ?? "-"}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data font-semibold tabular-nums",
                          !t.isCompleted
                            ? "text-[var(--muted-foreground)]"
                            : (t.totalPnL ?? 0) >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                        )}
                      >
                        {t.isCompleted ? (
                          formatCurrency(t.totalPnL ?? 0)
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#3B82F6]/10 px-2 py-0.5 text-xs font-medium text-[#3B82F6]">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-data tabular-nums text-[var(--foreground)]">
                        {t.isCompleted
                          ? formatNumber(t.riskReward ?? 0)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WinLossCard({
  variant,
  count,
  totalPnL,
  avgPnL,
}: {
  variant: "win" | "loss";
  count: number;
  totalPnL: number;
  avgPnL: number;
}) {
  const isWin = variant === "win";
  const accent = isWin ? "#00D68F" : "#FF4D6A";
  const Icon = isWin ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}1A` }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
        </span>
        <h3 className="font-semibold text-[var(--foreground)]">
          {isWin ? "Winners" : "Losers"}
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Count</p>
          <p className="font-data text-lg font-bold tabular-nums text-[var(--foreground)] mt-0.5">
            {count}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total</p>
          <p className="font-data text-lg font-bold tabular-nums mt-0.5" style={{ color: accent }}>
            {formatCurrency(totalPnL)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Average</p>
          <p className="font-data text-lg font-bold tabular-nums mt-0.5" style={{ color: accent }}>
            {formatCurrency(avgPnL)}
          </p>
        </div>
      </div>
    </div>
  );
}
