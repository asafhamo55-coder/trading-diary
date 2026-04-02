import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updateTradeSchema } from "@/lib/validators";
import { computeAllTradeFields, calculateCommission } from "@/lib/calculations/trade";

// GET /api/trades/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
        account: { include: { assetLeverages: true } },
      },
    });

    if (!trade) return errorResponse("Trade not found", 404);
    return jsonResponse(trade);
  } catch (error) {
    return errorResponse("Failed to fetch trade", 500);
  }
}

// PUT /api/trades/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    const body = await req.json();
    const parsed = updateTradeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.message);
    }

    const data = parsed.data;

    // If entries are being updated, recalculate everything
    if (data.entries) {
      const entriesWithComm = data.entries.map((leg) => ({
        ...leg,
        commission: calculateCommission(
          leg.price,
          leg.quantity,
          account.commissionPerShare
        ),
      }));

      const assetLev = await prisma.assetLeverage.findUnique({
        where: {
          accountId_symbol: {
            accountId: account.id,
            symbol: data.symbol || "",
          },
        },
      });

      const review = await prisma.monthlyReview.findUnique({
        where: {
          accountId_month_year: {
            accountId: account.id,
            month: data.month || 1,
            year: account.calendarYear,
          },
        },
      });

      const tradeData = {
        direction: data.direction || "LONG",
        symbol: data.symbol || "",
        entries: entriesWithComm.map((e) => ({
          ...e,
          legType: e.legType as "BUY" | "SELL",
        })),
        leverage: assetLev?.leverage ?? 1,
        dailyHigh: data.dailyHigh,
        dailyClose: data.dailyClose,
      };

      const computed = computeAllTradeFields(tradeData, review?.riskUnit ?? 0);

      // Delete old entries and errors, recreate
      await prisma.tradeLeg.deleteMany({ where: { tradeId: id } });
      await prisma.tradeError.deleteMany({ where: { tradeId: id } });

      const trade = await prisma.trade.update({
        where: { id },
        data: {
          ...data,
          tradeDate: data.tradeDate || undefined,
          symbol: data.symbol?.toUpperCase(),
          chartUrl: data.chartUrl || null,
          ...computed,
          entries: { create: entriesWithComm },
          tradeErrors: data.errorIds && data.errorIds.length > 0
            ? { create: data.errorIds.map((eid) => ({ errorDefinitionId: eid })) }
            : undefined,
        },
        include: {
          entries: { orderBy: { legOrder: "asc" } },
          tradeErrors: { include: { errorDefinition: true } },
        },
      });

      return jsonResponse(trade);
    }

    // Simple field update (no entries change)
    const { entries: _e, errorIds: _err, ...simpleData } = data;
    const trade = await prisma.trade.update({
      where: { id },
      data: {
        ...simpleData,
        tradeDate: simpleData.tradeDate || undefined,
        chartUrl: simpleData.chartUrl || null,
      },
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
    });

    return jsonResponse(trade);
  } catch (error) {
    console.error("Update trade error:", error);
    return errorResponse("Failed to update trade", 500);
  }
}

// DELETE /api/trades/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.trade.delete({ where: { id } });
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse("Failed to delete trade", 500);
  }
}
