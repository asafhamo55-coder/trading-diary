import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";

// POST /api/home/categorize-merchant
// Body: { matcher, categoryId?, exclude? }
// Applies a category (or exclusion) to every transaction whose raw description
// contains `matcher`, and — for categorization — remembers it as a rule so
// future imports auto-tag the same merchant.
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const matcher: string = (body?.matcher ?? "").trim().toLowerCase();
    const categoryId: string | undefined = body?.categoryId || undefined;
    const exclude: boolean = !!body?.exclude;
    if (matcher.length < 2) return errorResponse("Merchant is too short to match on");

    const where = {
      accountId: account.id,
      rawDescription: { contains: matcher, mode: "insensitive" as const },
    };

    if (exclude) {
      const res = await prisma.homeTransaction.updateMany({
        where,
        data: { isExcluded: true, needsReview: false, excludeReason: "Excluded by merchant" },
      });
      return jsonResponse({ ok: true, updated: res.count, learned: false });
    }

    if (!categoryId) return errorResponse("Pick a category");
    const cat = await prisma.homeCategory.findFirst({
      where: { id: categoryId, accountId: account.id },
    });
    if (!cat) return errorResponse("Category not found");

    // Remember the mapping for future imports (upsert by matcher).
    const existingRule = await prisma.homeCategoryRule.findFirst({
      where: { accountId: account.id, matcher },
    });
    if (existingRule) {
      await prisma.homeCategoryRule.update({
        where: { id: existingRule.id },
        data: { categoryId },
      });
    } else {
      await prisma.homeCategoryRule.create({
        data: { accountId: account.id, matcher, categoryId, priority: 10 },
      });
    }

    // Apply to all matching rows that are still unresolved.
    const res = await prisma.homeTransaction.updateMany({
      where: { ...where, OR: [{ needsReview: true }, { categoryId: null }] },
      data: { categoryId, needsReview: false },
    });
    return jsonResponse({ ok: true, updated: res.count, learned: true });
  } catch (error) {
    console.error("Categorize merchant error:", error);
    return errorResponse(
      `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
