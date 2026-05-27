// Server-side data fetching functions that query Supabase directly via Prisma
// Used by page components to get real data

import { prisma } from "./db";
import { tradeDateYearFilter } from "./year";
import { DEMO_TRADES, DEMO_ACCOUNT, DEMO_MONTHLY_REVIEWS, DEMO_ERROR_DEFINITIONS, getDemoStats, getDemoMonthlyPnL, getDemoEquityCurve } from "./demo-data";

// Fallback flag — if DB is not connected, use demo data
async function isDbConnected(): Promise<boolean> {
  try {
    await prisma.account.findFirst();
    return true;
  } catch {
    return false;
  }
}

export async function getAccount() {
  try {
    const account = await prisma.account.findFirst({
      include: { assetLeverages: true },
    });
    if (account) return account;
  } catch {}
  return DEMO_ACCOUNT;
}

export async function getAllTrades(filters?: { month?: number; direction?: string; symbol?: string; year?: number | null }) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_TRADES;

    const where: Record<string, unknown> = { accountId: account.id };
    if (filters?.month) where.month = filters.month;
    if (filters?.direction) where.direction = filters.direction;
    if (filters?.symbol) where.symbol = { contains: filters.symbol, mode: "insensitive" };
    const dateFilter = tradeDateYearFilter(filters?.year ?? undefined);
    if (dateFilter) where.tradeDate = dateFilter;

    const trades = await prisma.trade.findMany({
      where,
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
      orderBy: { tradeDate: "desc" },
    });

    return trades.map(serializeTrade);
  } catch {
    return DEMO_TRADES;
  }
}

export async function getTradeById(id: string) {
  try {
    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
    });
    if (trade) return serializeTrade(trade);
  } catch {}
  return DEMO_TRADES.find((t) => t.id === id) || null;
}

export async function getTradesByMonth(month: number, year?: number | null) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_TRADES.filter((t) => t.month === month);

    const where: Record<string, unknown> = { accountId: account.id, month };
    const dateFilter = tradeDateYearFilter(year ?? undefined);
    if (dateFilter) where.tradeDate = dateFilter;
    const trades = await prisma.trade.findMany({
      where,
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
      orderBy: { tradeDate: "asc" },
    });

    return trades.map(serializeTrade);
  } catch {
    return DEMO_TRADES.filter((t) => t.month === month);
  }
}

export async function getMonthlyReviews() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_MONTHLY_REVIEWS;

    const reviews = await prisma.monthlyReview.findMany({
      where: { accountId: account.id },
      orderBy: { month: "asc" },
    });

    return reviews.map(serializeReview);
  } catch {
    return DEMO_MONTHLY_REVIEWS;
  }
}

export async function getMonthlyReview(month: number) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_MONTHLY_REVIEWS.find((r) => r.month === month) || null;

    const review = await prisma.monthlyReview.findFirst({
      where: { accountId: account.id, month },
    });

    return review ? serializeReview(review) : null;
  } catch {
    return DEMO_MONTHLY_REVIEWS.find((r) => r.month === month) || null;
  }
}

export async function getErrorDefinitions() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_ERROR_DEFINITIONS;

    const errors = await prisma.errorDefinition.findMany({
      where: { accountId: account.id },
      include: {
        tradeErrors: {
          include: { trade: { select: { totalPnL: true } } },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return errors.map((e) => ({
      id: e.id,
      accountId: e.accountId,
      name: e.name,
      sortOrder: e.sortOrder,
      tradeCount: e.tradeErrors.length,
      totalPnLImpact: e.tradeErrors.reduce((sum, te) => sum + (te.trade.totalPnL ?? 0), 0),
    }));
  } catch {
    return DEMO_ERROR_DEFINITIONS;
  }
}

// A trade contributes realized P&L when at least one share has been closed
// (partial-exit open trades count too).
function hasRealizedPnL(t: {
  isCompleted: boolean;
  totalShares: number | null;
  sharesInProcess: number | null;
}): boolean {
  if (t.isCompleted) return true;
  const total = t.totalShares ?? 0;
  const open = t.sharesInProcess ?? 0;
  return total > 0 && open < total;
}

export async function getDashboardStats(year?: number | null) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return getDemoStats();

    const where: Record<string, unknown> = { accountId: account.id };
    const dateFilter = tradeDateYearFilter(year ?? undefined);
    if (dateFilter) where.tradeDate = dateFilter;
    const trades = await prisma.trade.findMany({
      where,
      select: {
        totalPnL: true,
        riskReward: true,
        isCompleted: true,
        isAsset: true,
        totalShares: true,
        sharesInProcess: true,
        month: true,
        tradeDate: true,
        direction: true,
        symbol: true,
      },
    });

    const realized = trades.filter(
      (t) => hasRealizedPnL(t) && t.totalPnL !== null
    );
    const winners = realized.filter((t) => t.totalPnL! > 0);
    const totalPnL = realized.reduce((s, t) => s + t.totalPnL!, 0);
    const currentPortfolio = account.startingBalance + totalPnL;
    const wins = winners.reduce((s, t) => s + t.totalPnL!, 0);
    const losses = Math.abs(
      realized.filter((t) => t.totalPnL! < 0).reduce((s, t) => s + t.totalPnL!, 0)
    );

    // Per-segment slice (assets vs stocks)
    function segmentStats(filtered: typeof realized) {
      const ws = filtered.filter((t) => t.totalPnL! > 0);
      const ls = filtered.filter((t) => t.totalPnL! < 0);
      const segPnL = filtered.reduce((s, t) => s + t.totalPnL!, 0);
      const segWins = ws.reduce((s, t) => s + t.totalPnL!, 0);
      const segLosses = Math.abs(ls.reduce((s, t) => s + t.totalPnL!, 0));
      return {
        count: filtered.length,
        totalPnL: segPnL,
        winRate: filtered.length > 0 ? ws.length / filtered.length : 0,
        profitFactor: segLosses > 0 ? segWins / segLosses : 0,
      };
    }

    return {
      totalTrades: realized.length,
      openTrades: trades.filter((t) => !t.isCompleted).length,
      winRate: realized.length > 0 ? winners.length / realized.length : 0,
      totalPnL,
      currentPortfolio,
      startingBalance: account.startingBalance,
      avgRR:
        realized.length > 0
          ? realized.reduce((s, t) => s + (t.riskReward ?? 0), 0) /
            realized.length
          : 0,
      profitFactor: losses > 0 ? wins / losses : 0,
      bestTrade:
        realized.length > 0 ? Math.max(...realized.map((t) => t.totalPnL!)) : 0,
      worstTrade:
        realized.length > 0 ? Math.min(...realized.map((t) => t.totalPnL!)) : 0,
      assets: segmentStats(realized.filter((t) => t.isAsset)),
      stocks: segmentStats(realized.filter((t) => !t.isAsset)),
    };
  } catch {
    return getDemoStats();
  }
}

export async function getMonthlyPnL(year?: number | null) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return getDemoMonthlyPnL();

    const where: Record<string, unknown> = { accountId: account.id };
    const dateFilter = tradeDateYearFilter(year ?? undefined);
    if (dateFilter) where.tradeDate = dateFilter;
    const trades = await prisma.trade.findMany({
      where,
      select: {
        month: true,
        totalPnL: true,
        isCompleted: true,
        totalShares: true,
        sharesInProcess: true,
      },
    });
    const realized = trades.filter(hasRealizedPnL);

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: 12 }, (_, i) => {
      const monthTrades = realized.filter((t) => t.month === i + 1);
      const pnl = monthTrades.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
      return { month: i + 1, pnl, name: MONTH_NAMES[i], count: monthTrades.length };
    });
  } catch {
    return getDemoMonthlyPnL();
  }
}

export async function getRecentTrades(limit = 5, year?: number | null) {
  try {
    const account = await prisma.account.findFirst();
    if (!account)
      return DEMO_TRADES.filter((t) => t.isCompleted).slice(0, limit);

    const where: Record<string, unknown> = { accountId: account.id };
    const dateFilter = tradeDateYearFilter(year ?? undefined);
    if (dateFilter) where.tradeDate = dateFilter;
    // Include partial-exit open trades — they have realized P&L too.
    const trades = await prisma.trade.findMany({
      where,
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
      orderBy: { tradeDate: "desc" },
      take: limit * 4, // fetch extra, then filter
    });

    const realized = trades.filter(hasRealizedPnL).slice(0, limit);
    return realized.map(serializeTrade);
  } catch {
    return DEMO_TRADES.filter((t) => t.isCompleted).slice(0, limit);
  }
}

export interface DashboardInsights {
  equityCurve: { date: string; cumulative: number; pnl: number; symbol: string }[];
  drawdown: {
    maxDrawdown: number;
    maxDrawdownPct: number;
    currentDrawdown: number;
    longestLossStreak: number;
  };
  expectancy: {
    expectancy: number;
    avgWinner: number;
    avgLoser: number;
    winRate: number;
    lossRate: number;
    winnerCount: number;
    loserCount: number;
  };
  byStrategy: {
    tradeType: string;
    count: number;
    totalPnL: number;
    winRate: number;
    avgRR: number;
  }[];
}

export async function getDashboardInsights(
  filter?: { isAsset?: boolean; year?: number | null }
): Promise<DashboardInsights> {
  try {
    const account = await prisma.account.findFirst();
    if (!account) {
      return emptyInsights();
    }

    const where: Record<string, unknown> = { accountId: account.id };
    if (filter?.isAsset !== undefined) where.isAsset = filter.isAsset;
    const dateFilter = tradeDateYearFilter(filter?.year ?? undefined);
    if (dateFilter) where.tradeDate = dateFilter;

    const trades = await prisma.trade.findMany({
      where,
      select: {
        tradeDate: true,
        totalPnL: true,
        riskReward: true,
        tradeType: true,
        symbol: true,
        isCompleted: true,
        totalShares: true,
        sharesInProcess: true,
      },
      orderBy: { tradeDate: "asc" },
    });

    // Include both fully closed AND partial-exit open trades.
    const completed = trades.filter(
      (t) => t.totalPnL !== null && hasRealizedPnL(t)
    );
    if (completed.length === 0) return emptyInsights();

    // Equity curve + running peak for drawdown
    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve: DashboardInsights["equityCurve"] = [];
    for (const t of completed) {
      const pnl = t.totalPnL!;
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;
      equityCurve.push({
        date: (t.tradeDate as Date).toISOString().slice(0, 10),
        cumulative: Math.round(cumulative * 100) / 100,
        pnl,
        symbol: t.symbol,
      });
    }
    const currentDrawdown = peak - cumulative;
    const peakValue = account.startingBalance + peak;
    const maxDrawdownPct = peakValue > 0 ? maxDrawdown / peakValue : 0;

    // Longest losing streak
    let longestLossStreak = 0;
    let currentLossStreak = 0;
    for (const t of completed) {
      if ((t.totalPnL ?? 0) < 0) {
        currentLossStreak++;
        if (currentLossStreak > longestLossStreak)
          longestLossStreak = currentLossStreak;
      } else {
        currentLossStreak = 0;
      }
    }

    // Expectancy + avg winner / avg loser
    const winners = completed.filter((t) => t.totalPnL! > 0);
    const losers = completed.filter((t) => t.totalPnL! < 0);
    const avgWinner =
      winners.length > 0
        ? winners.reduce((s, t) => s + t.totalPnL!, 0) / winners.length
        : 0;
    const avgLoser =
      losers.length > 0
        ? losers.reduce((s, t) => s + t.totalPnL!, 0) / losers.length
        : 0;
    const winRate = completed.length > 0 ? winners.length / completed.length : 0;
    const lossRate = completed.length > 0 ? losers.length / completed.length : 0;
    const expectancy = winRate * avgWinner + lossRate * avgLoser;

    // By strategy / tradeType
    const stratMap = new Map<
      string,
      { count: number; totalPnL: number; winners: number; rrSum: number }
    >();
    for (const t of completed) {
      const key = t.tradeType || "(none)";
      if (!stratMap.has(key))
        stratMap.set(key, { count: 0, totalPnL: 0, winners: 0, rrSum: 0 });
      const s = stratMap.get(key)!;
      s.count++;
      s.totalPnL += t.totalPnL!;
      if (t.totalPnL! > 0) s.winners++;
      s.rrSum += t.riskReward ?? 0;
    }
    const byStrategy = Array.from(stratMap.entries())
      .map(([tradeType, s]) => ({
        tradeType,
        count: s.count,
        totalPnL: s.totalPnL,
        winRate: s.count > 0 ? s.winners / s.count : 0,
        avgRR: s.count > 0 ? s.rrSum / s.count : 0,
      }))
      .sort((a, b) => b.totalPnL - a.totalPnL);

    return {
      equityCurve,
      drawdown: {
        maxDrawdown,
        maxDrawdownPct,
        currentDrawdown,
        longestLossStreak,
      },
      expectancy: {
        expectancy,
        avgWinner,
        avgLoser,
        winRate,
        lossRate,
        winnerCount: winners.length,
        loserCount: losers.length,
      },
      byStrategy,
    };
  } catch {
    return emptyInsights();
  }
}

function emptyInsights(): DashboardInsights {
  return {
    equityCurve: [],
    drawdown: {
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      currentDrawdown: 0,
      longestLossStreak: 0,
    },
    expectancy: {
      expectancy: 0,
      avgWinner: 0,
      avgLoser: 0,
      winRate: 0,
      lossRate: 0,
      winnerCount: 0,
      loserCount: 0,
    },
    byStrategy: [],
  };
}

// Serialize Prisma objects to plain JSON (dates → strings)
function serializeTrade(trade: any) {
  return {
    ...trade,
    tradeDate: trade.tradeDate instanceof Date ? trade.tradeDate.toISOString().split("T")[0] : trade.tradeDate,
    createdAt: trade.createdAt instanceof Date ? trade.createdAt.toISOString() : trade.createdAt,
    updatedAt: trade.updatedAt instanceof Date ? trade.updatedAt.toISOString() : trade.updatedAt,
  };
}

function serializeReview(review: any) {
  return {
    ...review,
    createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
    updatedAt: review.updatedAt instanceof Date ? review.updatedAt.toISOString() : review.updatedAt,
  };
}
