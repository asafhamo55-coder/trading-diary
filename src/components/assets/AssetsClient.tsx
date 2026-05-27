"use client";

import { useMemo } from "react";
import {
  Wallet,
  TrendingDown as TrendingDownIcon,
  Sparkles,
  Scale,
  LineChart as LineChartIcon,
  PieChart,
  BarChart3,
} from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { DashboardInsights } from "@/lib/data";
import type { Trade } from "@/lib/types";
import Link from "next/link";
import YearPicker from "@/components/layout/YearPicker";

interface AssetsClientProps {
  insights: DashboardInsights;
  trades: Trade[];
  kind?: "asset" | "stock";
  year?: number;
  availableYears?: number[];
}

const VARIANTS = {
  asset: {
    title: "Assets",
    description: "Analysis filtered to trades marked as Asset",
    accent: "#A78BFA",
    emptyTitle: "No assets yet",
    emptyHint: 'Open a trade and check the "Asset" box to include it here.',
    perTitle: "Per-Asset Performance",
    curveTitle: "Equity Curve (assets only)",
    totalLabel: "Total Realized P&L (assets)",
  },
  stock: {
    title: "Stocks",
    description: "Analysis filtered to trades NOT marked as Asset",
    accent: "#3B82F6",
    emptyTitle: "No stock trades yet",
    emptyHint: 'Any trade without the "Asset" box checked shows up here.',
    perTitle: "Per-Symbol Performance",
    curveTitle: "Equity Curve (stocks only)",
    totalLabel: "Total Realized P&L (stocks)",
  },
} as const;

export default function AssetsClient({
  insights,
  trades,
  kind = "asset",
  year,
  availableYears,
}: AssetsClientProps) {
  const v = VARIANTS[kind];
  const totalRealized = insights.equityCurve.length
    ? insights.equityCurve[insights.equityCurve.length - 1].cumulative
    : 0;

  // Per-symbol breakdown for assets
  const bySymbol = new Map<
    string,
    { count: number; totalPnL: number; winners: number; openCount: number }
  >();
  for (const t of trades) {
    if (!bySymbol.has(t.symbol))
      bySymbol.set(t.symbol, {
        count: 0,
        totalPnL: 0,
        winners: 0,
        openCount: 0,
      });
    const s = bySymbol.get(t.symbol)!;
    s.count++;
    const pnl = t.totalPnL ?? 0;
    s.totalPnL += pnl;
    if (pnl > 0) s.winners++;
    if (!t.isCompleted) s.openCount++;
  }
  const symbolRows = Array.from(bySymbol.entries())
    .map(([symbol, s]) => ({
      symbol,
      ...s,
      winRate: s.count > 0 ? s.winners / s.count : 0,
    }))
    .sort((a, b) => b.totalPnL - a.totalPnL);

  const monthlyPnL = useMemo(() => {
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const realized = trades.filter((t) => {
      if (t.isCompleted && t.totalPnL !== null) return true;
      const total = t.totalShares ?? 0;
      const open = t.sharesInProcess ?? 0;
      return total > 0 && open < total && t.totalPnL !== null;
    });
    return Array.from({ length: 12 }, (_, i) => {
      const monthTrades = realized.filter((t) => t.month === i + 1);
      const pnl = monthTrades.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
      return { month: i + 1, pnl, name: MONTH_NAMES[i] };
    });
  }, [trades]);

  const monthlyOption = useMemo<EChartsCoreOption>(() => {
    return {
      grid: { left: 56, right: 12, top: 32, bottom: 24, containLabel: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0C0F14",
        borderColor: "#2A3040",
        borderWidth: 1,
        textStyle: { color: "#E8ECF4", fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: `${v.accent}10` } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr[0] as { name: string; value: number };
          const val = Number(p.value) || 0;
          return `<div style="color:#8892A6;font-size:11px;margin-bottom:4px">${p.name}</div>` +
            `<div style="color:${val >= 0 ? "#00D68F" : "#FF4D6A"}"><b>${val >= 0 ? "+" : ""}${formatCurrency(val)}</b></div>`;
        },
      },
      xAxis: {
        type: "category",
        data: monthlyPnL.map((m) => m.name),
        axisLine: { lineStyle: { color: "#2A3040" } },
        axisTick: { show: false },
        axisLabel: { color: "#8892A6", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#2A3040", type: "dashed" } },
        axisLabel: {
          color: "#8892A6",
          fontSize: 11,
          formatter: (val: number) =>
            val === 0 ? "0" : `$${Math.round(val / 100) / 10}k`,
        },
      },
      series: [
        {
          name: "P&L",
          type: "bar",
          data: monthlyPnL.map((m) => ({
            value: m.pnl,
            itemStyle: {
              color:
                m.pnl > 0
                  ? "rgba(0,214,143,0.75)"
                  : m.pnl < 0
                  ? "rgba(255,77,106,0.75)"
                  : "#2A3040",
              borderRadius: [4, 4, 0, 0],
            },
          })),
          label: {
            show: true,
            position: "top",
            color: "#E8ECF4",
            fontSize: 10,
            formatter: (p: { value: number }) => {
              const val = Number(p.value) || 0;
              if (!val) return "";
              const abs = Math.abs(val);
              const formatted =
                abs >= 1000
                  ? `${(val / 1000).toFixed(1)}k`
                  : `${Math.round(val)}`;
              return `${val > 0 ? "+" : val < 0 ? "-" : ""}$${formatted.replace("-", "")}`;
            },
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#2A3040", type: "solid" },
            data: [{ yAxis: 0 }],
            label: { show: false },
          },
          animation: false,
        },
      ],
    };
  }, [monthlyPnL, v.accent]);

  const equityOption = useMemo<EChartsCoreOption>(() => {
    const data = insights.equityCurve;
    return {
      grid: { left: 56, right: 12, top: 24, bottom: 28, containLabel: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0C0F14",
        borderColor: "#2A3040",
        borderWidth: 1,
        textStyle: { color: "#E8ECF4", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: v.accent } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr[0] as { dataIndex: number };
          const row = data[p.dataIndex];
          if (!row) return "";
          const pnl = row.pnl ?? 0;
          const sym = row.symbol ?? "";
          return `<div style="color:#8892A6;font-size:11px;margin-bottom:4px">${row.date}</div>` +
            `<div><span style="color:#8892A6">Cumulative:</span> <b>${formatCurrency(row.cumulative)}</b></div>` +
            `<div style="color:${pnl >= 0 ? "#00D68F" : "#FF4D6A"}">${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)} ${sym}</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLine: { lineStyle: { color: "#2A3040" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#8892A6",
          fontSize: 11,
          hideOverlap: true,
          formatter: (val: string) => val.slice(5),
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#2A3040", type: "dashed" } },
        axisLabel: {
          color: "#8892A6",
          fontSize: 11,
          formatter: (val: number) => `$${Math.round(val / 100) / 10}k`,
        },
      },
      series: [
        {
          name: "Cumulative",
          type: "line",
          data: data.map((d) => ({
            value: d.cumulative,
            label: {
              show: true,
              formatter: d.symbol,
              color: (d.pnl ?? 0) >= 0 ? "#00D68F" : "#FF4D6A",
              fontSize: 9,
              fontWeight: 500,
              position: (d.pnl ?? 0) >= 0 ? "top" : "bottom",
            },
          })),
          smooth: true,
          showSymbol: true,
          symbolSize: 4,
          lineStyle: { color: v.accent, width: 2 },
          itemStyle: { color: v.accent },
          animation: false,
        },
      ],
    };
  }, [insights.equityCurve, v.accent]);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: `${v.accent}1A` }}
          >
            <Wallet className="w-5 h-5" style={{ color: v.accent }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{v.title}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {v.description}
              {year ? ` · ${year}` : ""}
            </p>
          </div>
        </div>
        {year != null && availableYears && availableYears.length > 0 && (
          <YearPicker years={availableYears} selected={year} />
        )}
      </div>

      {trades.length === 0 ? (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-12 text-center">
          <Wallet className="w-12 h-12 text-[var(--border)] mx-auto mb-4" />
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">
            {v.emptyTitle}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">{v.emptyHint}</p>
          <Link
            href="/trades"
            className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors"
          >
            Go to Trades
          </Link>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <p className="text-[var(--muted-foreground)] text-sm mb-1">{v.totalLabel}</p>
            <h2
              className={cn(
                "text-3xl md:text-4xl font-bold font-data",
                totalRealized >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
              )}
            >
              {totalRealized >= 0 ? "+" : ""}
              {formatCurrency(totalRealized)}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              Across {trades.length} {kind} trade
              {trades.length !== 1 ? "s" : ""}
              {insights.equityCurve.length > 0 &&
                ` · ${insights.equityCurve.length} with realized P&L`}
            </p>
          </div>

          {/* Monthly P&L Bar Chart */}
          {monthlyPnL.some((m) => m.pnl !== 0) && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3
                  className="w-4 h-4"
                  style={{ color: v.accent }}
                />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Monthly P&L
                </h3>
              </div>
              <div className="h-56">
                <EChart option={monthlyOption} />
              </div>
            </div>
          )}

          {/* Risk + Expectancy */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Max Drawdown"
              value={formatCurrency(insights.drawdown.maxDrawdown)}
              icon={<TrendingDownIcon className="w-5 h-5" />}
              subtext={`${formatPercent(insights.drawdown.maxDrawdownPct)} of peak`}
              valueColor="text-[#FF4D6A]"
            />
            <StatCard
              label="Current Drawdown"
              value={formatCurrency(insights.drawdown.currentDrawdown)}
              icon={<TrendingDownIcon className="w-5 h-5" />}
              subtext={`${insights.drawdown.longestLossStreak} loss streak max`}
              valueColor={
                insights.drawdown.currentDrawdown > 0
                  ? "text-[#FFB547]"
                  : "text-[#00D68F]"
              }
            />
            <StatCard
              label="Expectancy"
              value={formatCurrency(insights.expectancy.expectancy)}
              icon={<Sparkles className="w-5 h-5" />}
              subtext="$ per trade"
              valueColor={
                insights.expectancy.expectancy >= 0
                  ? "text-[#00D68F]"
                  : "text-[#FF4D6A]"
              }
            />
            <StatCard
              label="Avg Winner / Loser"
              value={`${formatCurrency(insights.expectancy.avgWinner)} / ${formatCurrency(insights.expectancy.avgLoser)}`}
              icon={<Scale className="w-5 h-5" />}
              subtext={`${insights.expectancy.winnerCount}W / ${insights.expectancy.loserCount}L`}
            />
          </div>

          {/* Equity Curve */}
          {insights.equityCurve.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <LineChartIcon
                  className="w-4 h-4"
                  style={{ color: v.accent }}
                />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {v.curveTitle}
                </h3>
              </div>
              <div className="h-64">
                <EChart option={equityOption} />
              </div>
            </div>
          )}

          {/* Per-symbol breakdown */}
          {symbolRows.length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4" style={{ color: v.accent }} />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {v.perTitle}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
                      <th className="text-left pb-3 font-medium">Symbol</th>
                      <th className="text-right pb-3 font-medium">Trades</th>
                      <th className="text-right pb-3 font-medium">Open</th>
                      <th className="text-right pb-3 font-medium">Total P&L</th>
                      <th className="text-right pb-3 font-medium">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbolRows.map((r) => (
                      <tr
                        key={r.symbol}
                        className="border-b border-[#2A3040]/50 last:border-0"
                      >
                        <td className="py-2.5 font-medium text-[var(--foreground)]">
                          {r.symbol}
                        </td>
                        <td className="py-2.5 text-right text-[var(--muted-foreground)] font-data">
                          {r.count}
                        </td>
                        <td className="py-2.5 text-right text-[var(--muted-foreground)] font-data">
                          {r.openCount > 0 ? r.openCount : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-data font-semibold",
                            r.totalPnL >= 0
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                          )}
                        >
                          {r.totalPnL >= 0 ? "+" : ""}
                          {formatCurrency(r.totalPnL)}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-data",
                            r.winRate >= 0.5
                              ? "text-[#00D68F]"
                              : "text-[#FF4D6A]"
                          )}
                        >
                          {formatPercent(r.winRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  subtext,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtext?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--muted-foreground)] font-medium">{label}</span>
        <div className="text-[var(--muted-foreground)]">{icon}</div>
      </div>
      <p
        className={cn(
          "text-2xl font-bold font-data",
          valueColor ?? "text-[var(--foreground)]"
        )}
      >
        {value}
      </p>
      {subtext && <p className="text-xs text-[var(--muted-foreground)] mt-1">{subtext}</p>}
    </div>
  );
}

