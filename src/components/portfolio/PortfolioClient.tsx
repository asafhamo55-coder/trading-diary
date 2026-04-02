"use client";

import { useMemo } from "react";
import { Briefcase } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { Trade, Account, MonthlyReview } from "@/lib/types";
import { calculatePortfolioTracker } from "@/lib/calculations/portfolio";

export default function PortfolioClient({
  trades,
  account,
  reviews,
}: {
  trades: Trade[];
  account: Account;
  reviews: MonthlyReview[];
}) {
  const portfolio = useMemo(() => {
    const tradesByMonth = new Map<
      number,
      { totalPnL: number | null; riskReward: number | null; isCompleted: boolean; tradeDate: Date }[]
    >();
    trades.forEach((t) => {
      if (!tradesByMonth.has(t.month)) tradesByMonth.set(t.month, []);
      tradesByMonth.get(t.month)!.push({
        totalPnL: t.totalPnL,
        riskReward: t.riskReward,
        isCompleted: t.isCompleted,
        tradeDate: new Date(t.tradeDate),
      });
    });

    const riskUnits = new Map<number, number>();
    reviews.forEach((r) => {
      if (r.riskUnit !== null) riskUnits.set(r.month, r.riskUnit);
    });

    return calculatePortfolioTracker(tradesByMonth, account.startingBalance, riskUnits);
  }, [trades, account, reviews]);

  const totalPnL = portfolio.reduce((sum, m) => sum + m.monthlyPnL, 0);
  const totalTrades = portfolio.reduce((sum, m) => sum + m.tradeCount, 0);
  const finalBalance = portfolio[portfolio.length - 1]?.portfolioEnd ?? account.startingBalance;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#E8ECF4]">Portfolio Tracker</h1>
          <p className="text-[#8892A6] text-sm mt-1">Year-long performance tracking</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[#151921] border border-[#2A3040] px-4 py-2">
          <Briefcase className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-sm text-[#8892A6]">Starting Balance:</span>
          <span className="text-sm font-bold text-[#E8ECF4]">
            {formatCurrency(account.startingBalance)}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-[#151921] border border-[#2A3040] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A3040] bg-[#1C2130]">
                <th className="text-left px-4 py-3 text-[#8892A6] font-medium">Month</th>
                <th className="text-right px-4 py-3 text-[#8892A6] font-medium">Trades</th>
                <th className="text-right px-4 py-3 text-[#8892A6] font-medium">Portfolio Start</th>
                <th className="text-right px-4 py-3 text-[#8892A6] font-medium">Monthly P&L</th>
                <th className="text-right px-4 py-3 text-[#8892A6] font-medium">Portfolio End</th>
                <th className="text-right px-4 py-3 text-[#8892A6] font-medium">Monthly Return</th>
                <th className="text-right px-4 py-3 text-[#8892A6] font-medium">Cumulative Return</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((m) => (
                <tr key={m.month} className="border-b border-[#2A3040]/50 hover:bg-[#1C2130]/50">
                  <td className="px-4 py-3 font-medium text-[#E8ECF4]">{m.monthName}</td>
                  <td className="px-4 py-3 text-right text-[#E8ECF4]">
                    {m.tradeCount > 0 ? m.tradeCount : <span className="text-[#8892A6]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-[#E8ECF4]">
                    {formatCurrency(m.portfolioStart)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium",
                      m.monthlyPnL > 0
                        ? "text-[#00D68F]"
                        : m.monthlyPnL < 0
                          ? "text-[#FF4D6A]"
                          : "text-[#8892A6]"
                    )}
                  >
                    {m.monthlyPnL !== 0
                      ? `${m.monthlyPnL > 0 ? "+" : ""}${formatCurrency(m.monthlyPnL)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#E8ECF4]">
                    {formatCurrency(m.portfolioEnd)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right",
                      m.monthlyReturnPct > 0
                        ? "text-[#00D68F]"
                        : m.monthlyReturnPct < 0
                          ? "text-[#FF4D6A]"
                          : "text-[#8892A6]"
                    )}
                  >
                    {m.monthlyReturnPct !== 0
                      ? `${m.monthlyReturnPct > 0 ? "+" : ""}${formatPercent(m.monthlyReturnPct)}`
                      : "-"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right",
                      m.cumulativeReturnPct > 0
                        ? "text-[#00D68F]"
                        : m.cumulativeReturnPct < 0
                          ? "text-[#FF4D6A]"
                          : "text-[#8892A6]"
                    )}
                  >
                    {m.cumulativeReturnPct !== 0
                      ? `${m.cumulativeReturnPct > 0 ? "+" : ""}${formatPercent(m.cumulativeReturnPct)}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1C2130] font-semibold">
                <td className="px-4 py-3 text-[#E8ECF4]">Total</td>
                <td className="px-4 py-3 text-right text-[#E8ECF4]">{totalTrades}</td>
                <td className="px-4 py-3 text-right text-[#E8ECF4]">
                  {formatCurrency(account.startingBalance)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right",
                    totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatCurrency(totalPnL)}
                </td>
                <td className="px-4 py-3 text-right text-[#E8ECF4]">
                  {formatCurrency(finalBalance)}
                </td>
                <td className="px-4 py-3 text-right text-[#8892A6]">-</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right",
                    totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatPercent(totalPnL / account.startingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
