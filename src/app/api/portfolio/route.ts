import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { calculatePortfolioTracker } from "@/lib/calculations/portfolio";

// GET /api/portfolio — full 12-month portfolio tracker
export async function GET() {
  try {
    const account = await getAccount();

    // Fetch all trades for the year
    const trades = await prisma.trade.findMany({
      where: { accountId: account.id },
      select: {
        month: true,
        totalPnL: true,
        riskReward: true,
        isCompleted: true,
        tradeDate: true,
      },
      orderBy: { tradeDate: "asc" },
    });

    // Group by month
    const tradesByMonth = new Map<number, typeof trades>();
    for (const trade of trades) {
      const arr = tradesByMonth.get(trade.month) || [];
      arr.push(trade);
      tradesByMonth.set(trade.month, arr);
    }

    // Get risk units per month
    const reviews = await prisma.monthlyReview.findMany({
      where: { accountId: account.id },
    });
    const riskUnits = new Map<number, number>();
    for (const r of reviews) {
      if (r.riskUnit) riskUnits.set(r.month, r.riskUnit);
    }

    const portfolio = calculatePortfolioTracker(
      tradesByMonth,
      account.startingBalance,
      riskUnits
    );

    return jsonResponse({
      calendarYear: account.calendarYear,
      startingBalance: account.startingBalance,
      accountOpenBalance: account.accountOpenBalance,
      months: portfolio,
    });
  } catch (error) {
    return errorResponse("Failed to compute portfolio", 500);
  }
}
