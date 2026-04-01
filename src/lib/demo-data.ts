// Demo data for the application when no database is connected
// This allows the UI to render with realistic data

import { Trade, Account, MonthlyReview, ErrorDefinition } from "./types";

export const DEMO_ACCOUNT: Account = {
  id: "demo-account",
  userId: "demo-user",
  calendarYear: 2026,
  startingBalance: 178600,
  accountOpenBalance: 178600,
  commissionPerShare: 0.01,
  minimumCommission: 2.5,
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
    id: "t1", accountId: "demo-account", tradeDate: "2026-01-06", month: 1,
    symbol: "AAPL", direction: "LONG", tradeType: "Breakout", isSwingContinuation: false,
    entries: [
      { id: "l1", legType: "BUY", price: 198.50, quantity: 100, commission: 2.50, legOrder: 1 },
      { id: "l2", legType: "SELL", price: 205.20, quantity: 100, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 19850, totalShares: 100, sharesInProcess: 0,
    avgBuyPrice: 198.50, avgSellPrice: 205.20, totalPnL: 665, riskReward: 2.66,
    returnOnPosition: 0.0335, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Breakout above resistance with volume",
    exitReason: "Target reached at 2R", conclusions: "Good entry timing",
    chartUrl: null, notes: null, dailyHigh: 206.80, dailyClose: 205.50,
    moneyLeftHighPct: 0.0078, moneyLeftClosePct: 0.0015,
    tradeErrors: [], createdAt: "2026-01-06", updatedAt: "2026-01-06",
  },
  {
    id: "t2", accountId: "demo-account", tradeDate: "2026-01-08", month: 1,
    symbol: "TSLA", direction: "LONG", tradeType: "Momentum", isSwingContinuation: false,
    entries: [
      { id: "l3", legType: "BUY", price: 415.00, quantity: 50, commission: 2.50, legOrder: 1 },
      { id: "l4", legType: "SELL", price: 408.50, quantity: 50, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 20750, totalShares: 50, sharesInProcess: 0,
    avgBuyPrice: 415.00, avgSellPrice: 408.50, totalPnL: -330, riskReward: -1.32,
    returnOnPosition: -0.0157, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Momentum continuation after gap up",
    exitReason: "Stop loss hit", conclusions: "Should have waited for pullback",
    chartUrl: null, notes: null, dailyHigh: null, dailyClose: null,
    moneyLeftHighPct: null, moneyLeftClosePct: null,
    tradeErrors: [{ errorDefinition: { id: "err1", name: "Early Entry" } }],
    createdAt: "2026-01-08", updatedAt: "2026-01-08",
  },
  {
    id: "t3", accountId: "demo-account", tradeDate: "2026-01-13", month: 1,
    symbol: "NVDA", direction: "LONG", tradeType: "Retest Long", isSwingContinuation: false,
    entries: [
      { id: "l5", legType: "BUY", price: 142.30, quantity: 150, commission: 2.50, legOrder: 1 },
      { id: "l6", legType: "BUY", price: 141.80, quantity: 100, commission: 2.50, legOrder: 2 },
      { id: "l7", legType: "SELL", price: 148.90, quantity: 250, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 35545, totalShares: 250, sharesInProcess: 0,
    avgBuyPrice: 142.10, avgSellPrice: 148.90, totalPnL: 1692.50, riskReward: 6.77,
    returnOnPosition: 0.0476, riskAmount: 250, totalCommissions: 7.50,
    isCompleted: true, entryReason: "Retest of breakout level with support",
    exitReason: "Extended move, took profit", conclusions: "Multi-leg entry worked well",
    chartUrl: null, notes: null, dailyHigh: 151.20, dailyClose: 149.80,
    moneyLeftHighPct: 0.0154, moneyLeftClosePct: 0.006,
    tradeErrors: [], createdAt: "2026-01-13", updatedAt: "2026-01-13",
  },
  {
    id: "t4", accountId: "demo-account", tradeDate: "2026-01-15", month: 1,
    symbol: "META", direction: "SHORT", tradeType: "Reversal", isSwingContinuation: false,
    entries: [
      { id: "l8", legType: "SELL", price: 612.40, quantity: 30, commission: 2.50, legOrder: 1 },
      { id: "l9", legType: "BUY", price: 598.70, quantity: 30, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 18372, totalShares: 30, sharesInProcess: 0,
    avgBuyPrice: 598.70, avgSellPrice: 612.40, totalPnL: 406, riskReward: 1.62,
    returnOnPosition: 0.0221, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Rejection at resistance",
    exitReason: "Cover at support", conclusions: "Clean short setup",
    chartUrl: null, notes: null, dailyHigh: null, dailyClose: null,
    moneyLeftHighPct: null, moneyLeftClosePct: null,
    tradeErrors: [], createdAt: "2026-01-15", updatedAt: "2026-01-15",
  },
  {
    id: "t5", accountId: "demo-account", tradeDate: "2026-01-20", month: 1,
    symbol: "AMZN", direction: "LONG", tradeType: "Earnings", isSwingContinuation: false,
    entries: [
      { id: "l10", legType: "BUY", price: 225.80, quantity: 80, commission: 2.50, legOrder: 1 },
      { id: "l11", legType: "SELL", price: 231.40, quantity: 80, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 18064, totalShares: 80, sharesInProcess: 0,
    avgBuyPrice: 225.80, avgSellPrice: 231.40, totalPnL: 443, riskReward: 1.77,
    returnOnPosition: 0.0248, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Pre-earnings positioning",
    exitReason: "Target reached", conclusions: "Good risk management on earnings play",
    chartUrl: null, notes: null, dailyHigh: 233.10, dailyClose: 231.90,
    moneyLeftHighPct: 0.0073, moneyLeftClosePct: 0.0022,
    tradeErrors: [], createdAt: "2026-01-20", updatedAt: "2026-01-20",
  },
  {
    id: "t6", accountId: "demo-account", tradeDate: "2026-02-03", month: 2,
    symbol: "MSFT", direction: "LONG", tradeType: "Breakout", isSwingContinuation: false,
    entries: [
      { id: "l12", legType: "BUY", price: 445.20, quantity: 40, commission: 2.50, legOrder: 1 },
      { id: "l13", legType: "SELL", price: 456.80, quantity: 40, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 17808, totalShares: 40, sharesInProcess: 0,
    avgBuyPrice: 445.20, avgSellPrice: 456.80, totalPnL: 459, riskReward: 1.84,
    returnOnPosition: 0.026, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Breakout above consolidation",
    exitReason: "Hit profit target", conclusions: null,
    chartUrl: null, notes: null, dailyHigh: 458.30, dailyClose: 457.10,
    moneyLeftHighPct: 0.0033, moneyLeftClosePct: 0.0007,
    tradeErrors: [], createdAt: "2026-02-03", updatedAt: "2026-02-03",
  },
  {
    id: "t7", accountId: "demo-account", tradeDate: "2026-02-10", month: 2,
    symbol: "GOOGL", direction: "LONG", tradeType: "Retest Long", isSwingContinuation: false,
    entries: [
      { id: "l14", legType: "BUY", price: 192.60, quantity: 120, commission: 2.50, legOrder: 1 },
      { id: "l15", legType: "SELL", price: 188.30, quantity: 120, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 23112, totalShares: 120, sharesInProcess: 0,
    avgBuyPrice: 192.60, avgSellPrice: 188.30, totalPnL: -521, riskReward: -2.08,
    returnOnPosition: -0.0223, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Retest of support",
    exitReason: "Support broke", conclusions: "Should have reduced size on weak setup",
    chartUrl: null, notes: null, dailyHigh: null, dailyClose: null,
    moneyLeftHighPct: null, moneyLeftClosePct: null,
    tradeErrors: [{ errorDefinition: { id: "err3", name: "Position Too Large" } }],
    createdAt: "2026-02-10", updatedAt: "2026-02-10",
  },
  {
    id: "t8", accountId: "demo-account", tradeDate: "2026-02-14", month: 2,
    symbol: "AMD", direction: "SHORT", tradeType: "Reversal", isSwingContinuation: false,
    entries: [
      { id: "l16", legType: "SELL", price: 178.90, quantity: 100, commission: 2.50, legOrder: 1 },
      { id: "l17", legType: "BUY", price: 172.40, quantity: 100, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 17890, totalShares: 100, sharesInProcess: 0,
    avgBuyPrice: 172.40, avgSellPrice: 178.90, totalPnL: 645, riskReward: 2.58,
    returnOnPosition: 0.0363, riskAmount: 250, totalCommissions: 5,
    isCompleted: true, entryReason: "Failed breakout reversal",
    exitReason: "Covered at support level", conclusions: "Patience paid off",
    chartUrl: null, notes: null, dailyHigh: null, dailyClose: null,
    moneyLeftHighPct: null, moneyLeftClosePct: null,
    tradeErrors: [], createdAt: "2026-02-14", updatedAt: "2026-02-14",
  },
  {
    id: "t9", accountId: "demo-account", tradeDate: "2026-03-02", month: 3,
    symbol: "PG", direction: "LONG", tradeType: "Swing", isSwingContinuation: false,
    entries: [
      { id: "l18", legType: "BUY", price: 172.30, quantity: 100, commission: 2.50, legOrder: 1 },
    ],
    totalPositionValue: 17230, totalShares: 100, sharesInProcess: 100,
    avgBuyPrice: 172.30, avgSellPrice: 0, totalPnL: 0, riskReward: 0,
    returnOnPosition: 0, riskAmount: 250, totalCommissions: 2.50,
    isCompleted: false, entryReason: "Swing setup on weekly support",
    exitReason: null, conclusions: null,
    chartUrl: null, notes: "Open swing position",
    dailyHigh: null, dailyClose: null,
    moneyLeftHighPct: null, moneyLeftClosePct: null,
    tradeErrors: [], createdAt: "2026-03-02", updatedAt: "2026-03-02",
  },
  {
    id: "t10", accountId: "demo-account", tradeDate: "2026-03-05", month: 3,
    symbol: "BKE", direction: "LONG", tradeType: "Breakout", isSwingContinuation: false,
    entries: [
      { id: "l19", legType: "BUY", price: 58.40, quantity: 300, commission: 3.00, legOrder: 1 },
      { id: "l20", legType: "SELL", price: 62.10, quantity: 200, commission: 2.50, legOrder: 1 },
      { id: "l21", legType: "SELL", price: 63.50, quantity: 100, commission: 2.50, legOrder: 2 },
    ],
    totalPositionValue: 17520, totalShares: 300, sharesInProcess: 0,
    avgBuyPrice: 58.40, avgSellPrice: 62.57, totalPnL: 1243, riskReward: 4.97,
    returnOnPosition: 0.0714, riskAmount: 250, totalCommissions: 8,
    isCompleted: true, entryReason: "Breakout with high relative volume",
    exitReason: "Scaled out in 2 sells", conclusions: "Scaling out worked well",
    chartUrl: null, notes: null, dailyHigh: 64.20, dailyClose: 63.80,
    moneyLeftHighPct: 0.026, moneyLeftClosePct: 0.0197,
    tradeErrors: [], createdAt: "2026-03-05", updatedAt: "2026-03-05",
  },
];

export const DEMO_MONTHLY_REVIEWS: MonthlyReview[] = [
  {
    id: "mr1", accountId: "demo-account", month: 1, year: 2026,
    portfolioStartValue: 178600, portfolioEndValue: 181476.50, riskUnit: 250,
    goal1: "Maintain 1R risk per trade", goal2: "Journal every trade", goal3: "Focus on A+ setups",
    goalsMet: "Met goals 1 and 2, struggled with patience on setups",
    monthlyConclusions: "Strong start to the year with disciplined entries",
    keyLessons: "Multi-leg entries improve average price significantly",
    useFixedRiskUnit: false, includeOpenTrades: true,
  },
  {
    id: "mr2", accountId: "demo-account", month: 2, year: 2026,
    portfolioStartValue: 181476.50, portfolioEndValue: 182059.50, riskUnit: 250,
    goal1: "Reduce position sizes on weak setups", goal2: "Improve short entries", goal3: null,
    goalsMet: null, monthlyConclusions: null, keyLessons: null,
    useFixedRiskUnit: false, includeOpenTrades: true,
  },
  {
    id: "mr3", accountId: "demo-account", month: 3, year: 2026,
    portfolioStartValue: 182059.50, portfolioEndValue: null, riskUnit: 250,
    goal1: "Master scaling out technique", goal2: null, goal3: null,
    goalsMet: null, monthlyConclusions: null, keyLessons: null,
    useFixedRiskUnit: false, includeOpenTrades: true,
  },
];

// Aggregate helper functions for demo data
export function getDemoTradesByMonth(month: number): Trade[] {
  return DEMO_TRADES.filter((t) => t.month === month);
}

export function getDemoMonthlyPnL(): { month: number; pnl: number; name: string }[] {
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return Array.from({ length: 12 }, (_, i) => {
    const trades = getDemoTradesByMonth(i + 1);
    const pnl = trades.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
    return { month: i + 1, pnl, name: MONTH_NAMES[i] };
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
  };
}
