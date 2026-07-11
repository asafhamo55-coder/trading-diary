import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { SMALL_EXCLUDE_THRESHOLD } from "@/lib/home";

// POST /api/home/exclude-small — exclude every transaction whose |amount| is
// below the threshold and isn't already excluded. Applies to all existing data.
export async function POST() {
  try {
    const account = await getAccount();
    const t = SMALL_EXCLUDE_THRESHOLD;
    const res = await prisma.homeTransaction.updateMany({
      where: {
        accountId: account.id,
        isExcluded: false,
        amount: { gt: -t, lt: t }, // −t < amount < t  ⇔  |amount| < t
      },
      data: {
        isExcluded: true,
        needsReview: false,
        excludeReason: `Under $${t}`,
      },
    });
    return jsonResponse({ ok: true, updated: res.count, threshold: t });
  } catch (error) {
    console.error("Exclude-small error:", error);
    return errorResponse(
      `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
