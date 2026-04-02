// Server-side data fetching functions that query Supabase directly via Prisma
// Used by page components to get real data

import { prisma } from "./db";
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

export async function getAllTrades(filters?: { month?: number; direction?: string; symbol?: string }) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_TRADES;

    const where: Record<string, unknown> = { accountId: account.id };
    if (filters?.month) where.month = filters.month;
    if (filters?.direction) where.direction = filters.direction;
    if (filters?.symbol) where.symbol = { contains: filters.symbol, mode: "insensitive" };

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

export async function getTradesByMonth(month: number) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_TRADES.filter((t) => t.month === month);

    const trades = await prisma.trade.findMany({
      where: { accountId: account.id, month },
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

export async function getDashboardStats() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return getDemoStats();

    const trades = await prisma.trade.findMany({
      where: { accountId: account.id },
      select: {
        totalPnL: true,
        riskReward: true,
        isCompleted: true,
        month: true,
        tradeDate: true,
        direction: true,
        symbol: true,
      },
    });

    const completed = trades.filter((t) => t.isCompleted && t.totalPnL !== null);
    const winners = completed.filter((t) => t.totalPnL! > 0);
    const totalPnL = completed.reduce((s, t) => s + t.totalPnL!, 0);
    const currentPortfolio = account.startingBalance + totalPnL;
    const wins = winners.reduce((s, t) => s + t.totalPnL!, 0);
    const losses = Math.abs(completed.filter((t) => t.totalPnL! < 0).reduce((s, t) => s + t.totalPnL!, 0));

    return {
      totalTrades: completed.length,
      openTrades: trades.filter((t) => !t.isCompleted).length,
      winRate: completed.length > 0 ? winners.length / completed.length : 0,
      totalPnL,
      currentPortfolio,
      startingBalance: account.startingBalance,
      avgRR: completed.length > 0
        ? completed.reduce((s, t) => s + (t.riskReward ?? 0), 0) / completed.length
        : 0,
      profitFactor: losses > 0 ? wins / losses : 0,
      bestTrade: completed.length > 0 ? Math.max(...completed.map((t) => t.totalPnL!)) : 0,
      worstTrade: completed.length > 0 ? Math.min(...completed.map((t) => t.totalPnL!)) : 0,
    };
  } catch {
    return getDemoStats();
  }
}

export async function getMonthlyPnL() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return getDemoMonthlyPnL();

    const trades = await prisma.trade.findMany({
      where: { accountId: account.id, isCompleted: true },
      select: { month: true, totalPnL: true },
    });

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: 12 }, (_, i) => {
      const monthTrades = trades.filter((t) => t.month === i + 1);
      const pnl = monthTrades.reduce((sum, t) => sum + (t.totalPnL ?? 0), 0);
      return { month: i + 1, pnl, name: MONTH_NAMES[i] };
    });
  } catch {
    return getDemoMonthlyPnL();
  }
}

export async function getRecentTrades(limit = 5) {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return DEMO_TRADES.filter((t) => t.isCompleted).slice(0, limit);

    const trades = await prisma.trade.findMany({
      where: { accountId: account.id, isCompleted: true },
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
      orderBy: { tradeDate: "desc" },
      take: limit,
    });

    return trades.map(serializeTrade);
  } catch {
    return DEMO_TRADES.filter((t) => t.isCompleted).slice(0, limit);
  }
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
