"use client";

import { useMemo } from "react";
import { Briefcase, TrendingUp, TrendingDown, Hash, Wallet } from "lucide-react";
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

  const totalReturnPct = totalPnL / account.startingBalance;

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 lg:mb-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#3B82F6]/10 shrink-0">
            <Briefcase className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Portfolio Tracker</h1>
            <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Year-long performance tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] px-4 py-2.5 shadow-sm">
          <Wallet className="w-4 h-4 text-[#3B82F6] shrink-0" />
          <span className="text-sm text-[var(--muted-foreground)]">Starting Balance</span>
          <span className="text-sm font-bold font-data text-[var(--foreground)]">
            {formatCurrency(account.startingBalance)}
          </span>
        </div>
      </div>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile
          label="Total P&L"
          value={`${totalPnL >= 0 ? "+" : ""}${formatCurrency(totalPnL)}`}
          icon={totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          valueColor={totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
        />
        <StatTile
          label="Total Return"
          value={`${totalReturnPct >= 0 ? "+" : ""}${formatPercent(totalReturnPct)}`}
          icon={totalReturnPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          valueColor={totalReturnPct >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
        />
        <StatTile
          label="Total Trades"
          value={`${totalTrades}`}
          icon={<Hash className="w-4 h-4" />}
        />
        <StatTile
          label="Final Balance"
          value={formatCurrency(finalBalance)}
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="text-left px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Month</th>
                <th className="text-right px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Trades</th>
                <th className="text-right px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Portfolio Start</th>
                <th className="text-right px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Monthly P&L</th>
                <th className="text-right px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Portfolio End</th>
                <th className="text-right px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Monthly Return</th>
                <th className="text-right px-4 py-3 text-[var(--muted-foreground)] font-semibold text-xs uppercase tracking-wide">Cumulative Return</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((m) => (
                <tr key={m.month} className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--muted)]/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{m.monthName}</td>
                  <td className="px-4 py-3 text-right font-data text-[var(--foreground)]">
                    {m.tradeCount > 0 ? m.tradeCount : <span className="text-[var(--muted-foreground)]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-[var(--foreground)]">
                    {formatCurrency(m.portfolioStart)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-data font-semibold",
                      m.monthlyPnL > 0
                        ? "text-[#00D68F]"
                        : m.monthlyPnL < 0
                          ? "text-[#FF4D6A]"
                          : "text-[var(--muted-foreground)]"
                    )}
                  >
                    {m.monthlyPnL !== 0
                      ? `${m.monthlyPnL > 0 ? "+" : ""}${formatCurrency(m.monthlyPnL)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-[var(--foreground)]">
                    {formatCurrency(m.portfolioEnd)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-data",
                      m.monthlyReturnPct > 0
                        ? "text-[#00D68F]"
                        : m.monthlyReturnPct < 0
                          ? "text-[#FF4D6A]"
                          : "text-[var(--muted-foreground)]"
                    )}
                  >
                    {m.monthlyReturnPct !== 0
                      ? `${m.monthlyReturnPct > 0 ? "+" : ""}${formatPercent(m.monthlyReturnPct)}`
                      : "-"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-data",
                      m.cumulativeReturnPct > 0
                        ? "text-[#00D68F]"
                        : m.cumulativeReturnPct < 0
                          ? "text-[#FF4D6A]"
                          : "text-[var(--muted-foreground)]"
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
              <tr className="bg-[var(--muted)] font-semibold border-t border-[var(--border)]">
                <td className="px-4 py-3.5 text-[var(--foreground)]">Total</td>
                <td className="px-4 py-3.5 text-right font-data text-[var(--foreground)]">{totalTrades}</td>
                <td className="px-4 py-3.5 text-right font-data text-[var(--foreground)]">
                  {formatCurrency(account.startingBalance)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3.5 text-right font-data",
                    totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatCurrency(totalPnL)}
                </td>
                <td className="px-4 py-3.5 text-right font-data text-[var(--foreground)]">
                  {formatCurrency(finalBalance)}
                </td>
                <td className="px-4 py-3.5 text-right text-[var(--muted-foreground)]">-</td>
                <td
                  className={cn(
                    "px-4 py-3.5 text-right font-data",
                    totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
                  )}
                >
                  {totalPnL >= 0 ? "+" : ""}
                  {formatPercent(totalReturnPct)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{label}</span>
        <span className="text-[var(--muted-foreground)]">{icon}</span>
      </div>
      <p className={cn("text-xl sm:text-2xl font-bold font-data tracking-tight", valueColor ?? "text-[var(--foreground)]")}>
        {value}
      </p>
    </div>
  );
}
