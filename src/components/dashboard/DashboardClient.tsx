"use client";

import Header from "@/components/layout/Header";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Activity,
  Scale,
} from "lucide-react";

interface DashboardStats {
  totalTrades: number;
  openTrades: number;
  winRate: number;
  totalPnL: number;
  currentPortfolio: number;
  startingBalance: number;
  avgRR: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

interface MonthlyPnLEntry {
  month: number;
  pnl: number;
  name: string;
}

interface Trade {
  id: string;
  tradeDate: string;
  symbol: string;
  direction: string;
  totalPnL: number | null;
  riskReward: number | null;
  [key: string]: unknown;
}

interface DashboardClientProps {
  stats: DashboardStats;
  monthlyPnL: MonthlyPnLEntry[];
  recentTrades: Trade[];
}

export default function DashboardClient({
  stats,
  monthlyPnL,
  recentTrades,
}: DashboardClientProps) {
  const totalReturn = stats.totalPnL / stats.startingBalance;

  return (
    <>
      <Header title="Dashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
        {/* Hero section */}
        <div className="bg-[#151921] border border-[#2A3040] rounded-xl p-6">
          <p className="text-[#8892A6] text-sm mb-1">Current Portfolio Value</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#E8ECF4] font-data">
            {formatCurrency(stats.currentPortfolio)}
          </h2>
          <div className="flex items-center gap-4 mt-3">
            <span
              className={cn(
                "flex items-center gap-1 text-sm font-semibold font-data",
                stats.totalPnL >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"
              )}
            >
              {stats.totalPnL >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {stats.totalPnL >= 0 ? "+" : ""}
              {formatCurrency(stats.totalPnL)}
            </span>
            <span
              className={cn(
                "text-sm font-semibold font-data px-2 py-0.5 rounded",
                stats.totalPnL >= 0
                  ? "text-[#00D68F] bg-[#00D68F]/10"
                  : "text-[#FF4D6A] bg-[#FF4D6A]/10"
              )}
            >
              {totalReturn >= 0 ? "+" : ""}
              {formatPercent(totalReturn)}
            </span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Trades"
            value={stats.totalTrades.toString()}
            icon={<Activity className="w-5 h-5" />}
            subtext={`${stats.openTrades} open`}
          />
          <StatCard
            label="Win Rate"
            value={formatPercent(stats.winRate)}
            icon={<Target className="w-5 h-5" />}
            subtext={`${Math.round(stats.winRate * stats.totalTrades)} wins`}
            valueColor={stats.winRate >= 0.5 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          />
          <StatCard
            label="Average R/R"
            value={formatNumber(stats.avgRR, 2)}
            icon={<Scale className="w-5 h-5" />}
            subtext="risk/reward"
            valueColor={stats.avgRR >= 1 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          />
          <StatCard
            label="Profit Factor"
            value={formatNumber(stats.profitFactor, 2)}
            icon={<BarChart3 className="w-5 h-5" />}
            subtext="gross W/L"
            valueColor={stats.profitFactor >= 1 ? "text-[#00D68F]" : "text-[#FF4D6A]"}
          />
        </div>

        {/* Monthly P&L placeholder + Recent Trades */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Monthly P&L Chart placeholder */}
          <div className="bg-[#151921] border border-[#2A3040] rounded-xl p-6">
            <h3 className="text-sm font-semibold text-[#E8ECF4] mb-4">
              Monthly P&L
            </h3>
            <div className="flex items-end gap-2 h-48">
              {monthlyPnL.map((m) => {
                const maxPnL = Math.max(
                  ...monthlyPnL.map((p) => Math.abs(p.pnl)),
                  1
                );
                const heightPct = m.pnl !== 0 ? (Math.abs(m.pnl) / maxPnL) * 100 : 0;
                return (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <div
                      className={cn(
                        "w-full max-w-[32px] rounded-t",
                        m.pnl > 0
                          ? "bg-[#00D68F]/70"
                          : m.pnl < 0
                          ? "bg-[#FF4D6A]/70"
                          : "bg-[#2A3040]"
                      )}
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    <span className="text-[10px] text-[#8892A6] mt-2">
                      {m.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-[#151921] border border-[#2A3040] rounded-xl p-6">
            <h3 className="text-sm font-semibold text-[#E8ECF4] mb-4">
              Recent Trades
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#8892A6] text-xs border-b border-[#2A3040]">
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Symbol</th>
                    <th className="text-left pb-3 font-medium">Side</th>
                    <th className="text-right pb-3 font-medium">P&L</th>
                    <th className="text-right pb-3 font-medium">R/R</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-b border-[#2A3040]/50 last:border-0"
                    >
                      <td className="py-2.5 text-[#8892A6] font-data text-xs">
                        {trade.tradeDate}
                      </td>
                      <td className="py-2.5 font-semibold text-[#E8ECF4]">
                        {trade.symbol}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            trade.direction === "LONG"
                              ? "text-[#00D68F] bg-[#00D68F]/10"
                              : "text-[#FF4D6A] bg-[#FF4D6A]/10"
                          )}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data font-semibold",
                          (trade.totalPnL ?? 0) >= 0
                            ? "text-[#00D68F]"
                            : "text-[#FF4D6A]"
                        )}
                      >
                        {(trade.totalPnL ?? 0) >= 0 ? "+" : ""}
                        {formatCurrency(trade.totalPnL ?? 0)}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 text-right font-data",
                          (trade.riskReward ?? 0) >= 0
                            ? "text-[#00D68F]"
                            : "text-[#FF4D6A]"
                        )}
                      >
                        {formatNumber(trade.riskReward ?? 0, 2)}R
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  subtext,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtext?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-[#151921] border border-[#2A3040] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#8892A6] font-medium">{label}</span>
        <div className="text-[#8892A6]">{icon}</div>
      </div>
      <p
        className={cn(
          "text-2xl font-bold font-data",
          valueColor ?? "text-[#E8ECF4]"
        )}
      >
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-[#8892A6] mt-1">{subtext}</p>
      )}
    </div>
  );
}
