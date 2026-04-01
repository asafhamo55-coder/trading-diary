"use client";

import Link from "next/link";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/types";
import { DEMO_TRADES, getDemoTradesByMonth } from "@/lib/demo-data";

export default function MonthlyOverviewPage() {
  const monthCards = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const trades = getDemoTradesByMonth(month);
    const completed = trades.filter((t) => t.isCompleted);
    const totalPnL = completed.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
    const winners = completed.filter((t) => (t.totalPnL ?? 0) > 0);
    const winRate = completed.length > 0 ? winners.length / completed.length : 0;

    return { month, name: MONTH_NAMES[i], trades: completed.length, totalPnL, winRate, hasTrades: trades.length > 0 };
  });

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#E8ECF4]">Monthly Overview</h1>
        <p className="text-[#8892A6] text-sm mt-1">Performance breakdown by month</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {monthCards.map((card) => (
          <Link
            key={card.month}
            href={`/monthly/${card.month}`}
            className="block rounded-xl bg-[#151921] border border-[#2A3040] p-5 hover:border-[#3B82F6]/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#3B82F6]" />
                <span className="font-semibold text-[#E8ECF4]">{card.name}</span>
              </div>
              {card.hasTrades && (
                <span className="text-xs text-[#8892A6]">{card.trades} trades</span>
              )}
            </div>

            {card.hasTrades ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8892A6]">Total P&L</span>
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
                  <span className="text-sm text-[#8892A6]">Win Rate</span>
                  <span className="text-sm font-medium text-[#E8ECF4]">
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
              <p className="text-[#8892A6] text-sm">No trades</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
