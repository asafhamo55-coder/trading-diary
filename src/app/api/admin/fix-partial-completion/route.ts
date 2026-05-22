import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot admin: re-flag any partial-exit trade (sharesInProcess > 0 but
// < totalShares) as NOT completed. The seed historically marked them
// completed because the source sheet did; the app now treats partials as open.
export async function POST() {
  try {
    const candidates = await prisma.trade.findMany({
      where: {
        isCompleted: true,
        sharesInProcess: { gt: 0 },
      },
      select: { id: true, symbol: true, totalShares: true, sharesInProcess: true },
    });

    const toFix = candidates.filter(
      (t) => (t.sharesInProcess ?? 0) < (t.totalShares ?? 0)
    );

    if (toFix.length === 0) {
      return jsonResponse({ updated: 0, message: "Nothing to fix" });
    }

    const result = await prisma.trade.updateMany({
      where: { id: { in: toFix.map((t) => t.id) } },
      data: { isCompleted: false },
    });

    return jsonResponse({
      updated: result.count,
      trades: toFix.map((t) => ({
        symbol: t.symbol,
        totalShares: t.totalShares,
        sharesInProcess: t.sharesInProcess,
      })),
    });
  } catch (error) {
    return errorResponse(
      `Fix failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
