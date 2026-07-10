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
    <div className="flex-1 p-5 sm:p-6 lg:p-8">
      <div className="mb-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B82F6]/12 ring-1 ring-inset ring-[#3B82F6]/20">
            <BarChart3 className="w-[18px] h-[18px] text-[#3B82F6]" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Advanced Analytics
          </h1>
        </div>
        <p className="text-[var(--muted-foreground)] text-sm mt-2">
          Comprehensive performance analysis across all trades
        </p>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
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
              className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-sm transition-colors hover:border-[#3B82F6]/30"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <stat.icon className={cn("w-4 h-4 shrink-0", stat.iconColor)} />
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{stat.label}</p>
              </div>
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

        {/* Symbol Performance */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
            Symbol Performance
          </h2>
          {symbolStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <BarChart3 className="w-7 h-7 text-[var(--muted-foreground)] opacity-50 mb-1" />
              <p className="text-sm font-medium text-[var(--foreground)]">No symbol data yet</p>
              <p className="text-xs text-[var(--muted-foreground)]">Close a trade to see per-symbol performance.</p>
            </div>
          ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                    Symbol
                  </th>
                  <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                    Trades
                  </th>
                  <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                    Total P&L
                  </th>
                  <th className="text-right py-2.5 text-xs uppercase tracking-wide text-[var(--muted-foreground)] font-medium">
                    Win Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {symbolStats.map((s) => (
                  <tr
                    key={s.symbol}
                    className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--muted)]/50"
                  >
                    <td className="py-2.5 font-semibold text-[var(--foreground)]">
                      {s.symbol}
                    </td>
                    <td className="py-2.5 text-right font-data tabular-nums text-[var(--muted-foreground)]">
                      {s.count}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-data font-semibold tabular-nums",
                        s.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                      )}
                    >
                      {s.totalPnL >= 0 ? "+" : ""}
                      {formatCurrency(s.totalPnL)}
                    </td>
                    <td className="py-2.5 text-right font-data tabular-nums text-[var(--foreground)]">
                      {formatPercent(s.winRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Direction Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          <DirectionCard
            direction="long"
            count={directionStats.long.count}
            totalPnL={directionStats.long.totalPnL}
            winRate={directionStats.long.winRate}
            avgRR={directionStats.long.avgRR}
          />
          <DirectionCard
            direction="short"
            count={directionStats.short.count}
            totalPnL={directionStats.short.totalPnL}
            winRate={directionStats.short.winRate}
            avgRR={directionStats.short.avgRR}
          />
        </div>

        {/* Monthly Trend */}
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
            Monthly Trend
          </h2>
          {monthlyTrend.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <TrendingUp className="w-7 h-7 text-[var(--muted-foreground)] opacity-50 mb-1" />
              <p className="text-sm font-medium text-[var(--foreground)]">No trading data yet</p>
              <p className="text-xs text-[var(--muted-foreground)]">Your monthly P&amp;L will chart here once trades close.</p>
            </div>
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

function DirectionCard({
  direction,
  count,
  totalPnL,
  winRate,
  avgRR,
}: {
  direction: "long" | "short";
  count: number;
  totalPnL: number;
  winRate: number;
  avgRR: number;
}) {
  const isLong = direction === "long";
  const accent = isLong ? "#00D68F" : "#FF4D6A";
  const Icon = isLong ? ArrowUpRight : ArrowDownRight;
  const positive = totalPnL >= 0;

  return (
    <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}1A` }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
          </span>
          <h3 className="font-semibold text-[var(--foreground)]">
            {isLong ? "Long" : "Short"} Trades
          </h3>
        </div>
        <span className="font-data text-xs text-[var(--muted-foreground)] tabular-nums">
          {count} {count === 1 ? "trade" : "trades"}
        </span>
      </div>

      <div
        className={cn(
          "font-data text-2xl font-bold tracking-tight tabular-nums mb-4",
          positive ? "text-[#00D68F]" : "text-[#FF4D6A]"
        )}
      >
        {positive ? "+" : ""}
        {formatCurrency(totalPnL)}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Win Rate</p>
          <p className="font-data text-sm font-semibold text-[var(--foreground)] tabular-nums mt-0.5">
            {formatPercent(winRate)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Avg R/R</p>
          <p className="font-data text-sm font-semibold text-[var(--foreground)] tabular-nums mt-0.5">
            {formatNumber(avgRR)}
          </p>
        </div>
      </div>
    </div>
  );
}
