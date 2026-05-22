import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { computeAllTradeFields } from "@/lib/calculations/trade";

// POST /api/trades/[id]/recalculate — force recalculation of computed fields
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        account: { include: { assetLeverages: true } },
      },
    });

    if (!trade) return errorResponse("Trade not found", 404);

    const leverage =
      trade.account.assetLeverages.find(
        (a) => a.symbol.toLowerCase() === trade.symbol.toLowerCase()
      )?.leverage ?? 1;

    const review = await prisma.monthlyReview.findUnique({
      where: {
        accountId_month_year: {
          accountId: trade.accountId,
          month: trade.month,
          year: trade.account.calendarYear,
        },
      },
    });

    const tradeData = {
      direction: trade.direction as "LONG" | "SHORT",
      symbol: trade.symbol,
      entries: trade.entries.map((e) => ({
        legType: e.legType as "BUY" | "SELL",
        price: e.price,
        quantity: e.quantity,
        commission: e.commission,
        legOrder: e.legOrder,
      })),
      leverage,
      dailyHigh: trade.dailyHigh,
      dailyClose: trade.dailyClose,
    };

    const computed = computeAllTradeFields(tradeData, review?.riskUnit ?? 0);

    const updated = await prisma.trade.update({
      where: { id },
      data: computed,
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
    });

    return jsonResponse(updated);
  } catch (error) {
    return errorResponse("Failed to recalculate trade", 500);
  }
}
