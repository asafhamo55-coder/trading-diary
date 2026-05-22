import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot admin: set totalPnL on specific trades.
// POST body: { updates: [{ tradeDate: "2026-03-09", symbol: "Oil", direction: "LONG", totalPnL: 690 }, ...] }
// Matches by date + uppercase(symbol) + direction. Sets totalPnL only.
// If multiple trades match (same date+symbol+direction), updates all matching.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      updates?: {
        tradeDate: string;
        symbol: string;
        direction: "LONG" | "SHORT";
        totalPnL: number;
        // Optional disambiguator when multiple trades share date+symbol+direction
        buyQty?: number;
      }[];
    };
    const updates = body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return errorResponse("Provide updates: [{tradeDate, symbol, direction, totalPnL}]");
    }

    const account = await prisma.account.findFirst();
    if (!account) return errorResponse("No account", 404);

    const results: {
      ok: boolean;
      tradeDate: string;
      symbol: string;
      direction: string;
      matched: number;
      newPnL?: number;
      note?: string;
    }[] = [];

    for (const u of updates) {
      const date = new Date(u.tradeDate + "T00:00:00Z");
      let matches = await prisma.trade.findMany({
        where: {
          accountId: account.id,
          tradeDate: date,
          direction: u.direction,
          symbol: { equals: u.symbol, mode: "insensitive" },
        },
        include: { entries: true },
      });

      // Disambiguate by buy quantity if needed
      if (matches.length > 1 && typeof u.buyQty === "number") {
        const buyQtyTarget = u.buyQty;
        matches = matches.filter((m) => {
          const totalBuyQty = m.entries
            .filter((e) => e.legType === "BUY")
            .reduce((s, e) => s + e.quantity, 0);
          return Math.abs(totalBuyQty - buyQtyTarget) < 0.01;
        });
      }

      if (matches.length === 0) {
        results.push({
          ok: false,
          tradeDate: u.tradeDate,
          symbol: u.symbol,
          direction: u.direction,
          matched: 0,
          note: "No matching trade",
        });
        continue;
      }

      await prisma.trade.updateMany({
        where: { id: { in: matches.map((m) => m.id) } },
        data: { totalPnL: u.totalPnL },
      });

      results.push({
        ok: true,
        tradeDate: u.tradeDate,
        symbol: u.symbol,
        direction: u.direction,
        matched: matches.length,
        newPnL: u.totalPnL,
      });
    }

    const okCount = results.filter((r) => r.ok).length;
    return jsonResponse({
      requested: updates.length,
      applied: okCount,
      results,
    });
  } catch (error) {
    return errorResponse(
      `set-pnl failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
