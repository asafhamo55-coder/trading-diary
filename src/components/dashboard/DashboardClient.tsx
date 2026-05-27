"use client";

import { useMemo } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Activity,
  Scale,
  LineChart as LineChartIcon,
  TrendingDownIcon,
  Sparkles,
  PieChart,
  Wallet,
} from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import type { DashboardInsights } from "@/lib/data";
import YearPicker from "@/components/layout/YearPicker";

interface SegmentStats {
  count: number;
  totalPnL: number;
  winRate: number;
  profitFactor: number;
}

interface DashboardStats {
  totalTrades: number;
  openTrades: number;
  winRate: number;
  totalPnL: number;
  currentPortfolio: number;
  startingBalance: number;
  avgRR: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  assets: SegmentStats;
  stocks: SegmentStats;
}

interface MonthlyPnLEntry {
  month: number;
  pnl: number;
  name: string;
  count: number;
}

interface Trade {
  id: string;
  tradeDate: string;
  symbol: string;
  direction: string;
  totalPnL: number | null;
  riskReward: number | null;
  [key: string]: unknown;
}

interface DashboardClientProps {
  stats: DashboardStats;
  monthlyPnL: MonthlyPnLEntry[];
  recentTrades: Trade[];
  insights: DashboardInsights;
  year: number;
  availableYears: number[];
}

export default function DashboardClient({
  stats,
  monthlyPnL,
  recentTrades,
  insights,
  year,
  availableYears,
}: DashboardClientProps) {
  const totalReturn = stats.totalPnL / stats.startingBalance;

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
        axisPointer: { type: "line", lineStyle: { color: "#3B82F6" } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr[0] as {
            dataIndex: number;
            axisValueLabel?: string;
            value?: number;
          };
          const row = data[p.dataIndex];
          if (!row) return "";
          const tradePnL = row.pnl ?? 0;
          const symbol = row.symbol ?? "";
          return `<div style="color:#8892A6;font-size:11px;margin-bottom:4px">${row.date}</div>` +
            `<div><span style="color:#8892A6">Cumulative:</span> <b>${formatCurrency(row.cumulative)}</b></div>` +
            `<div style="color:${tradePnL >= 0 ? "#00D68F" : "#FF4D6A"}">${tradePnL >= 0 ? "+" : ""}${formatCurrency(tradePnL)} ${symbol}</div>`;
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
          formatter: (v: string) => v.slice(5),
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
          formatter: (v: number) => `$${Math.round(v / 100) / 10}k`,
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
          lineStyle: { color: "#3B82F6", width: 2 },
          itemStyle: { color: "#3B82F6" },
          animation: false,
        },
      ],
    };
  }, [insights.equityCurve]);

  const monthlyOption = useMemo<EChartsCoreOption>(() => {
    return {
      grid: { left: 56, right: 12, top: 32, bottom: 24, containLabel: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0C0F14",
        borderColor: "#2A3040",
        borderWidth: 1,
        textStyle: { color: "#E8ECF4", fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(59,130,246,0.06)" } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr[0] as { name: string; value: number };
          const v = Number(p.value) || 0;
          return `<div style="color:#8892A6;font-size:11px;margin-bottom:4px">${p.name}</div>` +
            `<div style="color:${v >= 0 ? "#00D68F" : "#FF4D6A"}"><b>${v >= 0 ? "+" : ""}${formatCurrency(v)}</b></div>`;
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
          formatter: (v: number) =>
            v === 0 ? "0" : `$${Math.round(v / 100) / 10}k`,
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
              const v = Number(p.value) || 0;
              if (!v) return "";
              const abs = Math.abs(v);
              const formatted =
                abs >= 1000
                  ? `${(v / 1000).toFixed(1)}k`
                  : `${Math.round(v)}`;
              return `${v > 0 ? "+" : v < 0 ? "-" : ""}$${formatted.replace("-", "")}`;
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
  }, [monthlyPnL]);

  return (
    <>
      <Header title="Dashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
        {/* Year picker */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing data for <span className="text-[var(--foreground)] font-medium">{year}</span>
          </p>
          <YearPicker years={availableYears} selected={year} />
        </div>

        {/* Hero section */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <p className="text-[var(--muted-foreground)] text-sm mb-1">Current Portfolio Value</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] font-data">
            {formatCurrency(stats.currentPortfolio)}
          </h2>
          <div className="flex items-center gap-4 mt-3">
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-semibold font-data",
                stats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
              )}
            >
              {stats.totalPnL >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {stats.totalPnL >= 0 ? "+" : ""}
              {formatCurrency(stats.totalPnL)}
            </span>
            <span
              className={cn(
                "text-sm font-semibold font-data px-2 py-0.5 rounded",
                stats.totalPnL >= 0
                  ? "text-[#00D68F] bg-[#00D68F]/10"
                  : "text-[#FF4D6A] bg-[#FF4D6A]/10"
              )}
            >
              {totalReturn >= 0 ? "+" : ""}
              {formatPercent(totalReturn)}
            </span>
          </div>
        </div>

        {/* Monthly P&L widgets */}
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {monthlyPnL.map((m) => (
            <div
              key={m.month}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2.5 text-center"
            >
              <p className="text-[10px] text-[var(--muted-foreground)] font-medium mb-1">
                {m.name}
              </p>
              {m.count > 0 ? (
                <p
                  className={cn(
                    "text-xs font-bold font-data",
                    m.pnl > 0
                      ? "text-[#00D68F]"
                      : m.pnl < 0
                      ? "text-[#FF4D6A]"
                      : "text-[var(--muted-foreground)]"
                  )}
                >
                  {m.pnl > 0 ? "+" : ""}
                  {formatCurrency(m.pnl)}
                </p>
              ) : (
                <p className="text-xs text-[var(--border)] font-data">—</p>
              )}
            </div>
          ))}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Trades"
            value={stats.totalTrades.toString()}
            icon={<Activity className="w-5 h-5" />}
            subtext={`${stats.openTrades} open`}
          />
          <StatCard
            label="Win Rate"
            value={formatPercent(stats.winRate)}
            icon={<Target className="w-5 h-5" />}
            subtext={`${Math.round(stats.winRate * stats.totalTrades)} wins`}
            valueColor={stats.winRate >= 0.5 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          />
          <StatCard
            label="Average R/R"
            value={formatNumber(stats.avgRR, 2)}
            icon={<Scale className="w-5 h-5" />}
            subtext="risk/reward"
            valueColor={stats.avgRR >= 1 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          />
          <StatCard
            label="Profit Factor"
            value={formatNumber(stats.profitFactor, 2)}
            icon={<BarChart3 className="w-5 h-5" />}
            subtext="gross W/L"
            valueColor={stats.profitFactor >= 1 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          />
        </div>

        {/* Equity Curve */}
        {insights.equityCurve.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <LineChartIcon className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Equity Curve
              </h3>
              <span className="text-xs text-[var(--muted-foreground)] ml-2">
                Cumulative P&L across {insights.equityCurve.length} closed trades
              </span>
            </div>
            <div className="h-64">
              <EChart option={equityOption} />
            </div>
          </div>
        )}

        {/* Risk + Expectancy stat rows */}
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

        {/* Assets vs Stocks split */}
        {(stats.assets.count > 0 || stats.stocks.count > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SegmentPanel
              kind="assets"
              icon={<Wallet className="w-4 h-4" />}
              accent="#A78BFA"
              stats={stats.assets}
              href="/assets"
            />
            <SegmentPanel
              kind="stocks"
              icon={<BarChart3 className="w-4 h-4" />}
              accent="#3B82F6"
              stats={stats.stocks}
              href="/stocks"
            />
          </div>
        )}

        {/* Strategy Performance */}
        {insights.byStrategy.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-[#A78BFA]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Strategy Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
                    <th className="text-left pb-3 font-medium">Strategy</th>
                    <th className="text-right pb-3 font-medium">Trades</th>
                    <th className="text-right pb-3 font-medium">Total P&L</th>
                    <th className="text-right pb-3 font-medium">Win Rate</th>
                    <th className="text-right pb-3 font-medium">Avg R/R</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.byStrategy.map((s) => (
                    <tr
                      key={s.tradeType}
                      className="border-b border-[#2A3040]/50 last:border-0"
                    >
                      <td className="py-2.5 font-medium text-[var(--foreground)]">
                        {s.tradeType}
                      </td>
                      <td className="py-2.5 text-right text-[var(--muted-foreground)] font-data">
                        {s.count}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data font-semibold",
                          s.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                        )}
                      >
                        {s.totalPnL >= 0 ? "+" : ""}
                        {formatCurrency(s.totalPnL)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data",
                          s.winRate >= 0.5 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                        )}
                      >
                        {formatPercent(s.winRate)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data",
                          s.avgRR >= 0 ? "text-[var(--foreground)]" : "text-[#FF4D6A]"
                        )}
                      >
                        {formatNumber(s.avgRR, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly P&L + Recent Trades */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
              Monthly P&L
            </h3>
            <div className="h-56">
              <EChart option={monthlyOption} />
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">
              Recent Trades
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Symbol</th>
                    <th className="text-left pb-3 font-medium">Side</th>
                    <th className="text-right pb-3 font-medium">P&L</th>
                    <th className="text-right pb-3 font-medium">R/R</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-b border-[#2A3040]/50 last:border-0"
                    >
                      <td className="py-2.5 text-[var(--muted-foreground)] font-data text-xs">
                        {trade.tradeDate}
                      </td>
                      <td className="py-2.5 font-semibold text-[var(--foreground)]">
                        {trade.symbol}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            trade.direction === "LONG"
                              ? "text-[#00D68F] bg-[#00D68F]/10"
                              : "text-[#FF4D6A] bg-[#FF4D6A]/10"
                          )}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data font-semibold",
                          (trade.totalPnL ?? 0) >= 0
                            ? "text-[#00D68F]"
                            : "text-[#FF4D6A]"
                        )}
                      >
                        {(trade.totalPnL ?? 0) >= 0 ? "+" : ""}
                        {formatCurrency(trade.totalPnL ?? 0)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data",
                          (trade.riskReward ?? 0) >= 0
                            ? "text-[#00D68F]"
                            : "text-[#FF4D6A]"
                        )}
                      >
                        {formatNumber(trade.riskReward ?? 0, 2)}R
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SegmentPanel({
  kind,
  icon,
  accent,
  stats,
  href,
}: {
  kind: "assets" | "stocks";
  icon: React.ReactNode;
  accent: string;
  stats: SegmentStats;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-xl bg-[var(--card)] border border-[var(--border)] p-5 hover:border-[#3B82F6]/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2" style={{ color: accent }}>
          {icon}
          <h3 className="text-sm font-semibold capitalize">{kind}</h3>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">{stats.count} trades</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">Total P&L</span>
          <span
            className={cn(
              "text-lg font-bold font-data",
              stats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
            )}
          >
            {stats.totalPnL >= 0 ? "+" : ""}
            {formatCurrency(stats.totalPnL)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">Win Rate</span>
          <span
            className={cn(
              "text-sm font-medium font-data",
              stats.winRate >= 0.5 ? "text-[#00D68F]" : "text-[#FF4D6A]"
            )}
          >
            {formatPercent(stats.winRate)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">Profit Factor</span>
          <span
            className={cn(
              "text-sm font-medium font-data",
              stats.profitFactor >= 1 ? "text-[#00D68F]" : "text-[#FF4D6A]"
            )}
          >
            {stats.profitFactor === Infinity
              ? "Inf"
              : formatNumber(stats.profitFactor, 2)}
          </span>
        </div>
      </div>
    </a>
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
      {subtext && (
        <p className="text-xs text-[var(--muted-foreground)] mt-1">{subtext}</p>
      )}
    </div>
  );
}
