"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import EChart from "@/components/charts/EChart";
import { useThemeTokens } from "@/lib/use-theme-tokens";
import { fmtMonthShort } from "./format";
import { useDisplayCurrency } from "@/components/ui/currency";

/**
 * Resolve `var(--x)` strings to concrete colours for the canvas renderer.
 * Re-resolves when the theme class on <html> changes.
 */
export function useResolvedColors(vars: string[]): string[] {
  const key = vars.join("|");
  const [out, setOut] = useState<string[]>(() => vars.map(() => "#888888"));
  useEffect(() => {
    const list = key.split("|");
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      return list.map((v) => {
        const m = /^var\((--[\w-]+)\)$/.exec(v);
        return m ? cs.getPropertyValue(m[1]).trim() || "#888888" : v;
      });
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOut(read());
    const obs = new MutationObserver(() => setOut(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [key]);
  return out;
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string; // CSS var
}

/** Allocation donut (values in USD). Centre shows the total; hover shows value + share — in the display currency. */
export function AllocationDonut({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const t = useThemeTokens();
  const colors = useResolvedColors(slices.map((s) => s.color));
  const { toDisplay, formatDisplay } = useDisplayCurrency();
  const option = useMemo<EChartsCoreOption>(
    () => ({
      tooltip: {
        trigger: "item",
        backgroundColor: t.elevated,
        borderColor: t.border,
        borderWidth: 1,
        textStyle: { color: t.foreground, fontSize: 12 },
        formatter: (p: unknown) => {
          const pt = p as { name: string; value: number; percent: number; color: string };
          return `<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:${pt.color}"></span>${pt.name}</div><div style="margin-top:2px"><b>${formatDisplay(pt.value)}</b> <span style="color:${t.muted}">· ${pt.percent.toFixed(1)}%</span></div>`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["66%", "90%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          padAngle: 1.5,
          itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: true, scaleSize: 4 },
          animation: false,
          data: slices.map((s, i) => ({ name: s.label, value: Math.round(toDisplay(s.value, "USD")), itemStyle: { color: colors[i] } })),
        },
      ],
    }),
    [slices, colors, t, toDisplay, formatDisplay]
  );
  return (
    <div className="relative aspect-square w-full max-w-[200px] shrink-0">
      <EChart option={option} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total</span>
        <span className="num text-xl font-semibold tracking-tight text-foreground">{formatDisplay(toDisplay(total, "USD"), { compact: true })}</span>
      </div>
    </div>
  );
}

/** Savings over time (USD in, display currency out) — area line; ≥2 points. */
export function HistoryChart({ points }: { points: { month: string; savingsUsd: number }[] }) {
  const t = useThemeTokens();
  const { toDisplay, formatDisplay } = useDisplayCurrency();
  const option = useMemo<EChartsCoreOption>(() => {
    const vals = points.map((p) => toDisplay(p.savingsUsd, "USD"));
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: t.elevated,
        borderColor: t.border,
        borderWidth: 1,
        textStyle: { color: t.foreground, fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: t.borderStrong } },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const pt = arr[0] as { axisValue: string; value: number; dataIndex: number };
          const prev = pt.dataIndex > 0 ? vals[pt.dataIndex - 1] : null;
          const d = prev != null ? pt.value - prev : null;
          return (
            `<div style="color:${t.muted};font-size:11px">${fmtMonthShort(pt.axisValue)}</div>` +
            `<div><b>${formatDisplay(pt.value)}</b></div>` +
            (d != null
              ? `<div style="font-size:11px;color:${d >= 0 ? t.success : t.danger}">${d >= 0 ? "+" : "−"}${formatDisplay(Math.abs(d))} vs prior</div>`
              : "")
          );
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: points.map((p) => p.month),
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: false },
        axisLabel: { color: t.muted, fontSize: 11, formatter: (v: string) => fmtMonthShort(v), hideOverlap: true },
      },
      yAxis: {
        type: "value",
        // Let ECharts pick "nice" bounds — fixed 1,000-rounding produced
        // crowded edge labels (₪1.51M over ₪1.5M) once values are in shekels.
        scale: true,
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.border, type: [2, 4] } },
        axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => formatDisplay(v, { compact: true }) },
      },
      series: [
        {
          type: "line",
          data: vals,
          smooth: 0.25,
          showSymbol: points.length <= 12,
          symbolSize: 8,
          lineStyle: { color: t.primary, width: 2 },
          itemStyle: { color: t.primary, borderColor: t.surface, borderWidth: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${t.primary}38` },
                { offset: 1, color: `${t.primary}00` },
              ],
            },
          },
          animation: false,
        },
      ],
    };
  }, [points, t, toDisplay, formatDisplay]);
  return <EChart option={option} />;
}
