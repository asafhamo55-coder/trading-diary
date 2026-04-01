// Portfolio tracking calculations

interface MonthTradeData {
  totalPnL: number | null;
  riskReward: number | null;
  isCompleted: boolean;
  tradeDate: Date;
}

export interface MonthPortfolio {
  month: number;
  monthName: string;
  tradeCount: number;
  openPositions: number;
  avgWinnerPnL: number;
  avgWinnerRR: number;
  avgLoserPnL: number;
  avgLoserRR: number;
  cumulativeRiskUnits: number;
  bigWinnersAbove10R: number;
  deviationsAbove2R: number;
  avgTradesPerDay: number;
  portfolioStart: number;
  monthlyPnL: number;
  portfolioEnd: number;
  monthlyReturnPct: number;
  cumulativePnLFromStart: number;
  cumulativeReturnPct: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function calculatePortfolioTracker(
  tradesByMonth: Map<number, MonthTradeData[]>,
  startingBalance: number,
  riskUnits: Map<number, number>
): MonthPortfolio[] {
  const months: MonthPortfolio[] = [];
  let runningBalance = startingBalance;
  let cumulativePnL = 0;

  for (let m = 1; m <= 12; m++) {
    const trades = tradesByMonth.get(m) || [];
    const completed = trades.filter((t) => t.isCompleted && t.totalPnL !== null);
    const open = trades.filter((t) => !t.isCompleted);

    const pnls = completed.map((t) => t.totalPnL!);
    const winnerPnls = pnls.filter((p) => p > 0);
    const loserPnls = pnls.filter((p) => p < 0);

    const rrs = completed.filter((t) => t.riskReward !== null).map((t) => t.riskReward!);
    const winnerRRs = rrs.filter((r) => r > 0);
    const loserRRs = rrs.filter((r) => r < 0);

    const monthlyPnL = pnls.reduce((a, b) => a + b, 0);
    const portfolioStart = runningBalance;

    const uniqueDays = new Set(trades.map((t) => new Date(t.tradeDate).toDateString())).size;
    const riskUnit = riskUnits.get(m) ?? 0;

    cumulativePnL += monthlyPnL;
    runningBalance += monthlyPnL;

    months.push({
      month: m,
      monthName: MONTH_NAMES[m - 1],
      tradeCount: trades.length,
      openPositions: open.length,
      avgWinnerPnL: avg(winnerPnls),
      avgWinnerRR: avg(winnerRRs),
      avgLoserPnL: avg(loserPnls),
      avgLoserRR: avg(loserRRs),
      cumulativeRiskUnits: riskUnit > 0 ? monthlyPnL / riskUnit : 0,
      bigWinnersAbove10R: rrs.filter((r) => r >= 10).length,
      deviationsAbove2R: loserRRs.filter((r) => Math.abs(r) > 2).length,
      avgTradesPerDay: uniqueDays > 0 ? trades.length / uniqueDays : 0,
      portfolioStart,
      monthlyPnL,
      portfolioEnd: runningBalance,
      monthlyReturnPct: portfolioStart > 0 ? monthlyPnL / portfolioStart : 0,
      cumulativePnLFromStart: cumulativePnL,
      cumulativeReturnPct: startingBalance > 0 ? cumulativePnL / startingBalance : 0,
    });
  }

  return months;
}
