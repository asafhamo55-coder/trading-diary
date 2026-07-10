"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Layers,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Download,
  SearchX,
  X,
} from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import type { Trade } from "@/lib/types";
import YearPicker from "@/components/layout/YearPicker";

interface TradesListClientProps {
  trades: Trade[];
  year: number;
  availableYears: number[];
}

export default function TradesListClient({
  trades,
  year,
  availableYears,
}: TradesListClientProps) {
  const router = useRouter();
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [directionFilter, setDirectionFilter] = useState<
    "ALL" | "LONG" | "SHORT"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">(
    "ALL"
  );
  const [symbolSearch, setSymbolSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Counts per month (across all trades, so the pill labels are stable)
  const monthCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const t of trades) {
      counts.set(t.month, (counts.get(t.month) ?? 0) + 1);
    }
    return counts;
  }, [trades]);

  // Months that have at least one trade, sorted ascending
  const monthsWithTrades = useMemo(
    () => Array.from(monthCounts.keys()).sort((a, b) => a - b),
    [monthCounts]
  );

  const filteredTrades = useMemo(() => {
    const filtered = trades.filter((trade) => {
      if (monthFilter !== null && trade.month !== monthFilter) return false;
      if (directionFilter !== "ALL" && trade.direction !== directionFilter)
        return false;
      if (statusFilter === "OPEN" && trade.isCompleted) return false;
      if (statusFilter === "CLOSED" && !trade.isCompleted) return false;
      if (
        symbolSearch &&
        !trade.symbol.toLowerCase().includes(symbolSearch.toLowerCase())
      )
        return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => dir * a.tradeDate.localeCompare(b.tradeDate)
    );
  }, [trades, monthFilter, directionFilter, statusFilter, symbolSearch, sortDir]);

  const openCount = useMemo(
    () => trades.filter((t) => !t.isCompleted).length,
    [trades]
  );
  const closedCount = trades.length - openCount;

  function exportCsv() {
    const headers = [
      "Date",
      "Symbol",
      "Direction",
      "Trade Type",
      "Asset",
      "Status",
      "Total Shares",
      "Shares Open",
      "Avg Buy",
      "Avg Sell",
      "Total P&L",
      "R/R",
      "Return on Position",
      "Position Value",
      "Total Commissions",
      "Entry Reason",
      "Exit Reason",
      "Conclusions",
      "Notes",
      "Chart URL",
    ];
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      // Escape per RFC 4180 — wrap in quotes if contains , " or newline; double internal quotes
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = filteredTrades.map((t) => {
      const totalShares = t.totalShares ?? 0;
      const sharesOpen = t.sharesInProcess ?? 0;
      const isPartial =
        !t.isCompleted && totalShares > 0 && sharesOpen > 0 && sharesOpen < totalShares;
      const status = t.isCompleted
        ? "Closed"
        : isPartial
        ? "Partial"
        : "Open";
      return [
        t.tradeDate.slice(0, 10),
        t.symbol,
        t.direction,
        t.tradeType ?? "",
        t.isAsset ? "Y" : "N",
        status,
        totalShares,
        sharesOpen,
        t.avgBuyPrice ?? "",
        t.avgSellPrice ?? "",
        t.totalPnL ?? "",
        t.riskReward ?? "",
        t.returnOnPosition ?? "",
        t.totalPositionValue ?? "",
        t.totalCommissions ?? "",
        t.entryReason ?? "",
        t.exitReason ?? "",
        t.conclusions ?? "",
        t.notes ?? "",
        t.chartUrl ?? "",
      ].map(esc).join(",");
    });
    // BOM so Excel detects UTF-8 (Hebrew text in notes etc.)
    const csv = "﻿" + [headers.map(esc).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `trades_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
            <YearPicker years={availableYears} selected={year} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={filteredTrades.length === 0}
              className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download the currently filtered trades as a CSV file (opens in Excel)"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span> ({filteredTrades.length})
            </button>
            <Link
              href="/trade/trades/new"
              className="pressable inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-[#3B82F6]/20 hover:bg-[#3B82F6]/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Trade
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Status Tabs — primary filter */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)]">
          {(
            [
              {
                key: "ALL",
                label: "All Trades",
                count: trades.length,
                icon: Layers,
                color: "#E8ECF4",
              },
              {
                key: "OPEN",
                label: "Open",
                count: openCount,
                icon: Clock,
                color: "#3B82F6",
              },
              {
                key: "CLOSED",
                label: "Closed",
                count: closedCount,
                icon: CheckCircle2,
                color: "#00D68F",
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "pressable inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  active
                    ? "border-current"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
                style={active ? { color: tab.color } : undefined}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={cn(
                    "rounded-full text-[11px] font-data px-2 py-0.5",
                    active
                      ? "bg-[var(--muted)]"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Month pill row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMonthFilter(null)}
            className={cn(
              "pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
              monthFilter === null
                ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[#3B82F6]/40"
            )}
          >
            All months
            <span
              className={cn(
                "rounded-full text-[10px] font-data px-1.5",
                monthFilter === null
                  ? "bg-[#3B82F6]/20"
                  : "bg-[var(--muted)]"
              )}
            >
              {trades.length}
            </span>
          </button>
          {monthsWithTrades.map((m) => {
            const active = monthFilter === m;
            return (
              <button
                key={m}
                onClick={() => setMonthFilter(active ? null : m)}
                className={cn(
                  "pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                  active
                    ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[#3B82F6]/40"
                )}
              >
                {MONTH_NAMES[m - 1]}
                <span
                  className={cn(
                    "rounded-full text-[10px] font-data px-1.5",
                    active ? "bg-[#3B82F6]/20" : "bg-[var(--muted)]"
                  )}
                >
                  {monthCounts.get(m) ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
          {/* Direction Filter */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(["ALL", "LONG", "SHORT"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionFilter(dir)}
                className={cn(
                  "pressable px-3.5 py-2 text-sm font-medium transition-colors",
                  directionFilter === dir
                    ? dir === "LONG"
                      ? "bg-[#00D68F]/10 text-[#00D68F]"
                      : dir === "SHORT"
                      ? "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                      : "bg-[var(--muted)] text-[var(--foreground)]"
                    : "bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {dir === "ALL" ? "All" : dir}
              </button>
            ))}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="pressable inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title={
              sortDir === "asc"
                ? "Oldest first — click to flip to newest first"
                : "Newest first — click to flip to oldest first"
            }
          >
            {sortDir === "asc" ? (
              <ArrowUpNarrowWide className="h-4 w-4" />
            ) : (
              <ArrowDownNarrowWide className="h-4 w-4" />
            )}
            {sortDir === "asc" ? "Oldest first" : "Newest first"}
          </button>

          {/* Symbol Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
              className="w-full rounded-lg bg-[var(--muted)] border border-[var(--border)] py-2 pl-9 pr-9 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] transition-shadow"
            />
            {symbolSearch && (
              <button
                onClick={() => setSymbolSearch("")}
                className="pressable absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                <th className="px-4 py-3 text-left font-semibold">Direction</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-right font-semibold">Shares</th>
                <th className="px-4 py-3 text-right font-semibold">Avg Buy</th>
                <th className="px-4 py-3 text-right font-semibold">Avg Sell</th>
                <th className="px-4 py-3 text-right font-semibold">P&L</th>
                <th className="px-4 py-3 text-right font-semibold">R/R</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Asset</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)]">
                        <SearchX className="h-7 w-7 text-[var(--muted-foreground)]" />
                      </div>
                      <h3 className="text-base font-semibold text-[var(--foreground)]">
                        No trades match your filters
                      </h3>
                      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">
                        {trades.length === 0
                          ? "You haven't logged any trades this year yet. Add your first one to get started."
                          : "Try clearing a filter or searching for a different symbol."}
                      </p>
                      <Link
                        href="/trade/trades/new"
                        className="pressable mt-5 inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-[#3B82F6]/20 hover:bg-[#3B82F6]/90 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        New Trade
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => {
                  const pnl = trade.totalPnL ?? 0;
                  const isProfit = pnl > 0;
                  const isLoss = pnl < 0;
                  const totalShares = trade.totalShares ?? 0;
                  const sharesOpen = trade.sharesInProcess ?? 0;
                  const isPartial =
                    !trade.isCompleted &&
                    totalShares > 0 &&
                    sharesOpen > 0 &&
                    sharesOpen < totalShares;
                  const hasRealized = trade.isCompleted || isPartial;

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => router.push(`/trade/trades/${trade.id}`)}
                      className="group border-b border-[var(--border)] last:border-b-0 cursor-pointer hover:bg-[var(--muted)]/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-data text-[var(--muted-foreground)] whitespace-nowrap">
                        {trade.tradeDate}
                      </td>
                      <td className="px-4 py-3 font-semibold tracking-tight group-hover:text-[#3B82F6] transition-colors">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                            trade.direction === "LONG"
                              ? "bg-[#00D68F]/10 text-[#00D68F]"
                              : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                          )}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] whitespace-nowrap">
                        {trade.tradeType ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right font-data">
                        {trade.totalShares ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-data">
                        {trade.avgBuyPrice
                          ? formatCurrency(trade.avgBuyPrice)
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right font-data">
                        {trade.avgSellPrice && trade.avgSellPrice > 0
                          ? formatCurrency(trade.avgSellPrice)
                          : "\u2014"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-data font-semibold",
                          isProfit && "text-[#00D68F]",
                          isLoss && "text-[#FF4D6A]"
                        )}
                      >
                        {hasRealized ? formatCurrency(pnl) : "\u2014"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-data",
                          isProfit && "text-[#00D68F]",
                          isLoss && "text-[#FF4D6A]"
                        )}
                      >
                        {hasRealized
                          ? formatNumber(trade.riskReward ?? 0)
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                            trade.isCompleted
                              ? "bg-[#00D68F]/10 text-[#00D68F]"
                              : isPartial
                              ? "bg-[#FFB547]/10 text-[#FFB547]"
                              : "bg-[#3B82F6]/10 text-[#3B82F6]"
                          )}
                          title={
                            isPartial
                              ? `Partial exit \u2014 ${sharesOpen} of ${totalShares} shares still open`
                              : undefined
                          }
                        >
                          {trade.isCompleted
                            ? "Closed"
                            : isPartial
                            ? "Partial"
                            : "Open"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trade.isAsset ? (
                          <span
                            className="inline-flex items-center rounded-md bg-[#A78BFA]/10 px-2 py-0.5 text-xs font-semibold text-[#A78BFA]"
                            title="Marked as asset"
                          >
                            Asset
                          </span>
                        ) : (
                          <span className="text-[var(--border)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-[var(--muted-foreground)]">
          Showing <span className="font-data text-[var(--foreground)]">{filteredTrades.length}</span> of{" "}
          <span className="font-data text-[var(--foreground)]">{trades.length}</span> trades
        </div>
      </div>
    </div>
  );
}
