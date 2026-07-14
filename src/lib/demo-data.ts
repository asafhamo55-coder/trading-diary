// Demo data for the application when no database is connected
// This allows the UI to render with realistic data

import { Trade, Account, MonthlyReview, ErrorDefinition } from "./types";

export const DEMO_ACCOUNT: Account = {
  id: "demo-account",
  userId: "demo-user",
  calendarYear: 2026,
  startingBalance: 178600,
  accountOpenBalance: 178600,
  commissionPerShare: 0.000068848354793,
  minimumCommission: 0,
};

export const DEMO_ERROR_DEFINITIONS: ErrorDefinition[] = [
  { id: "err1", accountId: "demo-account", name: "Early Entry", sortOrder: 1 },
  { id: "err2", accountId: "demo-account", name: "Late Exit", sortOrder: 2 },
  { id: "err3", accountId: "demo-account", name: "Position Too Large", sortOrder: 3 },
  { id: "err4", accountId: "demo-account", name: "No Stop Loss", sortOrder: 4 },
  { id: "err5", accountId: "demo-account", name: "FOMO Entry", sortOrder: 5 },
  { id: "err6", accountId: "demo-account", name: "Revenge Trade", sortOrder: 6 },
];

export const DEMO_TRADES: Trade[] = [
  {
    id: "t1", accountId: "demo-account", tradeDate: "2026-01-26", month: 1,
    symbol: "PG", direction: "LONG", tradeType: "Retest Long", isSwingContinuation: false, isAsset: false,
    entries: [
      { id: "l1", legType: "BUY", price: 148.87, quantity: 141, commission: 1.45, legOrder: 1, filledAt: "2026-01-26" },
      { id: "l2", legType: "SELL", price: 164.23, quantity: 70, commission: 0.79, legOrder: 1, filledAt: "2026-02-10" },
      { id: "l3", legType: "SELL", price: 155.00, quantity: 71, commission: 0.76, legOrder: 2, filledAt: "2026-02-12" },
    ],
    totalPositionValue: 20991, totalShares: 141, sharesInProcess: 0,
    avgBuyPrice: 148.87, avgSellPrice: 159.58, totalPnL: 1507.08, riskReward: null,
    returnOnPosition: 0.0718, riskAmount: null, totalCommissions: 3.00,
    isCompleted: true,
    entryReason: "Retest scenario",
    exitReason: "Sold 50%, securing part of the return (up to 10.5%)",
    conclusions: "Trade is currently working according to plan",
    chartUrl: "https://www.tradingview.com/x/FDdojBmh/",
    notes: null, dailyHigh: 150.88, dailyClose: 149.49,
    moneyLeftHighPct: null, moneyLeftClosePct: null,
    tradeErrors: [], createdAt: "2026-01-26", updatedAt: "2026-01-26",
  },
];

export const DEMO_MONTHLY_REVIEWS: MonthlyReview[] = [
  {
    id: "mr1", accountId: "demo-account", month: 1, year: 2026,
    portfolioStartValue: 178600, portfolioEndValue: 180103, riskUnit: null,
    goal1: null, goal2: null, goal3: null,
    goalsMet: null, monthlyConclusions: null, keyLessons: null,
    useFixedRiskUnit: false, includeOpenTrades: true,
  },
];

// Aggregate helper functions for demo data
export function getDemoTradesByMonth(month: number): Trade[] {
  return DEMO_TRADES.filter((t) => t.month === month);
}

export function getDemoMonthlyPnL(): { month: number; pnl: number; name: string; count: number }[] {
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Array.from({ length: 12 }, (_, i) => {
    const trades = getDemoTradesByMonth(i + 1);
    const pnl = trades.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
    return { month: i + 1, pnl, name: MONTH_NAMES[i], count: trades.length };
  });
}

export function getDemoEquityCurve(): { date: string; equity: number }[] {
  let equity = 178600;
  const points: { date: string; equity: number }[] = [{ date: "2026-01-01", equity }];

  const sortedTrades = [...DEMO_TRADES]
    .filter((t) => t.isCompleted)
    .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  for (const trade of sortedTrades) {
    equity += trade.totalPnL ?? 0;
    points.push({ date: trade.tradeDate, equity });
  }

  return points;
}

export function getDemoStats() {
  const completed = DEMO_TRADES.filter((t) => t.isCompleted);
  const winners = completed.filter((t) => (t.totalPnL ?? 0) > 0);
  const totalPnL = completed.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
  const currentPortfolio = 178600 + totalPnL;

  return {
    totalTrades: completed.length,
    openTrades: DEMO_TRADES.filter((t) => !t.isCompleted).length,
    winRate: completed.length > 0 ? winners.length / completed.length : 0,
    totalPnL,
    currentPortfolio,
    startingBalance: 178600,
    avgRR: completed.length > 0
      ? completed.reduce((s, t) => s + (t.riskReward ?? 0), 0) / completed.length
      : 0,
    profitFactor: (() => {
      const wins = winners.reduce((s, t) => s + (t.totalPnL ?? 0), 0);
      const losses = Math.abs(completed.filter((t) => (t.totalPnL ?? 0) < 0).reduce((s, t) => s + (t.totalPnL ?? 0), 0));
      return losses > 0 ? wins / losses : 0;
    })(),
    bestTrade: Math.max(...completed.map((t) => t.totalPnL ?? 0)),
    worstTrade: Math.min(...completed.map((t) => t.totalPnL ?? 0)),
    assets: { count: 0, totalPnL: 0, winRate: 0, profitFactor: 0 },
    stocks: { count: completed.length, totalPnL, winRate: completed.length > 0 ? winners.length / completed.length : 0, profitFactor: 0 },
  };
}
