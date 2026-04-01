"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import { getDemoTradesByMonth } from "@/lib/demo-data";
import { calculateMonthlyAnalytics } from "@/lib/calculations/monthly";

type DirectionTab = "overall" | "long" | "short";

export default function MonthlyDeepDivePage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month: monthParam } = use(params);
  const month = parseInt(monthParam, 10);
  const [dirTab, setDirTab] = useState<DirectionTab>("overall");

  const trades = useMemo(() => getDemoTradesByMonth(month), [month]);

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

  const completedTrades = trades.filter(
    (t) => t.isCompleted && t.totalPnL !== null
  );
  const sortedByPnL = [...completedTrades].sort(
    (a, b) => (b.totalPnL ?? 0) - (a.totalPnL ?? 0)
  );
  const top3 = sortedByPnL.slice(0, 3);
  const bottom3 = sortedByPnL.slice(-3).reverse();

  return (
    <div className="flex-1 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/monthly/${prevMonth}`}
            className="p-2 rounded-lg bg-[#1C2130] border border-[#2A3040] hover:border-[#3B82F6]/40 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#8892A6]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#E8ECF4]">{monthName}</h1>
            <p className="text-[#8892A6] text-sm">Monthly Deep Dive</p>
          </div>
          <Link
            href={`/monthly/${nextMonth}`}
            className="p-2 rounded-lg bg-[#1C2130] border border-[#2A3040] hover:border-[#3B82F6]/40 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#8892A6]" />
          </Link>
        </div>
        <Link
          href="/monthly"
          className="text-sm text-[#3B82F6] hover:underline"
        >
          Back to Overview
        </Link>
      </div>

      {trades.length === 0 ? (
        <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-12 text-center">
          <p className="text-[#8892A6]">No trades recorded for {monthName}.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                className="rounded-xl bg-[#151921] border border-[#2A3040] p-4"
              >
                <p className="text-xs text-[#8892A6] mb-1">{stat.label}</p>
                <p
                  className={cn(
                    "text-xl font-bold",
                    stat.color ?? "text-[#E8ECF4]"
                  )}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Direction Breakdown */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
            <h2 className="text-lg font-semibold text-[#E8ECF4] mb-4">
              Direction Breakdown
            </h2>
            <div className="flex gap-2 mb-4">
              {(["overall", "long", "short"] as DirectionTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDirTab(tab)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    dirTab === tab
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#1C2130] text-[#8892A6] hover:text-[#E8ECF4]"
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-[#8892A6]">Trades</p>
                <p className="text-lg font-bold text-[#E8ECF4]">
                  {dirStats.tradeCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8892A6]">Total P&L</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    dirStats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {formatCurrency(dirStats.totalPnL)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8892A6]">Avg P&L</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    dirStats.avgPnLPerTrade >= 0
                      ? "text-[#00D68F]"
                      : "text-[#FF4D6A]"
                  )}
                >
                  {formatCurrency(dirStats.avgPnLPerTrade)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8892A6]">Win Rate</p>
                <p className="text-lg font-bold text-[#E8ECF4]">
                  {formatPercent(dirStats.winRate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8892A6]">Profit Factor</p>
                <p className="text-lg font-bold text-[#E8ECF4]">
                  {dirStats.profitFactor === Infinity
                    ? "Inf"
                    : formatNumber(dirStats.profitFactor)}
                </p>
              </div>
            </div>
          </div>

          {/* Winners vs Losers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight className="w-5 h-5 text-[#00D68F]" />
                <h3 className="font-semibold text-[#E8ECF4]">Winners</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-[#8892A6]">Count</span>
                  <span className="text-sm font-medium text-[#E8ECF4]">
                    {winStats.count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#8892A6]">Total</span>
                  <span className="text-sm font-medium text-[#00D68F]">
                    {formatCurrency(winStats.totalPnL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#8892A6]">Average</span>
                  <span className="text-sm font-medium text-[#00D68F]">
                    {formatCurrency(winStats.avgPnL)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowDownRight className="w-5 h-5 text-[#FF4D6A]" />
                <h3 className="font-semibold text-[#E8ECF4]">Losers</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-[#8892A6]">Count</span>
                  <span className="text-sm font-medium text-[#E8ECF4]">
                    {loseStats.count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#8892A6]">Total</span>
                  <span className="text-sm font-medium text-[#FF4D6A]">
                    {formatCurrency(loseStats.totalPnL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#8892A6]">Average</span>
                  <span className="text-sm font-medium text-[#FF4D6A]">
                    {formatCurrency(loseStats.avgPnL)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Performance */}
          {analytics.byStrategy.length > 0 && (
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
              <h2 className="text-lg font-semibold text-[#E8ECF4] mb-4">
                Strategy Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A3040]">
                      <th className="text-left py-2 text-[#8892A6] font-medium">
                        Strategy
                      </th>
                      <th className="text-right py-2 text-[#8892A6] font-medium">
                        Count
                      </th>
                      <th className="text-right py-2 text-[#8892A6] font-medium">
                        Total P&L
                      </th>
                      <th className="text-right py-2 text-[#8892A6] font-medium">
                        Avg P&L
                      </th>
                      <th className="text-right py-2 text-[#8892A6] font-medium">
                        Win Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byStrategy.map((s) => (
                      <tr
                        key={s.strategy}
                        className="border-b border-[#2A3040]/50"
                      >
                        <td className="py-2 text-[#E8ECF4]">{s.strategy}</td>
                        <td className="py-2 text-right text-[#E8ECF4]">
                          {s.tradeCount}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right font-medium",
                            s.totalPnL >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                          )}
                        >
                          {formatCurrency(s.totalPnL)}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right",
                            s.avgPnL >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                          )}
                        >
                          {formatCurrency(s.avgPnL)}
                        </td>
                        <td className="py-2 text-right text-[#E8ECF4]">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-[#FFB547]" />
                <h3 className="font-semibold text-[#E8ECF4]">Top 3 Winners</h3>
              </div>
              <div className="space-y-3">
                {top3.map((trade, i) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between rounded-lg bg-[#1C2130] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#FFB547]">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[#E8ECF4]">
                          {trade.symbol}
                        </p>
                        <p className="text-xs text-[#8892A6]">
                          {trade.tradeType}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#00D68F]">
                      +{formatCurrency(trade.totalPnL ?? 0)}
                    </span>
                  </div>
                ))}
                {top3.length === 0 && (
                  <p className="text-sm text-[#8892A6]">No winning trades</p>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-[#FF4D6A]" />
                <h3 className="font-semibold text-[#E8ECF4]">Top 3 Losers</h3>
              </div>
              <div className="space-y-3">
                {bottom3.map((trade, i) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between rounded-lg bg-[#1C2130] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#FF4D6A]">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[#E8ECF4]">
                          {trade.symbol}
                        </p>
                        <p className="text-xs text-[#8892A6]">
                          {trade.tradeType}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#FF4D6A]">
                      {formatCurrency(trade.totalPnL ?? 0)}
                    </span>
                  </div>
                ))}
                {bottom3.length === 0 && (
                  <p className="text-sm text-[#8892A6]">No losing trades</p>
                )}
              </div>
            </div>
          </div>

          {/* Trades List */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
            <h2 className="text-lg font-semibold text-[#E8ECF4] mb-4">
              Trades
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A3040]">
                    <th className="text-left py-2 text-[#8892A6] font-medium">
                      Date
                    </th>
                    <th className="text-left py-2 text-[#8892A6] font-medium">
                      Symbol
                    </th>
                    <th className="text-left py-2 text-[#8892A6] font-medium">
                      Direction
                    </th>
                    <th className="text-left py-2 text-[#8892A6] font-medium">
                      Type
                    </th>
                    <th className="text-right py-2 text-[#8892A6] font-medium">
                      P&L
                    </th>
                    <th className="text-right py-2 text-[#8892A6] font-medium">
                      R/R
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-[#2A3040]/50"
                    >
                      <td className="py-2 text-[#E8ECF4]">{t.tradeDate}</td>
                      <td className="py-2 font-medium text-[#E8ECF4]">
                        {t.symbol}
                      </td>
                      <td className="py-2">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            t.direction === "LONG"
                              ? "bg-[#00D68F]/10 text-[#00D68F]"
                              : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                          )}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2 text-[#8892A6]">
                        {t.tradeType ?? "-"}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right font-medium",
                          !t.isCompleted
                            ? "text-[#8892A6]"
                            : (t.totalPnL ?? 0) >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                        )}
                      >
                        {t.isCompleted
                          ? formatCurrency(t.totalPnL ?? 0)
                          : "Open"}
                      </td>
                      <td className="py-2 text-right text-[#E8ECF4]">
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
