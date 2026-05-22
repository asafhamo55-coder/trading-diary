"use client";

import Link from "next/link";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import type { Trade } from "@/lib/types";
import YearPicker from "@/components/layout/YearPicker";

// A trade contributes realized P&L when closed OR partially exited.
function hasRealized(t: Trade): boolean {
  if (t.isCompleted) return true;
  const total = t.totalShares ?? 0;
  const open = t.sharesInProcess ?? 0;
  return total > 0 && open < total;
}

export default function MonthlyOverviewClient({
  trades,
  year,
  availableYears,
}: {
  trades: Trade[];
  year: number;
  availableYears: number[];
}) {
  const monthCards = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthTrades = trades.filter((t) => t.month === month);
    const realized = monthTrades.filter(hasRealized);
    const totalPnL = realized.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
    const winners = realized.filter((t) => (t.totalPnL ?? 0) > 0);
    const winRate = realized.length > 0 ? winners.length / realized.length : 0;

    return { month, name: MONTH_NAMES[i], trades: realized.length, totalPnL, winRate, hasTrades: monthTrades.length > 0 };
  });

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Monthly Overview</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Performance breakdown by month · {year}
          </p>
        </div>
        <YearPicker years={availableYears} selected={year} />
      </div>

      {/* Link each month card to /monthly/[month]?year=YYYY so drill-down stays in selected year */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {monthCards.map((card) => (
          <Link
            key={card.month}
            href={`/monthly/${card.month}?year=${year}`}
            className="block rounded-xl bg-[var(--card)] border border-[var(--border)] p-5 hover:border-[#3B82F6]/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#3B82F6]" />
                <span className="font-semibold text-[var(--foreground)]">{card.name}</span>
              </div>
              {card.hasTrades && (
                <span className="text-xs text-[var(--muted-foreground)]">{card.trades} trades</span>
              )}
            </div>

            {card.hasTrades ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)]">Total P&L</span>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      card.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                    )}
                  >
                    {card.totalPnL >= 0 ? "+" : ""}
                    {formatCurrency(card.totalPnL)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)]">Win Rate</span>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {formatPercent(card.winRate)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {card.totalPnL >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#00D68F]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#FF4D6A]" />
                  )}
                  <span className={cn("text-xs", card.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]")}>
                    {card.totalPnL >= 0 ? "Profitable" : "Loss"} month
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[var(--muted-foreground)] text-sm">No trades</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
