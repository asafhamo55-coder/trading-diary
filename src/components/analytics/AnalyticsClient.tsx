"use client";

import { useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import type { Trade } from "@/lib/types";

export default function AnalyticsClient({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => {
    const completed = trades.filter(
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
  }, [trades]);

  // Symbol performance
  const symbolStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; totalPnL: number; winners: number }
    >();
    trades.filter((t) => t.isCompleted && t.totalPnL !== null).forEach(
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
  }, [trades]);

  // Direction performance
  const directionStats = useMemo(() => {
    function calcDir(dir: "LONG" | "SHORT") {
      const dirTrades = trades.filter(
        (t) => t.direction === dir && t.isCompleted && t.totalPnL !== null
      );
      const winners = dirTrades.filter((t) => (t.totalPnL ?? 0) > 0);
      const totalPnL = dirTrades.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
      const avgRR =
        dirTrades.length > 0
          ? dirTrades.reduce((s, t) => s + (t.riskReward ?? 0), 0) / dirTrades.length
          : 0;
      return {
        count: dirTrades.length,
        totalPnL,
        winRate: dirTrades.length > 0 ? winners.length / dirTrades.length : 0,
        avgRR,
      };
    }
    return { long: calcDir("LONG"), short: calcDir("SHORT") };
  }, [trades]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthTrades = trades.filter(
        (t) => t.month === i + 1 && t.isCompleted && t.totalPnL !== null
      );
      const pnl = monthTrades.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
      return {
        month: i + 1,
        name: MONTH_NAMES[i],
        trades: monthTrades.length,
        pnl,
      };
    }).filter((m) => m.trades > 0);
  }, [trades]);

  const monthlyTrendOption = useMemo<EChartsCoreOption>(() => {
    const rows = monthlyTrend;
    return {
      grid: { left: 92, right: 120, top: 8, bottom: 24, containLabel: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0C0F14",
        borderColor: "#2A3040",
        borderWidth: 1,
        textStyle: { color: "#E8ECF4", fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(59,130,246,0.06)" } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr[0] as { name: string; value: number; dataIndex: number };
          const row = rows[p.dataIndex];
          const v = Number(p.value) || 0;
          return `<div style="color:#8892A6;font-size:11px;margin-bottom:4px">${p.name}</div>` +
            `<div style="color:${v >= 0 ? "#00D68F" : "#FF4D6A"}"><b>${v >= 0 ? "+" : ""}${formatCurrency(v)}</b></div>` +
            `<div style="color:#8892A6;font-size:11px;margin-top:2px">${row?.trades ?? 0} trades</div>`;
        },
      },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#2A3040", type: "dashed" } },
        axisLabel: {
          color: "#8892A6",
          fontSize: 11,
          formatter: (v: number) =>
            v === 0 ? "0" : `$${Math.round(v / 100) / 10}k`,
        },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: rows.map((r) => r.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#E8ECF4", fontSize: 12 },
      },
      series: [
        {
          name: "P&L",
          type: "bar",
          data: rows.map((r) => ({
            value: r.pnl,
            itemStyle: {
              color: r.pnl >= 0 ? "rgba(0,214,143,0.5)" : "rgba(255,77,106,0.5)",
              borderRadius: [4, 4, 4, 4],
            },
          })),
          barWidth: 16,
          label: {
            show: true,
            position: "right",
            color: "#E8ECF4",
            fontSize: 12,
            formatter: (p: { value: number; dataIndex: number }) => {
              const r = rows[p.dataIndex];
              const v = Number(p.value) || 0;
              const sign = v > 0 ? "+" : "";
              return `${sign}${formatCurrency(v)}  ·  ${r?.trades ?? 0} trades`;
            },
            rich: {},
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#2A3040" },
            data: [{ xAxis: 0 }],
            label: { show: false },
          },
          animation: false,
        },
      ],
    };
  }, [monthlyTrend]);

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Advanced Analytics
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
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
              className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
              </div>
              <p
                className={cn(
                  "text-xl font-bold",
                  stat.color ?? "text-[var(--foreground)]"
                )}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Symbol Performance */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Symbol Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-[var(--muted-foreground)] font-medium">
                    Symbol
                  </th>
                  <th className="text-right py-2 text-[var(--muted-foreground)] font-medium">
                    Trades
                  </th>
                  <th className="text-right py-2 text-[var(--muted-foreground)] font-medium">
                    Total P&L
                  </th>
                  <th className="text-right py-2 text-[var(--muted-foreground)] font-medium">
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
                    <td className="py-2 font-medium text-[var(--foreground)]">
                      {s.symbol}
                    </td>
                    <td className="py-2 text-right text-[var(--foreground)]">
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
                    <td className="py-2 text-right text-[var(--foreground)]">
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
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-5 h-5 text-[#00D68F]" />
              <h3 className="font-semibold text-[var(--foreground)]">Long Trades</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Count</span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {directionStats.long.count}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Total P&L</span>
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
                <span className="text-sm text-[var(--muted-foreground)]">Win Rate</span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {formatPercent(directionStats.long.winRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Avg R/R</span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {formatNumber(directionStats.long.avgRR)}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownRight className="w-5 h-5 text-[#FF4D6A]" />
              <h3 className="font-semibold text-[var(--foreground)]">Short Trades</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Count</span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {directionStats.short.count}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Total P&L</span>
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
                <span className="text-sm text-[var(--muted-foreground)]">Win Rate</span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {formatPercent(directionStats.short.winRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Avg R/R</span>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {formatNumber(directionStats.short.avgRR)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
            Monthly Trend
          </h2>
          {monthlyTrend.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No trading data yet.</p>
          ) : (
            <div style={{ height: Math.max(monthlyTrend.length * 32 + 32, 160) }}>
              <EChart option={monthlyTrendOption} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
