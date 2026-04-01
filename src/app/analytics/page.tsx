"use client";

import { useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import { DEMO_TRADES, getDemoTradesByMonth } from "@/lib/demo-data";

export default function AnalyticsPage() {
  const stats = useMemo(() => {
    const completed = DEMO_TRADES.filter(
      (t) => t.isCompleted && t.totalPnL !== null
    );
    const winners = completed.filter((t) => (t.totalPnL ?? 0) > 0);
    const losers = completed.filter((t) => (t.totalPnL ?? 0) < 0);
    const totalPnL = completed.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
    const totalWins = winners.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
    const totalLosses = Math.abs(
      losers.reduce((s, t) => s + (t.totalPnL ?? 0), 0)
    );
    const avgRR =
      completed.length > 0
        ? completed.reduce((s, t) => s + (t.riskReward ?? 0), 0) /
          completed.length
        : 0;
    const profitFactor =
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    return {
      totalTrades: completed.length,
      winRate: completed.length > 0 ? winners.length / completed.length : 0,
      profitFactor,
      totalPnL,
      avgRR,
      totalWins,
      totalLosses,
      winnerCount: winners.length,
      loserCount: losers.length,
    };
  }, []);

  // Symbol performance
  const symbolStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; totalPnL: number; winners: number }
    >();
    DEMO_TRADES.filter((t) => t.isCompleted && t.totalPnL !== null).forEach(
      (t) => {
        if (!map.has(t.symbol))
          map.set(t.symbol, { count: 0, totalPnL: 0, winners: 0 });
        const entry = map.get(t.symbol)!;
        entry.count++;
        entry.totalPnL += t.totalPnL ?? 0;
        if ((t.totalPnL ?? 0) > 0) entry.winners++;
      }
    );
    return Array.from(map.entries())
      .map(([symbol, data]) => ({
        symbol,
        ...data,
        winRate: data.count > 0 ? data.winners / data.count : 0,
      }))
      .sort((a, b) => b.totalPnL - a.totalPnL);
  }, []);

  // Direction performance
  const directionStats = useMemo(() => {
    function calcDir(dir: "LONG" | "SHORT") {
      const trades = DEMO_TRADES.filter(
        (t) => t.direction === dir && t.isCompleted && t.totalPnL !== null
      );
      const winners = trades.filter((t) => (t.totalPnL ?? 0) > 0);
      const totalPnL = trades.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
      const avgRR =
        trades.length > 0
          ? trades.reduce((s, t) => s + (t.riskReward ?? 0), 0) / trades.length
          : 0;
      return {
        count: trades.length,
        totalPnL,
        winRate: trades.length > 0 ? winners.length / trades.length : 0,
        avgRR,
      };
    }
    return { long: calcDir("LONG"), short: calcDir("SHORT") };
  }, []);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const trades = getDemoTradesByMonth(i + 1).filter(
        (t) => t.isCompleted && t.totalPnL !== null
      );
      const pnl = trades.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
      return {
        month: i + 1,
        name: MONTH_NAMES[i],
        trades: trades.length,
        pnl,
      };
    }).filter((m) => m.trades > 0);
  }, []);

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#E8ECF4]">
          Advanced Analytics
        </h1>
        <p className="text-[#8892A6] text-sm mt-1">
          Comprehensive performance analysis across all trades
        </p>
      </div>

      <div className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            {
              label: "Total Trades",
              value: stats.totalTrades.toString(),
              icon: BarChart3,
              iconColor: "text-[#3B82F6]",
            },
            {
              label: "Win Rate",
              value: formatPercent(stats.winRate),
              icon: TrendingUp,
              iconColor: "text-[#00D68F]",
            },
            {
              label: "Profit Factor",
              value:
                stats.profitFactor === Infinity
                  ? "Inf"
                  : formatNumber(stats.profitFactor),
              icon: BarChart3,
              iconColor: "text-[#A78BFA]",
            },
            {
              label: "Total P&L",
              value: formatCurrency(stats.totalPnL),
              color:
                stats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]",
              icon: stats.totalPnL >= 0 ? TrendingUp : TrendingDown,
              iconColor:
                stats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]",
            },
            {
              label: "Avg R/R",
              value: formatNumber(stats.avgRR),
              icon: BarChart3,
              iconColor: "text-[#FFB547]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-[#151921] border border-[#2A3040] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                <p className="text-xs text-[#8892A6]">{stat.label}</p>
              </div>
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

        {/* Symbol Performance */}
        <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
          <h2 className="text-lg font-semibold text-[#E8ECF4] mb-4">
            Symbol Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A3040]">
                  <th className="text-left py-2 text-[#8892A6] font-medium">
                    Symbol
                  </th>
                  <th className="text-right py-2 text-[#8892A6] font-medium">
                    Trades
                  </th>
                  <th className="text-right py-2 text-[#8892A6] font-medium">
                    Total P&L
                  </th>
                  <th className="text-right py-2 text-[#8892A6] font-medium">
                    Win Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {symbolStats.map((s) => (
                  <tr
                    key={s.symbol}
                    className="border-b border-[#2A3040]/50"
                  >
                    <td className="py-2 font-medium text-[#E8ECF4]">
                      {s.symbol}
                    </td>
                    <td className="py-2 text-right text-[#E8ECF4]">
                      {s.count}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-medium",
                        s.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                      )}
                    >
                      {s.totalPnL >= 0 ? "+" : ""}
                      {formatCurrency(s.totalPnL)}
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

        {/* Direction Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-5 h-5 text-[#00D68F]" />
              <h3 className="font-semibold text-[#E8ECF4]">Long Trades</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Count</span>
                <span className="text-sm font-medium text-[#E8ECF4]">
                  {directionStats.long.count}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Total P&L</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    directionStats.long.totalPnL >= 0
                      ? "text-[#00D68F]"
                      : "text-[#FF4D6A]"
                  )}
                >
                  {formatCurrency(directionStats.long.totalPnL)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Win Rate</span>
                <span className="text-sm font-medium text-[#E8ECF4]">
                  {formatPercent(directionStats.long.winRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Avg R/R</span>
                <span className="text-sm font-medium text-[#E8ECF4]">
                  {formatNumber(directionStats.long.avgRR)}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownRight className="w-5 h-5 text-[#FF4D6A]" />
              <h3 className="font-semibold text-[#E8ECF4]">Short Trades</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Count</span>
                <span className="text-sm font-medium text-[#E8ECF4]">
                  {directionStats.short.count}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Total P&L</span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    directionStats.short.totalPnL >= 0
                      ? "text-[#00D68F]"
                      : "text-[#FF4D6A]"
                  )}
                >
                  {formatCurrency(directionStats.short.totalPnL)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Win Rate</span>
                <span className="text-sm font-medium text-[#E8ECF4]">
                  {formatPercent(directionStats.short.winRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#8892A6]">Avg R/R</span>
                <span className="text-sm font-medium text-[#E8ECF4]">
                  {formatNumber(directionStats.short.avgRR)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-5">
          <h2 className="text-lg font-semibold text-[#E8ECF4] mb-4">
            Monthly Trend
          </h2>
          <div className="space-y-3">
            {monthlyTrend.map((m) => {
              const maxPnL = Math.max(
                ...monthlyTrend.map((x) => Math.abs(x.pnl)),
                1
              );
              const barWidth = Math.round(
                (Math.abs(m.pnl) / maxPnL) * 100
              );
              return (
                <div key={m.month} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-[#E8ECF4] w-24 shrink-0">
                    {m.name}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-6 bg-[#1C2130] rounded-lg overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-lg transition-all",
                          m.pnl >= 0 ? "bg-[#00D68F]/30" : "bg-[#FF4D6A]/30"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium w-28 text-right shrink-0",
                        m.pnl >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                      )}
                    >
                      {m.pnl >= 0 ? "+" : ""}
                      {formatCurrency(m.pnl)}
                    </span>
                  </div>
                  <span className="text-xs text-[#8892A6] w-16 text-right shrink-0">
                    {m.trades} trades
                  </span>
                </div>
              );
            })}
            {monthlyTrend.length === 0 && (
              <p className="text-sm text-[#8892A6]">No trading data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
