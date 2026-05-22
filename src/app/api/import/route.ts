import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { bulkImportSchema } from "@/lib/validators";
import { calculateCommission, computeAllTradeFields } from "@/lib/calculations/trade";

// POST /api/import — bulk import trades from CSV/JSON
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = bulkImportSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.message);
    }

    const { trades: importTrades, year } = parsed.data;
    const results = { imported: 0, errors: [] as string[] };

    // Get all leverages for this account
    const leverages = await prisma.assetLeverage.findMany({
      where: { accountId: account.id },
    });
    const leverageMap = new Map(leverages.map((l) => [l.symbol, l.leverage]));

    // Get all risk units
    const reviews = await prisma.monthlyReview.findMany({
      where: { accountId: account.id, year },
    });
    const riskUnitMap = new Map(
      reviews.map((r) => [r.month, r.riskUnit ?? 0])
    );

    // Get error definitions
    const errorDefs = await prisma.errorDefinition.findMany({
      where: { accountId: account.id },
    });
    const errorDefMap = new Map(errorDefs.map((e) => [e.name, e.id]));

    for (let i = 0; i < importTrades.length; i++) {
      try {
        const t = importTrades[i];
        const tradeDate = new Date(year, t.month - 1, t.day);

        const allLegs = [
          ...t.buyLegs.map((l, j) => ({
            legType: "BUY" as const,
            price: l.price,
            quantity: l.quantity,
            commission: calculateCommission(
              l.price,
              l.quantity,
              account.commissionPerShare
            ),
            legOrder: j + 1,
          })),
          ...t.sellLegs.map((l, j) => ({
            legType: "SELL" as const,
            price: l.price,
            quantity: l.quantity,
            commission: calculateCommission(
              l.price,
              l.quantity,
              account.commissionPerShare
            ),
            legOrder: j + 1,
          })),
        ];

        const leverage = leverageMap.get(t.symbol) ?? 1;
        const riskUnit = riskUnitMap.get(t.month) ?? 0;

        const tradeData = {
          direction: t.direction,
          symbol: t.symbol,
          entries: allLegs,
          leverage,
        };

        const computed = computeAllTradeFields(tradeData, riskUnit);

        // Resolve error IDs
        const errorIds = (t.errors ?? [])
          .map((name) => errorDefMap.get(name))
          .filter((id): id is string => !!id);

        await prisma.trade.create({
          data: {
            accountId: account.id,
            tradeDate,
            month: t.month,
            symbol: t.symbol,
            direction: t.direction,
            tradeType: t.tradeType,
            isSwingContinuation: t.isSwingContinuation ?? false,
            isAsset: t.isAsset ?? false,
            ...computed,
            entryReason: t.entryReason,
            exitReason: t.exitReason,
            conclusions: t.conclusions,
            chartUrl: t.chartUrl,
            entries: { create: allLegs },
            tradeErrors:
              errorIds.length > 0
                ? {
                    create: errorIds.map((id) => ({
                      errorDefinitionId: id,
                    })),
                  }
                : undefined,
          },
        });

        results.imported++;
      } catch (err) {
        results.errors.push(
          `Trade ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return jsonResponse(results, results.errors.length > 0 ? 207 : 201);
  } catch (error) {
    return errorResponse("Failed to import trades", 500);
  }
}
