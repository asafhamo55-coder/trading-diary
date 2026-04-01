// Trade-level calculation functions

export interface TradeLegData {
  legType: "BUY" | "SELL";
  price: number;
  quantity: number;
  commission: number;
  legOrder: number;
}

export interface TradeData {
  direction: "LONG" | "SHORT";
  symbol: string;
  entries: TradeLegData[];
  leverage?: number;
  dailyHigh?: number | null;
  dailyClose?: number | null;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function weightedAverage(prices: number[], quantities: number[]): number {
  const totalQty = sum(quantities);
  if (totalQty === 0) return 0;
  const totalValue = prices.reduce((acc, price, i) => acc + price * quantities[i], 0);
  return totalValue / totalQty;
}

export function calculateCommission(qty: number, commPerShare: number, minComm: number): number {
  if (qty === 0) return 0;
  return Math.max(qty * commPerShare, minComm);
}

export function getBuyLegs(entries: TradeLegData[]): TradeLegData[] {
  return entries.filter((l) => l.legType === "BUY").sort((a, b) => a.legOrder - b.legOrder);
}

export function getSellLegs(entries: TradeLegData[]): TradeLegData[] {
  return entries.filter((l) => l.legType === "SELL").sort((a, b) => a.legOrder - b.legOrder);
}

export function getTotalBuyQty(entries: TradeLegData[]): number {
  return sum(getBuyLegs(entries).map((l) => l.quantity));
}

export function getTotalSellQty(entries: TradeLegData[]): number {
  return sum(getSellLegs(entries).map((l) => l.quantity));
}

export function getTotalShares(entries: TradeLegData[]): number {
  return Math.max(getTotalBuyQty(entries), getTotalSellQty(entries));
}

export function getSharesInProcess(entries: TradeLegData[]): number {
  return Math.abs(getTotalBuyQty(entries) - getTotalSellQty(entries));
}

export function getAvgBuyPrice(entries: TradeLegData[]): number {
  const buys = getBuyLegs(entries);
  return weightedAverage(buys.map((l) => l.price), buys.map((l) => l.quantity));
}

export function getAvgSellPrice(entries: TradeLegData[]): number {
  const sells = getSellLegs(entries);
  return weightedAverage(sells.map((l) => l.price), sells.map((l) => l.quantity));
}

export function calculateTotalCommissions(entries: TradeLegData[]): number {
  return sum(entries.map((l) => l.commission));
}

export function calculatePositionValue(trade: TradeData): number {
  const leverage = trade.leverage ?? 1;
  const totalShares = getTotalShares(trade.entries);
  if (trade.direction === "LONG") {
    return getAvgBuyPrice(trade.entries) * totalShares * leverage;
  }
  return getAvgSellPrice(trade.entries) * totalShares * leverage;
}

export function calculatePnL(trade: TradeData): number {
  const buyLegs = getBuyLegs(trade.entries);
  const sellLegs = getSellLegs(trade.entries);

  const totalBuyQty = sum(buyLegs.map((l) => l.quantity));
  const totalSellQty = sum(sellLegs.map((l) => l.quantity));
  const closedQty = Math.min(totalBuyQty, totalSellQty);

  if (closedQty === 0) return 0;

  const avgBuy = weightedAverage(buyLegs.map((l) => l.price), buyLegs.map((l) => l.quantity));
  const avgSell = weightedAverage(sellLegs.map((l) => l.price), sellLegs.map((l) => l.quantity));

  const leverage = trade.leverage ?? 1;
  const totalComm = calculateTotalCommissions(trade.entries);

  const direction = trade.direction === "LONG" ? 1 : -1;
  return direction * (avgSell - avgBuy) * closedQty * leverage - totalComm;
}

export function calculateRiskReward(pnl: number, riskUnit: number): number {
  return riskUnit > 0 ? pnl / riskUnit : 0;
}

export function calculateReturnOnPosition(pnl: number, positionValue: number): number {
  return positionValue > 0 ? pnl / positionValue : 0;
}

export function calculateMoneyLeftOnTable(
  avgSellPrice: number,
  dailyHigh: number | null | undefined,
  dailyClose: number | null | undefined
): { highPct: number | null; closePct: number | null } {
  if (!dailyHigh || !dailyClose || avgSellPrice === 0) {
    return { highPct: null, closePct: null };
  }
  return {
    highPct: (dailyHigh - avgSellPrice) / avgSellPrice,
    closePct: (dailyClose - avgSellPrice) / avgSellPrice,
  };
}

export function isTradeCompleted(entries: TradeLegData[]): boolean {
  const buyQty = getTotalBuyQty(entries);
  const sellQty = getTotalSellQty(entries);
  return buyQty > 0 && sellQty > 0 && buyQty === sellQty;
}

export function computeAllTradeFields(trade: TradeData, riskUnit: number = 0) {
  const pnl = calculatePnL(trade);
  const positionValue = calculatePositionValue(trade);
  const avgSell = getAvgSellPrice(trade.entries);
  const moneyLeft = trade.direction === "LONG"
    ? calculateMoneyLeftOnTable(avgSell, trade.dailyHigh, trade.dailyClose)
    : { highPct: null, closePct: null };

  return {
    totalShares: getTotalShares(trade.entries),
    sharesInProcess: getSharesInProcess(trade.entries),
    avgBuyPrice: getAvgBuyPrice(trade.entries),
    avgSellPrice: avgSell,
    totalPositionValue: positionValue,
    totalPnL: pnl,
    riskReward: calculateRiskReward(pnl, riskUnit),
    returnOnPosition: calculateReturnOnPosition(pnl, positionValue),
    totalCommissions: calculateTotalCommissions(trade.entries),
    riskAmount: riskUnit,
    isCompleted: isTradeCompleted(trade.entries),
    moneyLeftHighPct: moneyLeft.highPct,
    moneyLeftClosePct: moneyLeft.closePct,
  };
}
