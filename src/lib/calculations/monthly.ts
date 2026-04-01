// Monthly analytics calculation functions

interface TradeForAnalytics {
  direction: "LONG" | "SHORT";
  tradeType: string | null;
  totalPnL: number | null;
  returnOnPosition: number | null;
  riskReward: number | null;
  totalPositionValue: number | null;
  isCompleted: boolean;
  tradeDate: Date;
  tradeErrors: { errorDefinition: { id: string; name: string } }[];
}

export interface DirectionStats {
  tradeCount: number;
  totalPnL: number;
  avgPnLPerTrade: number;
  avgReturnOnPosition: number;
  avgRiskReward: number;
  winRate: number;
  profitFactor: number;
}

export interface WinLossDirectionStats {
  count: number;
  totalPnL: number;
  avgPnL: number;
  avgReturn: number;
  avgRR: number;
}

export interface StrategyStats {
  strategy: string;
  tradeCount: number;
  totalPnL: number;
  avgPnL: number;
  winRate: number;
  avgRR: number;
}

export interface ErrorStats {
  errorName: string;
  errorId: string;
  count: number;
  totalPnLImpact: number;
}

export interface MonthlyAnalytics {
  overall: DirectionStats;
  long: DirectionStats;
  short: DirectionStats;
  winners: { overall: WinLossDirectionStats; long: WinLossDirectionStats; short: WinLossDirectionStats };
  losers: { overall: WinLossDirectionStats; long: WinLossDirectionStats; short: WinLossDirectionStats };
  tradingDays: number;
  avgTradesPerDay: number;
  top3Winners: number[];
  top3Losers: number[];
  byStrategy: StrategyStats[];
  errorBreakdown: ErrorStats[];
  moneyLeftOnTable: { avgHighPct: number; avgClosePct: number };
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function calcDirectionStats(trades: TradeForAnalytics[]): DirectionStats {
  const completed = trades.filter((t) => t.isCompleted && t.totalPnL !== null);
  const pnls = completed.map((t) => t.totalPnL!);
  const winners = pnls.filter((p) => p > 0);
  const losers = pnls.filter((p) => p < 0);
  const totalWins = winners.reduce((a, b) => a + b, 0);
  const totalLosses = Math.abs(losers.reduce((a, b) => a + b, 0));

  return {
    tradeCount: completed.length,
    totalPnL: pnls.reduce((a, b) => a + b, 0),
    avgPnLPerTrade: avg(pnls),
    avgReturnOnPosition: avg(completed.filter((t) => t.returnOnPosition !== null).map((t) => t.returnOnPosition!)),
    avgRiskReward: avg(completed.filter((t) => t.riskReward !== null).map((t) => t.riskReward!)),
    winRate: completed.length > 0 ? winners.length / completed.length : 0,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
  };
}

function calcWinLossStats(trades: TradeForAnalytics[], isWin: boolean): WinLossDirectionStats {
  const filtered = trades.filter((t) => t.isCompleted && t.totalPnL !== null && (isWin ? t.totalPnL! > 0 : t.totalPnL! < 0));
  const pnls = filtered.map((t) => t.totalPnL!);
  return {
    count: filtered.length,
    totalPnL: pnls.reduce((a, b) => a + b, 0),
    avgPnL: avg(pnls),
    avgReturn: avg(filtered.filter((t) => t.returnOnPosition !== null).map((t) => t.returnOnPosition!)),
    avgRR: avg(filtered.filter((t) => t.riskReward !== null).map((t) => t.riskReward!)),
  };
}

export function calculateMonthlyAnalytics(trades: TradeForAnalytics[]): MonthlyAnalytics {
  const longTrades = trades.filter((t) => t.direction === "LONG");
  const shortTrades = trades.filter((t) => t.direction === "SHORT");

  const completedPnls = trades
    .filter((t) => t.isCompleted && t.totalPnL !== null)
    .map((t) => t.totalPnL!)
    .sort((a, b) => b - a);

  const uniqueDays = new Set(trades.map((t) => new Date(t.tradeDate).toDateString())).size;

  // Strategy analysis
  const strategyMap = new Map<string, TradeForAnalytics[]>();
  trades.forEach((t) => {
    const key = t.tradeType || "Unclassified";
    if (!strategyMap.has(key)) strategyMap.set(key, []);
    strategyMap.get(key)!.push(t);
  });

  const byStrategy: StrategyStats[] = Array.from(strategyMap.entries()).map(([strategy, stratTrades]) => {
    const completed = stratTrades.filter((t) => t.isCompleted && t.totalPnL !== null);
    const pnls = completed.map((t) => t.totalPnL!);
    const winners = pnls.filter((p) => p > 0);
    return {
      strategy,
      tradeCount: completed.length,
      totalPnL: pnls.reduce((a, b) => a + b, 0),
      avgPnL: avg(pnls),
      winRate: completed.length > 0 ? winners.length / completed.length : 0,
      avgRR: avg(completed.filter((t) => t.riskReward !== null).map((t) => t.riskReward!)),
    };
  });

  // Error breakdown
  const errorMap = new Map<string, { name: string; count: number; totalPnL: number }>();
  trades.forEach((t) => {
    t.tradeErrors.forEach((te) => {
      const key = te.errorDefinition.id;
      if (!errorMap.has(key)) {
        errorMap.set(key, { name: te.errorDefinition.name, count: 0, totalPnL: 0 });
      }
      const entry = errorMap.get(key)!;
      entry.count++;
      entry.totalPnL += t.totalPnL ?? 0;
    });
  });

  const errorBreakdown: ErrorStats[] = Array.from(errorMap.entries()).map(([id, data]) => ({
    errorName: data.name,
    errorId: id,
    count: data.count,
    totalPnLImpact: data.totalPnL,
  }));

  return {
    overall: calcDirectionStats(trades),
    long: calcDirectionStats(longTrades),
    short: calcDirectionStats(shortTrades),
    winners: {
      overall: calcWinLossStats(trades, true),
      long: calcWinLossStats(longTrades, true),
      short: calcWinLossStats(shortTrades, true),
    },
    losers: {
      overall: calcWinLossStats(trades, false),
      long: calcWinLossStats(longTrades, false),
      short: calcWinLossStats(shortTrades, false),
    },
    tradingDays: uniqueDays,
    avgTradesPerDay: uniqueDays > 0 ? trades.length / uniqueDays : 0,
    top3Winners: completedPnls.slice(0, 3),
    top3Losers: completedPnls.slice(-3).reverse(),
    byStrategy,
    errorBreakdown,
    moneyLeftOnTable: { avgHighPct: 0, avgClosePct: 0 },
  };
}
