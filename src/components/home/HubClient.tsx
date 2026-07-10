"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, Lock, BarChart3, CalendarDays } from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import { cn, formatCurrency } from "@/lib/utils";
import Logo from "@/components/layout/Logo";
import YearPicker from "@/components/layout/YearPicker";

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

const SOURCE_COLORS: Record<SourceRow["key"], string> = {
  trade: "#3B82F6",
  properties: "#FFB547",
  home: "#00D68F",
};

export default function HubClient({
  monthly,
  sources,
  year,
  availableYears,
}: {
  monthly: MonthlyRow[];
  sources: SourceRow[];
  year: number;
  availableYears: number[];
}) {
  const grandTotal = sources.reduce((sum, s) => sum + s.total, 0);

  const netByMonth = useMemo(
    () => monthly.map((m) => net(m.trade) + net(m.properties) + net(m.home)),
    [monthly]
  );

  const cumulative = useMemo(() => {
    let running = 0;
    return netByMonth.map((n) => (running += n));
  }, [netByMonth]);

  const hasData = netByMonth.some((n) => n !== 0);

  const option = useMemo<EChartsCoreOption>(() => {
    const series = [
      { key: "trade" as const, name: "Trade" },
      { key: "properties" as const, name: "Properties" },
      { key: "home" as const, name: "Home" },
    ].map((s) => ({
      name: s.name,
      type: "bar" as const,
      stack: "net",
      data: monthly.map((m) => net(m[s.key])),
      itemStyle: { color: SOURCE_COLORS[s.key], borderRadius: [0, 0, 0, 0] },
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
        textStyle: { color: "#8892A6", fontSize: 11 },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0C0F14",
        borderColor: "#2A3040",
        borderWidth: 1,
        textStyle: { color: "#E8ECF4", fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: "#3B82F610" } },
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
            `<div style="color:#8892A6;font-size:11px;margin-bottom:4px">${name}</div>` +
            (rows || `<div style="color:#8892A6">No activity</div>`) +
            `<div style="margin-top:4px;border-top:1px solid #2A3040;padding-top:4px;color:${net >= 0 ? "#00D68F" : "#FF4D6A"}"><b>Net ${net >= 0 ? "+" : ""}${formatCurrency(net)}</b></div>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: monthly.map((m) => m.name),
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
        ...series,
        {
          name: "Cumulative",
          type: "line",
          data: cumulative,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#E8ECF4", width: 2, type: "dashed" },
          itemStyle: { color: "#E8ECF4" },
          animation: false,
          z: 3,
        },
      ],
    };
  }, [monthly, cumulative]);

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-10 overflow-y-auto max-w-6xl mx-auto w-full">
      {/* Hero */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <Logo size="lg" />
          <p className="text-xs md:text-sm text-[var(--muted-foreground)] pl-0.5">
            Your unified financial overview
          </p>
        </div>
        {availableYears.length > 0 && (
          <YearPicker years={availableYears} selected={year} />
        )}
      </div>

      {/* Consolidated equity summary */}
      <div className="relative overflow-hidden bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 md:p-8 shadow-sm">
        <div
          className="pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl opacity-[0.12]"
          style={{ background: grandTotal >= 0 ? "#00D68F" : "#FF4D6A" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#3B82F6]/12 text-[#3B82F6]">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              Consolidated equity · {year}
            </p>
          </div>
          <h1
            className={cn(
              "text-4xl md:text-6xl font-bold font-data tracking-tight leading-none",
              grandTotal >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
            )}
          >
            {grandTotal >= 0 ? "+" : ""}
            {formatCurrency(grandTotal)}
          </h1>
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
                        ? "text-[#00D68F]"
                        : "text-[#FF4D6A]"
                  )}
                >
                  {s.ready ? `${s.total >= 0 ? "+" : ""}${formatCurrency(s.total)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {sources.map((s) => {
          const color = SOURCE_COLORS[s.key];
          const card = (
            <div
              className={cn(
                "group relative h-full overflow-hidden bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 transition-all duration-200",
                s.ready
                  ? "shadow-sm hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
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
                    style={{ background: `${color}1F`, color }}
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
                    "text-2xl font-bold font-data mb-2 tracking-tight",
                    s.total >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {s.total >= 0 ? "+" : ""}
                  {formatCurrency(s.total)}
                </p>
              ) : (
                <p className="text-2xl font-bold font-data mb-2 text-[var(--muted-foreground)]">
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
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#3B82F6]/12 text-[#3B82F6]">
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
                      "text-sm font-bold font-data",
                      monthNet > 0
                        ? "text-[#00D68F]"
                        : monthNet < 0
                          ? "text-[#FF4D6A]"
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
                          <span className="text-[#00D68F]">
                            {rx.revenue ? `$${Math.round(rx.revenue).toLocaleString("en-US")}` : "—"}
                          </span>
                          <span className="text-[#FF4D6A]">
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
            <span className="w-2 h-2 rounded-full bg-[#00D68F]" /> Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF4D6A]" /> Expense
          </span>
          <span>· net shown top-right of each month</span>
        </div>
      </div>

      {/* Monthly equity chart */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#3B82F6]/12 text-[#3B82F6]">
            <BarChart3 className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Monthly Equity Analysis
          </h3>
          <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
            · net by source, cumulative line
          </span>
        </div>
        {hasData ? (
          <div className="h-72">
            <EChart option={option} />
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-center gap-3 px-6">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
              <BarChart3 className="w-6 h-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                No equity activity yet
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-xs">
                Once you log trades and entries for {year}, your monthly net by
                source will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
