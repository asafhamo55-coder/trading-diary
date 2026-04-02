"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import type { Trade } from "@/lib/types";

interface TradesListClientProps {
  trades: Trade[];
}

export default function TradesListClient({ trades }: TradesListClientProps) {
  const router = useRouter();
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [directionFilter, setDirectionFilter] = useState<
    "ALL" | "LONG" | "SHORT"
  >("ALL");
  const [symbolSearch, setSymbolSearch] = useState("");

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (monthFilter !== null && trade.month !== monthFilter) return false;
      if (directionFilter !== "ALL" && trade.direction !== directionFilter)
        return false;
      if (
        symbolSearch &&
        !trade.symbol.toLowerCase().includes(symbolSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [trades, monthFilter, directionFilter, symbolSearch]);

  return (
    <div className="min-h-screen bg-[#0C0F14] text-[#E8ECF4]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <Link
            href="/trades/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Trade
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-[#151921] border border-[#2A3040] p-4">
          {/* Month Selector */}
          <select
            value={monthFilter ?? ""}
            onChange={(e) =>
              setMonthFilter(e.target.value === "" ? null : Number(e.target.value))
            }
            className="rounded-lg bg-[#1C2130] border border-[#2A3040] px-3 py-2 text-sm text-[#E8ECF4] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
          >
            <option value="">All Months</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>

          {/* Direction Filter */}
          <div className="flex rounded-lg border border-[#2A3040] overflow-hidden">
            {(["ALL", "LONG", "SHORT"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionFilter(dir)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors",
                  directionFilter === dir
                    ? "bg-[#1C2130] text-[#E8ECF4]"
                    : "bg-[#151921] text-[#8892A6] hover:text-[#E8ECF4]"
                )}
              >
                {dir === "ALL" ? "All" : dir}
              </button>
            ))}
          </div>

          {/* Symbol Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8892A6]" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
              className="w-full rounded-lg bg-[#1C2130] border border-[#2A3040] py-2 pl-9 pr-3 text-sm text-[#E8ECF4] placeholder:text-[#8892A6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl bg-[#151921] border border-[#2A3040]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A3040] text-[#8892A6]">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Symbol</th>
                <th className="px-4 py-3 text-left font-medium">Direction</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Shares</th>
                <th className="px-4 py-3 text-right font-medium">Avg Buy</th>
                <th className="px-4 py-3 text-right font-medium">Avg Sell</th>
                <th className="px-4 py-3 text-right font-medium">P&L</th>
                <th className="px-4 py-3 text-right font-medium">R/R</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-[#8892A6]"
                  >
                    No trades match your filters.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => {
                  const pnl = trade.totalPnL ?? 0;
                  const isProfit = pnl > 0;
                  const isLoss = pnl < 0;

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => router.push(`/trades/${trade.id}`)}
                      className="border-b border-[#2A3040] last:border-b-0 cursor-pointer hover:bg-[#1C2130] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-[#8892A6]">
                        {trade.tradeDate}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                            trade.direction === "LONG"
                              ? "bg-[#00D68F]/10 text-[#00D68F]"
                              : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                          )}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8892A6]">
                        {trade.tradeType ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {trade.totalShares ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {trade.avgBuyPrice
                          ? formatCurrency(trade.avgBuyPrice)
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {trade.avgSellPrice && trade.avgSellPrice > 0
                          ? formatCurrency(trade.avgSellPrice)
                          : "\u2014"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-mono font-semibold",
                          isProfit && "text-[#00D68F]",
                          isLoss && "text-[#FF4D6A]"
                        )}
                      >
                        {trade.isCompleted
                          ? formatCurrency(pnl)
                          : "\u2014"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-mono",
                          isProfit && "text-[#00D68F]",
                          isLoss && "text-[#FF4D6A]"
                        )}
                      >
                        {trade.isCompleted
                          ? formatNumber(trade.riskReward ?? 0)
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                            trade.isCompleted
                              ? "bg-[#00D68F]/10 text-[#00D68F]"
                              : "bg-[#3B82F6]/10 text-[#3B82F6]"
                          )}
                        >
                          {trade.isCompleted ? "Closed" : "Open"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-[#8892A6]">
          Showing {filteredTrades.length} of {trades.length} trades
        </div>
      </div>
    </div>
  );
}
