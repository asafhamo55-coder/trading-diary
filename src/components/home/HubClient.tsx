"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, Lock, BarChart3 } from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsCoreOption } from "echarts/core";
import { cn, formatCurrency } from "@/lib/utils";
import Logo from "@/components/layout/Logo";
import YearPicker from "@/components/layout/YearPicker";

interface MonthlyRow {
  month: number;
  name: string;
  trade: number;
  properties: number;
  home: number;
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
    () => monthly.map((m) => m.trade + m.properties + m.home),
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
      data: monthly.map((m) => m[s.key]),
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
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto max-w-6xl mx-auto w-full">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Logo size="lg" />
        </div>
        {availableYears.length > 0 && (
          <YearPicker years={availableYears} selected={year} />
        )}
      </div>

      {/* Consolidated equity summary */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
          <p className="text-sm text-[var(--muted-foreground)]">
            Consolidated equity · {year}
          </p>
        </div>
        <h1
          className={cn(
            "text-4xl md:text-5xl font-bold font-data",
            grandTotal >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
          )}
        >
          {grandTotal >= 0 ? "+" : ""}
          {formatCurrency(grandTotal)}
        </h1>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">
          Aggregated across Hamo Trade, Properties & Home
        </p>
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {sources.map((s) => {
          const color = SOURCE_COLORS[s.key];
          const card = (
            <div
              className={cn(
                "h-full bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 transition-colors",
                s.ready
                  ? "hover:border-[color:var(--border)] cursor-pointer"
                  : "opacity-80"
              )}
              style={s.ready ? { borderColor: undefined } : undefined}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {s.label}
                  </h3>
                </div>
                {s.ready ? (
                  <ArrowUpRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                )}
              </div>
              {s.ready ? (
                <p
                  className={cn(
                    "text-2xl font-bold font-data mb-2",
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
            <Link key={s.key} href={s.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={s.key}>{card}</div>
          );
        })}
      </div>

      {/* Monthly equity chart */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Monthly Equity Analysis
          </h3>
          <span className="text-xs text-[var(--muted-foreground)]">
            · net by source, cumulative line
          </span>
        </div>
        {hasData ? (
          <div className="h-72">
            <EChart option={option} />
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-[var(--muted-foreground)]">
            No equity activity recorded for {year} yet.
          </div>
        )}
      </div>
    </div>
  );
}
