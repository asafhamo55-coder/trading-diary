"use client";

import Link from "next/link";
import { Calendar, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
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
    <div className="flex-1 p-5 sm:p-6 lg:p-8">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B82F6]/12 ring-1 ring-inset ring-[#3B82F6]/20">
              <Calendar className="w-[18px] h-[18px] text-[#3B82F6]" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Monthly Overview</h1>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm mt-2">
            Performance breakdown by month · <span className="font-data text-[var(--foreground)]">{year}</span>
          </p>
        </div>
        <YearPicker years={availableYears} selected={year} />
      </div>

      {/* Link each month card to /monthly/[month]?year=YYYY so drill-down stays in selected year */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {monthCards.map((card) => {
          const positive = card.totalPnL >= 0;
          return (
            <Link
              key={card.month}
              href={`/trade/monthly/${card.month}?year=${year}`}
              className={cn(
                "pressable group relative block overflow-hidden rounded-2xl bg-[var(--card)] border border-[var(--border)] p-5 shadow-sm transition-all",
                card.hasTrades
                  ? "hover:border-[#3B82F6]/50 hover:shadow-lg"
                  : "opacity-70 hover:opacity-100 hover:border-[var(--border)]"
              )}
            >
              {/* Accent rail — tinted by month outcome */}
              {card.hasTrades && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-1",
                    positive ? "bg-[#00D68F]" : "bg-[#FF4D6A]"
                  )}
                />
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3B82F6]" />
                  <span className="font-semibold text-[var(--foreground)]">{card.name}</span>
                </div>
                {card.hasTrades ? (
                  <span className="font-data text-xs text-[var(--muted-foreground)] tabular-nums">
                    {card.trades} {card.trades === 1 ? "trade" : "trades"}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-60" />
                )}
              </div>

              {card.hasTrades ? (
                <div className="space-y-3.5">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total P&L</span>
                    <div
                      className={cn(
                        "font-data text-2xl font-bold leading-tight tracking-tight tabular-nums mt-0.5",
                        positive ? "text-[#00D68F]" : "text-[#FF4D6A]"
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatCurrency(card.totalPnL)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-sm text-[var(--muted-foreground)]">Win Rate</span>
                    <span className="font-data text-sm font-semibold text-[var(--foreground)] tabular-nums">
                      {formatPercent(card.winRate)}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                      positive
                        ? "bg-[#00D68F]/10 text-[#00D68F]"
                        : "bg-[#FF4D6A]/10 text-[#FF4D6A]"
                    )}
                  >
                    {positive ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {positive ? "Profitable" : "Loss"} month
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 py-4 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">No trades</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Nothing logged this month</p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
