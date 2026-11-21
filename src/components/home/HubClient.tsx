"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, Lock, BarChart3, CalendarDays, CalendarClock } from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";
import RecommendationList from "@/components/home/RecommendationList";
import CoPilotChat from "@/components/home/CoPilotChat";
import { Sparkles, PiggyBank } from "lucide-react";
import type { EquitySummary } from "@/lib/equity-coach";
import type { Recommendation } from "@/lib/home-coach";
import HubShell from "@/components/home/HubShell";
import { Kpi } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { useThemeTokens } from "@/lib/use-theme-tokens";

interface RevExp {
  revenue: number;
  expense: number;
}

interface MonthlyRow {
  month: number;
  name: string;
  trade: RevExp;
  properties: RevExp;
  home: RevExp;
}

const MODULES: { key: "trade" | "properties" | "home"; label: string }[] = [
  { key: "trade", label: "Trade" },
  { key: "properties", label: "Properties" },
  { key: "home", label: "Home" },
];

function net(r: RevExp): number {
  return r.revenue - r.expense;
}

// Compact currency for the dense monthly grid: no cents, sign-prefixed.
function fmtCompact(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "—";
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

interface SourceRow {
  key: "trade" | "properties" | "home";
  label: string;
  href: string;
  total: number;
  ready: boolean;
  blurb: string;
}

interface MtdData {
  monthName: string;
  year: number;
  asOf: string;
  trade: RevExp;
  properties: RevExp;
  home: RevExp;
}

// Module colours as design tokens (theme-aware). Charts use the resolved
// values from useThemeTokens().
const SOURCE_COLORS: Record<SourceRow["key"], string> = {
  trade: "var(--primary)",
  properties: "var(--accent)",
  home: "var(--success)",
};

const EQUITY_SUGGESTIONS = [
  "How do I grow my total equity fastest?",
  "Which module should I focus on?",
  "Where am I losing the most money?",
  "How can I generate more cash?",
];

export default function HubClient({
  monthly,
  sources,
  year,
  availableYears,
  summary,
  recommendations,
  aiConfigured,
  hasData,
  mtd,
  children,
}: {
  children?: React.ReactNode;
  monthly: MonthlyRow[];
  sources: SourceRow[];
  year: number;
  availableYears: number[];
  summary: EquitySummary;
  recommendations: Recommendation[];
  aiConfigured: boolean;
  hasData: boolean;
  mtd: MtdData;
}) {
  const grandTotal = sources.reduce((sum, s) => sum + s.total, 0);

  const mtdNet = net(mtd.trade) + net(mtd.properties) + net(mtd.home);
  const mtdIn = mtd.trade.revenue + mtd.properties.revenue + mtd.home.revenue;
  const mtdOut = mtd.trade.expense + mtd.properties.expense + mtd.home.expense;
  const mtdActive = mtdIn !== 0 || mtdOut !== 0;

  const netByMonth = useMemo(
    () => monthly.map((m) => net(m.trade) + net(m.properties) + net(m.home)),
    [monthly]
  );

  const cumulative = useMemo(
    () => netByMonth.map((_, i) => netByMonth.slice(0, i + 1).reduce((a, b) => a + b, 0)),
    [netByMonth]
  );

  const chartHasData = netByMonth.some((n) => n !== 0);

  const t = useThemeTokens();
  const option = useMemo<EChartsCoreOption>(() => {
    const chartColors: Record<SourceRow["key"], string> = {
      trade: t.primary,
      properties: t.accent,
      home: t.success,
    };
    const series = [
      { key: "trade" as const, name: "Trade" },
      { key: "properties" as const, name: "Properties" },
      { key: "home" as const, name: "Home" },
    ].map((s) => ({
      name: s.name,
      type: "bar" as const,
      stack: "net",
      data: monthly.map((m) => net(m[s.key])),
      itemStyle: { color: chartColors[s.key], borderRadius: [0, 0, 0, 0] },
      barMaxWidth: 28,
      animation: false,
    }));

    return {
      grid: { left: 56, right: 16, top: 40, bottom: 28, containLabel: false },
      legend: {
        top: 6,
        right: 8,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: t.muted, fontSize: 11 },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: t.elevated,
        borderColor: t.border,
        borderWidth: 1,
        textStyle: { color: t.foreground, fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: `${t.primary}14` } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const name = (arr[0] as { name: string })?.name ?? "";
          let net = 0;
          const rows = arr
            .map((p) => {
              const pt = p as { seriesName: string; value: number; color: string };
              const val = Number(pt.value) || 0;
              net += val;
              if (!val) return "";
              return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${pt.color}">${pt.seriesName}</span><b>${val >= 0 ? "+" : ""}${formatCurrency(val)}</b></div>`;
            })
            .filter(Boolean)
            .join("");
          return (
            `<div style="color:${t.muted};font-size:11px;margin-bottom:4px">${name}</div>` +
            (rows || `<div style="color:${t.muted}">No activity</div>`) +
            `<div style="margin-top:4px;border-top:1px solid ${t.border};padding-top:4px;color:${net >= 0 ? t.success : t.danger}"><b>Net ${net >= 0 ? "+" : ""}${formatCurrency(net)}</b></div>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: monthly.map((m) => m.name),
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: false },
        axisLabel: { color: t.muted, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.border, type: [2, 4] } },
        axisLabel: {
          color: t.muted,
          fontSize: 11,
          formatter: (val: number) =>
            val === 0 ? "0" : `$${Math.round(val / 100) / 10}k`,
        },
      },
      series: [
        ...series,
        {
          name: "Cumulative",
          type: "line",
          data: cumulative,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: t.foreground, width: 2, type: "dashed" },
          itemStyle: { color: t.foreground },
          animation: false,
          z: 3,
        },
      ],
    };
  }, [monthly, cumulative, t]);

  return (
    <HubShell>
    <div className="mx-auto w-full max-w-7xl space-y-6 md:space-y-8">
      {children}

      <section aria-labelledby="cash-flow-title" className="space-y-6 border-t border-border pt-8 md:space-y-8 md:pt-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Monthly</p>
          <h2 id="cash-flow-title" className="text-xl font-semibold tracking-[-0.015em] text-foreground">
            Cash flow
          </h2>
          <p className="text-sm text-muted-foreground">Income and expenses across Trade, Properties &amp; Home.</p>
        </div>
        {availableYears.length > 0 ? <YearPicker years={availableYears} selected={year} /> : null}
      </header>

      {/* Consolidated equity summary */}
      <div className="relative overflow-hidden bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 md:p-6">
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary-subtle text-primary">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Consolidated equity · {year}
            </p>
          </div>
          <p
            className={cn(
              "text-4xl md:text-5xl font-semibold num tracking-tight leading-none",
              grandTotal >= 0 ? "text-success" : "text-danger"
            )}
          >
            {grandTotal >= 0 ? "+" : ""}
            {formatCurrency(grandTotal)}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-3">
            Aggregated across Hamo Trade, Properties &amp; Home
          </p>
          {/* Module contribution chips */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 pt-5 border-t border-[var(--border)]">
            {sources.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: SOURCE_COLORS[s.key] }}
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {s.label}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold font-data",
                    !s.ready
                      ? "text-[var(--muted-foreground)]"
                      : s.total >= 0
                        ? "text-success"
                        : "text-danger"
                  )}
                >
                  {s.ready ? `${s.total >= 0 ? "+" : ""}${formatCurrency(s.total)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* This month — month-to-date across all modules */}
      <div className="relative overflow-hidden bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 md:p-6">
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-accent-subtle text-accent-fg">
                  <CalendarClock className="w-3.5 h-3.5" />
                </span>
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  This month · {mtd.monthName} {mtd.year} · MTD
                </p>
              </div>
              <p
                className={cn(
                  "text-3xl md:text-4xl font-semibold num tracking-tight leading-none",
                  mtdNet >= 0 ? "text-success" : "text-danger"
                )}
              >
                {mtdNet >= 0 ? "+" : ""}
                {formatCurrency(mtdNet)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-3">
                Net month-to-date · as of {mtd.asOf}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                  In
                </p>
                <p className="text-lg md:text-xl font-semibold num text-success">
                  +{formatCurrency(mtdIn)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                  Out
                </p>
                <p className="text-lg md:text-xl font-semibold num text-danger">
                  −{formatCurrency(mtdOut)}
                </p>
              </div>
            </div>
          </div>

          {/* Per-module MTD breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-[var(--border)]">
            {MODULES.map((mod) => {
              const rx = mtd[mod.key];
              const n = net(rx);
              const color = SOURCE_COLORS[mod.key];
              return (
                <div
                  key={mod.key}
                  className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="text-xs font-medium text-[var(--muted-foreground)]">
                      {mod.label}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-lg font-semibold num",
                      n > 0
                        ? "text-success"
                        : n < 0
                          ? "text-danger"
                          : "text-[var(--muted-foreground)]"
                    )}
                  >
                    {n === 0 ? "—" : `${n >= 0 ? "+" : ""}${formatCurrency(n)}`}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] font-data">
                    <span className="text-success">
                      {rx.revenue ? `+${formatCurrency(rx.revenue)}` : "—"}
                    </span>
                    <span className="text-danger">
                      {rx.expense ? `−${formatCurrency(rx.expense)}` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {!mtdActive && (
            <p className="text-xs text-[var(--muted-foreground)] mt-4">
              No activity recorded yet this month.
            </p>
          )}
        </div>
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {sources.map((s) => {
          const color = SOURCE_COLORS[s.key];
          const card = (
            <div
              className={cn(
                "group relative h-full overflow-hidden bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 transition-all duration-200",
                s.ready
                  ? "hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md cursor-pointer"
                  : "opacity-75"
              )}
            >
              {/* Accent top hairline on hover */}
              {s.ready && (
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: color }}
                />
              )}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-bold"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                  </span>
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {s.label}
                  </h3>
                </div>
                {s.ready ? (
                  <ArrowUpRight className="w-4 h-4 text-[var(--muted-foreground)] transition-all group-hover:text-[var(--foreground)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                )}
              </div>
              {s.ready ? (
                <p
                  className={cn(
                    "text-2xl font-semibold num mb-2 tracking-tight",
                    s.total >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {s.total >= 0 ? "+" : ""}
                  {formatCurrency(s.total)}
                </p>
              ) : (
                <p className="text-2xl font-semibold num mb-2 text-[var(--muted-foreground)]">
                  —
                </p>
              )}
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                {s.blurb}
              </p>
              {!s.ready && (
                <span className="inline-block mt-3 text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] bg-[var(--muted)] rounded px-2 py-0.5">
                  Coming soon
                </span>
              )}
            </div>
          );
          return s.ready ? (
            <Link key={s.key} href={s.href} className="block pressable">
              {card}
            </Link>
          ) : (
            <div key={s.key}>{card}</div>
          );
        })}
      </div>

      {/* Annual breakdown — one square per month, revenue & expense per module */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary-subtle text-primary">
            <CalendarDays className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Monthly Breakdown · {year}
          </h3>
          <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
            · revenue &amp; expense per module
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {monthly.map((m) => {
            const monthNet = net(m.trade) + net(m.properties) + net(m.home);
            const active =
              m.trade.revenue !== 0 ||
              m.trade.expense !== 0 ||
              m.properties.revenue !== 0 ||
              m.properties.expense !== 0 ||
              m.home.revenue !== 0 ||
              m.home.expense !== 0;
            return (
              <div
                key={m.month}
                className={cn(
                  "bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 transition-colors",
                  active
                    ? "shadow-sm hover:border-[var(--muted-foreground)]/30"
                    : "opacity-55"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold num",
                      monthNet > 0
                        ? "text-success"
                        : monthNet < 0
                          ? "text-danger"
                          : "text-[var(--muted-foreground)]"
                    )}
                  >
                    {fmtCompact(monthNet)}
                  </span>
                </div>
                <div className="space-y-2">
                  {MODULES.map((mod) => {
                    const rx = m[mod.key];
                    return (
                      <div
                        key={mod.key}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-1.5 min-w-0 text-[var(--muted-foreground)]">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: SOURCE_COLORS[mod.key] }}
                          />
                          <span className="truncate">{mod.label}</span>
                        </span>
                        <span className="flex items-center gap-2 font-data shrink-0 tabular-nums">
                          <span className="text-success">
                            {rx.revenue ? `$${Math.round(rx.revenue).toLocaleString("en-US")}` : "—"}
                          </span>
                          <span className="text-danger">
                            {rx.expense ? `−$${Math.round(rx.expense).toLocaleString("en-US")}` : "—"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger" /> Expense
          </span>
          <span>· net shown top-right of each month</span>
        </div>
      </div>

      {/* Monthly equity chart */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary-subtle text-primary">
            <BarChart3 className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Monthly Equity Analysis
          </h3>
          <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
            · net by source, cumulative line
          </span>
        </div>
        {chartHasData ? (
          <div className="h-72">
            <EChart option={option} />
          </div>
        ) : (
          <EmptyState
            variant="plain"
            icon={<BarChart3 />}
            title="No equity activity yet"
            description={`Once you log trades and entries for ${year}, your monthly net by source will appear here.`}
          />
        )}
      </div>

      {hasData && (
        <>
          {/* Consolidated analysis snapshot */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <EquityTile label={`Total in · ${year}`} value={summary.totalIncome} color="text-success" icon={<TrendingUp className="w-5 h-5" />} />
            <EquityTile label={`Total out · ${year}`} value={summary.totalExpense} color="text-danger" icon={<PiggyBank className="w-5 h-5" />} />
            <EquityTile label={`Net equity · ${year}`} value={summary.net} color={summary.net >= 0 ? "text-success" : "text-danger"} icon={<Sparkles className="w-5 h-5" />} signed />
            <Kpi
              label="Retention"
              icon={<PiggyBank />}
              valueTone={summary.retention >= 0 ? "positive" : "negative"}
              value={`${Math.round(summary.retention * 100)}%`}
              hint="of income kept"
            />
          </div>

          {/* Recommendations */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-success-subtle text-success">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Recommendations to grow your equity</h3>
            </div>
            <RecommendationList items={recommendations} />
          </div>

          {/* Equity co-pilot */}
          <CoPilotChat
            endpoint="/api/equity/copilot"
            suggestions={EQUITY_SUGGESTIONS}
            accent="#2563EB"
            aiConfigured={aiConfigured}
            title="Equity co-pilot"
            subtitle="Ask across all your modules"
          />
        </>
      )}
      </section>
    </div>
    </HubShell>
  );
}

function EquityTile({
  label,
  value,
  color,
  icon,
  signed,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  signed?: boolean;
}) {
  return (
    <Kpi
      label={label}
      icon={icon}
      valueTone={color === "text-danger" ? "negative" : "positive"}
      value={`${signed && value >= 0 ? "+" : ""}${formatCurrency(value)}`}
    />
  );
}
