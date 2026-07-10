"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Repeat,
  BarChart3,
  PieChart as PieIcon,
  Flame,
} from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";
import ExportButton, { toCsv } from "@/components/ui/ExportButton";
import type { HomeInsights } from "@/lib/home";

const TOOLTIP = {
  backgroundColor: "#0C0F14",
  borderColor: "#2A3040",
  borderWidth: 1,
  textStyle: { color: "#E8ECF4", fontSize: 12 },
};

export default function HomeInsightsClient({
  insights,
  year,
  availableYears,
}: {
  insights: HomeInsights;
  year: number;
  availableYears: number[];
}) {
  const { totals } = insights;

  const cashFlowOption = useMemo<EChartsCoreOption>(
    () => ({
      grid: { left: 56, right: 12, top: 30, bottom: 24, containLabel: false },
      legend: {
        top: 2, right: 8, icon: "roundRect", itemWidth: 10, itemHeight: 10,
        textStyle: { color: "#8892A6", fontSize: 11 },
        data: ["Income", "Spending"],
      },
      tooltip: {
        trigger: "axis", ...TOOLTIP,
        valueFormatter: (v: unknown) => formatCurrency(Number(v) || 0),
      },
      xAxis: {
        type: "category",
        data: insights.monthly.map((m) => m.name),
        axisLine: { lineStyle: { color: "#2A3040" } },
        axisTick: { show: false },
        axisLabel: { color: "#8892A6", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "#2A3040", type: "dashed" } },
        axisLabel: {
          color: "#8892A6", fontSize: 11,
          formatter: (v: number) => (v === 0 ? "0" : `$${Math.round(v / 100) / 10}k`),
        },
      },
      series: [
        {
          name: "Income", type: "bar",
          data: insights.monthly.map((m) => m.income),
          itemStyle: { color: "rgba(0,214,143,0.7)", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 16, animation: false,
        },
        {
          name: "Spending", type: "bar",
          data: insights.monthly.map((m) => m.spend),
          itemStyle: { color: "rgba(255,77,106,0.7)", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 16, animation: false,
        },
      ],
    }),
    [insights.monthly]
  );

  const donutOption = useMemo<EChartsCoreOption>(
    () => ({
      tooltip: {
        trigger: "item", ...TOOLTIP,
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number; percent: number };
          return `${d.name}<br/><b>${formatCurrency(d.value)}</b> · ${d.percent}%`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["52%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#0C0F14", borderWidth: 2 },
          label: { show: false },
          data: insights.categories.map((c) => ({
            name: c.name, value: Math.round(c.total),
            itemStyle: { color: c.color },
          })),
          animation: false,
        },
      ],
    }),
    [insights.categories]
  );

  const trendOption = useMemo<EChartsCoreOption>(
    () => ({
      grid: { left: 56, right: 12, top: 34, bottom: 24, containLabel: false },
      legend: {
        top: 2, right: 8, icon: "roundRect", itemWidth: 10, itemHeight: 10,
        textStyle: { color: "#8892A6", fontSize: 11 },
        type: "scroll",
      },
      tooltip: {
        trigger: "axis", ...TOOLTIP,
        valueFormatter: (v: unknown) => formatCurrency(Number(v) || 0),
      },
      xAxis: {
        type: "category", data: insights.trend.months,
        axisLine: { lineStyle: { color: "#2A3040" } },
        axisTick: { show: false }, axisLabel: { color: "#8892A6", fontSize: 11 },
      },
      yAxis: {
        type: "value", axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "#2A3040", type: "dashed" } },
        axisLabel: {
          color: "#8892A6", fontSize: 11,
          formatter: (v: number) => (v === 0 ? "0" : `$${Math.round(v / 100) / 10}k`),
        },
      },
      series: insights.trend.series.map((s) => ({
        name: s.name, type: "bar", stack: "spend",
        data: s.data.map((x) => Math.round(x)),
        itemStyle: { color: s.color },
        barMaxWidth: 24, animation: false,
      })),
    }),
    [insights.trend]
  );

  const recurringMonthly = useMemo(
    () => insights.recurring.reduce((s, r) => s + r.monthlyAmount, 0),
    [insights.recurring]
  );

  function buildInsightsCsv() {
    const monthly = toCsv(
      ["Month", "Income", "Spending", "Net"],
      insights.monthly.map((m) => [m.name, m.income.toFixed(2), m.spend.toFixed(2), m.net.toFixed(2)])
    );
    const cats = toCsv(
      ["Category", "Total", "Share %"],
      insights.categories.map((c) => [c.name, c.total.toFixed(2), Math.round(c.share * 100)])
    );
    const recurring = toCsv(
      ["Recurring merchant", "~ Monthly", "Months", "Total"],
      insights.recurring.map((r) => [r.merchant, r.monthlyAmount.toFixed(2), r.months, r.total.toFixed(2)])
    );
    return `MONTHLY CASH FLOW\n${monthly}\n\nSPENDING BY CATEGORY\n${cats}\n\nRECURRING & SUBSCRIPTIONS\n${recurring}\n`;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Insights</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Spending analysis & cash flow · {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {insights.hasData && (
            <ExportButton
              filename={`hamo-home-insights-${year}.csv`}
              title={`Hamo Home insights ${year}`}
              buildCsv={buildInsightsCsv}
            />
          )}
          <YearPicker years={availableYears} selected={year} />
        </div>
      </div>

      {!insights.hasData ? (
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-12 text-center">
          <BarChart3 className="w-12 h-12 text-[var(--border)] mx-auto mb-4" />
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">Nothing to analyze yet</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Import a statement for {year} and your insights will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Income" value={formatCurrency(totals.income)} icon={<TrendingUp className="w-5 h-5" />} color="text-[#00D68F]" />
            <Stat label="Spending" value={formatCurrency(totals.spend)} icon={<TrendingDown className="w-5 h-5" />} color="text-[#FF4D6A]" />
            <Stat label="Net" value={`${totals.net >= 0 ? "+" : ""}${formatCurrency(totals.net)}`} icon={<Wallet className="w-5 h-5" />} color={totals.net >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"} />
            <Stat label="Savings rate" value={`${Math.round(totals.savingsRate * 100)}%`} icon={<PiggyBank className="w-5 h-5" />} color={totals.savingsRate >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"} sub={`${formatCurrency(totals.avgMonthlySpend)}/mo avg spend`} />
          </div>

          {/* Cash flow */}
          <Card title="Cash flow" icon={<Wallet className="w-4 h-4 text-[#00D68F]" />}>
            <div className="h-64"><EChart option={cashFlowOption} /></div>
          </Card>

          {/* Category breakdown + trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Spending by category" icon={<PieIcon className="w-4 h-4 text-[#00D68F]" />}>
              <div className="flex items-center gap-4">
                <div className="h-52 w-1/2 shrink-0"><EChart option={donutOption} /></div>
                <div className="flex-1 min-w-0 space-y-1.5 max-h-52 overflow-y-auto">
                  {insights.categories.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-[var(--foreground)] truncate flex-1">{c.name}</span>
                      <span className="text-[var(--muted-foreground)] font-data text-xs">{Math.round(c.share * 100)}%</span>
                      <span className="text-[var(--foreground)] font-data font-medium w-20 text-right">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card title="Category trend by month" icon={<BarChart3 className="w-4 h-4 text-[#00D68F]" />}>
              <div className="h-52"><EChart option={trendOption} /></div>
            </Card>
          </div>

          {/* Recurring / subscriptions */}
          <Card
            title="Recurring & subscriptions"
            icon={<Repeat className="w-4 h-4 text-[#00D68F]" />}
            meta={recurringMonthly > 0 ? `≈ ${formatCurrency(recurringMonthly)}/mo` : undefined}
          >
            {insights.recurring.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-2">
                No recurring merchants detected yet (needs 3+ months of history).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--muted-foreground)] text-xs border-b border-[var(--border)]">
                      <th className="text-left pb-2 font-medium">Merchant</th>
                      <th className="text-left pb-2 font-medium hidden sm:table-cell">Category</th>
                      <th className="text-right pb-2 font-medium">~ / mo</th>
                      <th className="text-right pb-2 font-medium">Months</th>
                      <th className="text-right pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.recurring.map((r) => (
                      <tr key={r.merchant} className="border-b border-[#2A3040]/40 last:border-0">
                        <td className="py-2 text-[var(--foreground)] truncate max-w-[200px]">{r.merchant}</td>
                        <td className="py-2 text-[var(--muted-foreground)] hidden sm:table-cell">{r.category ?? "—"}</td>
                        <td className="py-2 text-right font-data text-[var(--foreground)]">{formatCurrency(r.monthlyAmount)}</td>
                        <td className="py-2 text-right font-data text-[var(--muted-foreground)]">{r.months}</td>
                        <td className="py-2 text-right font-data font-medium text-[#FF4D6A]">{formatCurrency(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Top merchants" icon={<Flame className="w-4 h-4 text-[#FFB547]" />}>
              <List rows={insights.topMerchants.map((m) => ({ label: m.merchant, sub: `${m.count}×`, value: m.total }))} />
            </Card>
            <Card title="Largest expenses" icon={<TrendingDown className="w-4 h-4 text-[#FF4D6A]" />}>
              <List rows={insights.largest.map((l) => ({ label: l.description, sub: l.date, value: l.amount }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--muted-foreground)] font-medium">{label}</span>
        <div className="text-[var(--muted-foreground)]">{icon}</div>
      </div>
      <p className={cn("text-2xl font-bold font-data", color)}>{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)] mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, icon, meta, children }: { title: string; icon: React.ReactNode; meta?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        {meta && <span className="text-xs text-[var(--muted-foreground)] ml-auto font-data">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function List({ rows }: { rows: { label: string; sub: string; value: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--muted-foreground)] py-2">Nothing yet.</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-[var(--foreground)] truncate flex-1">{r.label}</span>
          <span className="text-[var(--muted-foreground)] text-xs font-data">{r.sub}</span>
          <span className="text-[var(--foreground)] font-data font-medium w-20 text-right">{formatCurrency(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
