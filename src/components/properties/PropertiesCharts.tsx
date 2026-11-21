"use client";

import * as React from "react";
import type { EChartsCoreOption } from "echarts/core";
import { BarChart3, Scale } from "lucide-react";
import EChart from "@/components/charts/EChart";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useDisplayCurrency } from "@/components/ui/currency";
import { useThemeTokens } from "@/lib/use-theme-tokens";
import { MONTH_ABBR } from "@/lib/property";
import type { PropertyRow } from "@/lib/property-portfolio";

const CHART_VARS = Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`);

/** The categorical --chart-* palette, resolved for the canvas and re-read on theme change. */
function useChartPalette(): string[] {
  const t = useThemeTokens();
  const [colors, setColors] = React.useState<string[]>([]);
  React.useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setColors(CHART_VARS.map((v) => cs.getPropertyValue(v).trim()).filter(Boolean));
    // `t.mode` changes with the theme class, so this re-reads on switch.
  }, [t.mode]);
  return colors.length ? colors : [t.primary, t.accent, t.success, t.violet, t.info, t.danger, t.warning, t.muted];
}

function tooltipBase(t: ReturnType<typeof useThemeTokens>) {
  return {
    backgroundColor: t.elevated,
    borderColor: t.border,
    borderWidth: 1,
    textStyle: { color: t.foreground, fontSize: 12 },
    extraCssText: "box-shadow:none;border-radius:8px;",
  };
}

/** Monthly net for the selected year, one stacked series per rental, plus the total. */
export function MonthlyNetChart({ rows, year, elapsed }: { rows: PropertyRow[]; year: number; elapsed: number }) {
  const t = useThemeTokens();
  const palette = useChartPalette();
  const { toDisplay, formatDisplay } = useDisplayCurrency();
  const series = rows.filter((r) => r.monthlyNet.some((v) => v !== 0));
  const months = Math.max(1, elapsed || 12);

  const option = React.useMemo<EChartsCoreOption>(() => {
    const labels = MONTH_ABBR.slice(0, months) as unknown as string[];
    const total = labels.map((_, i) => series.reduce((s, r) => s + toDisplay(r.monthlyNet[i] ?? 0, "USD"), 0));
    return {
      animation: false,
      grid: { left: 8, right: 8, top: 36, bottom: 4 },
      legend: {
        type: "scroll",
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: t.muted, fontSize: 11 },
        pageTextStyle: { color: t.muted },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: t.border, opacity: 0.35 } },
        ...tooltipBase(t),
        valueFormatter: (v: number) => formatDisplay(v),
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: false },
        axisLabel: { color: t.muted, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: t.border, type: "dashed" } },
        axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => formatDisplay(v, { compact: true }) },
      },
      series: [
        ...series.map((r, i) => ({
          name: r.title,
          type: "bar",
          stack: "net",
          barMaxWidth: 28,
          itemStyle: { color: palette[i % palette.length], borderRadius: 2 },
          emphasis: { focus: "series" },
          data: labels.map((_, m) => Math.round(toDisplay(r.monthlyNet[m] ?? 0, "USD"))),
        })),
        {
          name: "Total",
          type: "line",
          symbol: "circle",
          symbolSize: 5,
          z: 5,
          lineStyle: { color: t.foreground, width: 1.5 },
          itemStyle: { color: t.foreground },
          data: total.map((v) => Math.round(v)),
        },
      ],
    };
  }, [series, months, palette, t, toDisplay, formatDisplay]);

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="pb-2">
        <CardTitle as="h2">Monthly net cash flow · {year}</CardTitle>
        <CardDescription>Rentals only, stacked by property</CardDescription>
      </CardHeader>
      <div className="px-3 pb-4 sm:px-4">
        {series.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={<BarChart3 />}
            title={`No entries for ${year}`}
            description="Log rental income and expenses to see the monthly picture."
          />
        ) : (
          <div
            className="h-64"
            role="img"
            aria-label={`Monthly net cash flow for ${year}, stacked by property. ${series
              .map((r) => `${r.title} ${formatDisplay(toDisplay(r.net, "USD"))}`)
              .join("; ")}.`}
          >
            <EChart option={option} />
          </div>
        )}
      </div>
    </Card>
  );
}

/** Value per rental split into mortgage + equity (horizontal bars). */
export function EquityChart({ rows }: { rows: PropertyRow[] }) {
  const t = useThemeTokens();
  const { toDisplay, formatDisplay } = useDisplayCurrency();
  const valued = React.useMemo(
    () => rows.filter((r) => r.currentValue != null && r.currentValue > 0).sort((a, b) => (a.currentValue ?? 0) - (b.currentValue ?? 0)),
    [rows]
  );

  const option = React.useMemo<EChartsCoreOption>(() => {
    const mortgage = valued.map((r) => Math.round(toDisplay(Math.min(r.mortgageBalance ?? 0, r.currentValue ?? 0), "USD")));
    const equity = valued.map((r) => Math.round(toDisplay((r.currentValue ?? 0) - Math.min(r.mortgageBalance ?? 0, r.currentValue ?? 0), "USD")));
    return {
      animation: false,
      grid: { left: 8, right: 16, top: 30, bottom: 4 },
      legend: {
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: t.muted, fontSize: 11 },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: t.border, opacity: 0.35 } },
        ...tooltipBase(t),
        valueFormatter: (v: number) => formatDisplay(v),
      },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: t.border, type: "dashed" } },
        axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => formatDisplay(v, { compact: true }) },
      },
      yAxis: {
        type: "category",
        data: valued.map((r) => r.title),
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: false },
        axisLabel: { color: t.foregroundSecondary, fontSize: 11, width: 120, overflow: "truncate" },
      },
      series: [
        {
          name: "Mortgage",
          type: "bar",
          stack: "value",
          barMaxWidth: 18,
          itemStyle: { color: t.borderStrong },
          data: mortgage,
        },
        {
          name: "Equity",
          type: "bar",
          stack: "value",
          barMaxWidth: 18,
          itemStyle: { color: t.success, borderRadius: [0, 3, 3, 0] },
          data: equity,
        },
      ],
    };
  }, [valued, t, toDisplay, formatDisplay]);

  const missing = valued.filter((r) => r.mortgageBalance == null).length;

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="pb-2">
        <CardTitle as="h2">Equity by property</CardTitle>
        <CardDescription>
          Current value split into mortgage and equity
          {missing > 0 ? ` · ${missing} without a mortgage figure (shown as all equity)` : ""}
        </CardDescription>
      </CardHeader>
      <div className="px-3 pb-4 sm:px-4">
        {valued.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={<Scale />}
            title="No values yet"
            description="Add a current value to a property to see its equity."
          />
        ) : (
          <div
            style={{ height: Math.max(160, valued.length * 34 + 50) }}
            role="img"
            aria-label={`Equity by property. ${valued
              .map(
                (r) =>
                  `${r.title}: value ${formatDisplay(toDisplay(r.currentValue ?? 0, "USD"))}, mortgage ${
                    r.mortgageBalance == null ? "not set" : formatDisplay(toDisplay(r.mortgageBalance, "USD"))
                  }`
              )
              .join("; ")}.`}
          >
            <EChart option={option} />
          </div>
        )}
      </div>
    </Card>
  );
}
