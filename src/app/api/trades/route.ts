import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount, tradeInclude } from "@/lib/api-helpers";
import { createTradeSchema } from "@/lib/validators";
import { computeAllTradeFields } from "@/lib/calculations/trade";
import { calculateCommission } from "@/lib/calculations/trade";

// GET /api/trades — list trades with optional filters
export async function GET(req: NextRequest) {
  try {
    const account = await getAccount();
    const url = req.nextUrl;
    const month = url.searchParams.get("month");
    const direction = url.searchParams.get("direction");
    const symbol = url.searchParams.get("symbol");
    const completed = url.searchParams.get("completed");

    const where: Record<string, unknown> = { accountId: account.id };
    if (month) where.month = parseInt(month);
    if (direction) where.direction = direction;
    if (symbol) where.symbol = { contains: symbol, mode: "insensitive" };
    if (completed !== null && completed !== undefined) {
      where.isCompleted = completed === "true";
    }

    const trades = await prisma.trade.findMany({
      where,
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
      orderBy: { tradeDate: "desc" },
    });

    return jsonResponse(trades);
  } catch (error) {
    return errorResponse("Failed to fetch trades", 500);
  }
}

// POST /api/trades — create a new trade
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = createTradeSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.message);
    }

    const data = parsed.data;

    // Calculate commissions for each leg
    const entriesWithComm = data.entries.map((leg) => ({
      ...leg,
      commission: calculateCommission(
        leg.price,
        leg.quantity,
        account.commissionPerShare
      ),
    }));

    // Get leverage for this symbol
    const assetLev = await prisma.assetLeverage.findUnique({
      where: { accountId_symbol: { accountId: account.id, symbol: data.symbol } },
    });

    // Get risk unit for the month
    const review = await prisma.monthlyReview.findUnique({
      where: {
        accountId_month_year: {
          accountId: account.id,
          month: data.month,
          year: account.calendarYear,
        },
      },
    });

    // Compute trade fields
    const tradeData = {
      direction: data.direction,
      symbol: data.symbol,
      entries: entriesWithComm.map((e) => ({
        ...e,
        legType: e.legType as "BUY" | "SELL",
      })),
      leverage: assetLev?.leverage ?? 1,
      dailyHigh: data.dailyHigh,
      dailyClose: data.dailyClose,
    };

    const computed = computeAllTradeFields(tradeData, review?.riskUnit ?? 0);

    const trade = await prisma.trade.create({
      data: {
        accountId: account.id,
        tradeDate: data.tradeDate,
        month: data.month,
        symbol: data.symbol.toUpperCase(),
        direction: data.direction,
        tradeType: data.tradeType,
        isSwingContinuation: data.isSwingContinuation,
        ...computed,
        dailyHigh: data.dailyHigh,
        dailyClose: data.dailyClose,
        entryReason: data.entryReason,
        exitReason: data.exitReason,
        conclusions: data.conclusions,
        chartUrl: data.chartUrl || null,
        notes: data.notes,
        entries: {
          create: entriesWithComm,
        },
        tradeErrors: data.errorIds.length > 0
          ? {
              create: data.errorIds.map((id) => ({
                errorDefinitionId: id,
              })),
            }
          : undefined,
      },
      include: {
        entries: { orderBy: { legOrder: "asc" } },
        tradeErrors: { include: { errorDefinition: true } },
      },
    });

    return jsonResponse(trade, 201);
  } catch (error) {
    console.error("Create trade error:", error);
    return errorResponse("Failed to create trade", 500);
  }
}
