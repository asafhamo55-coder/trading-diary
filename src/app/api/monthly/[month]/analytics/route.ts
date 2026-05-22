import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { calculateMonthlyAnalytics } from "@/lib/calculations/monthly";

// GET /api/monthly/[month]/analytics — computed analytics for a month
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month: monthStr } = await params;
    const month = parseInt(monthStr);
    if (isNaN(month) || month < 1 || month > 12) {
      return errorResponse("Invalid month");
    }

    const account = await getAccount();
    const trades = await prisma.trade.findMany({
      where: { accountId: account.id, month },
      include: {
        tradeErrors: { include: { errorDefinition: true } },
      },
    });

    const analytics = calculateMonthlyAnalytics(
      trades.map((t) => ({
        direction: t.direction as "LONG" | "SHORT",
        tradeType: t.tradeType,
        totalPnL: t.totalPnL,
        returnOnPosition: t.returnOnPosition,
        riskReward: t.riskReward,
        totalPositionValue: t.totalPositionValue,
        isCompleted: t.isCompleted,
        totalShares: t.totalShares,
        sharesInProcess: t.sharesInProcess,
        tradeDate: t.tradeDate,
        tradeErrors: t.tradeErrors.map((te) => ({
          errorDefinition: { id: te.errorDefinition.id, name: te.errorDefinition.name },
        })),
      }))
    );

    return jsonResponse(analytics);
  } catch (error) {
    return errorResponse("Failed to compute analytics", 500);
  }
}
