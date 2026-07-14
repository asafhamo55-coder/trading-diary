// Shared types used across the application

export type Direction = "LONG" | "SHORT";
export type LegType = "BUY" | "SELL";

export interface TradeLeg {
  id: string;
  legType: LegType;
  price: number;
  quantity: number;
  commission: number;
  legOrder: number;
  filledAt: string | null;
}

export interface Trade {
  id: string;
  accountId: string;
  tradeDate: string;
  month: number;
  symbol: string;
  direction: Direction;
  tradeType: string | null;
  isSwingContinuation: boolean;
  isAsset: boolean;
  entries: TradeLeg[];
  totalPositionValue: number | null;
  totalShares: number | null;
  sharesInProcess: number | null;
  avgBuyPrice: number | null;
  avgSellPrice: number | null;
  totalPnL: number | null;
  riskReward: number | null;
  returnOnPosition: number | null;
  riskAmount: number | null;
  totalCommissions: number | null;
  isCompleted: boolean;
  entryReason: string | null;
  exitReason: string | null;
  conclusions: string | null;
  chartUrl: string | null;
  notes: string | null;
  dailyHigh: number | null;
  dailyClose: number | null;
  moneyLeftHighPct: number | null;
  moneyLeftClosePct: number | null;
  tradeErrors: { errorDefinition: { id: string; name: string } }[];
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  calendarYear: number;
  startingBalance: number;
  accountOpenBalance: number;
  commissionPerShare: number;
  minimumCommission: number;
}

export interface MonthlyReview {
  id: string;
  accountId: string;
  month: number;
  year: number;
  portfolioStartValue: number | null;
  portfolioEndValue: number | null;
  riskUnit: number | null;
  goal1: string | null;
  goal2: string | null;
  goal3: string | null;
  goalsMet: string | null;
  monthlyConclusions: string | null;
  keyLessons: string | null;
  useFixedRiskUnit: boolean;
  includeOpenTrades: boolean;
}

export interface ErrorDefinition {
  id: string;
  accountId: string;
  name: string;
  sortOrder: number;
}

export interface AssetLeverage {
  id: string;
  accountId: string;
  symbol: string;
  leverage: number;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const TRADE_TYPES = [
  "Retest Long",
  "Retest Short",
  "Breakout",
  "Earnings",
  "Gap Fill",
  "Momentum",
  "Reversal",
  "Swing",
  "Scalp",
  "Other",
] as const;
