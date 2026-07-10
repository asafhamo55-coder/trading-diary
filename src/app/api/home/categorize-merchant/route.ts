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
    const propertyId: string | undefined = body?.propertyId || undefined;
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

    // Validate the chosen target (a category OR a property).
    if (propertyId) {
      const prop = await prisma.property.findFirst({
        where: { id: propertyId, accountId: account.id },
      });
      if (!prop) return errorResponse("Property not found");
    } else if (categoryId) {
      const cat = await prisma.homeCategory.findFirst({
        where: { id: categoryId, accountId: account.id },
      });
      if (!cat) return errorResponse("Category not found");
    } else {
      return errorResponse("Pick a category or property");
    }

    // Remember the mapping for future imports (upsert by matcher).
    const existingRule = await prisma.homeCategoryRule.findFirst({
      where: { accountId: account.id, matcher },
    });
    if (existingRule) {
      await prisma.homeCategoryRule.update({
        where: { id: existingRule.id },
        data: { categoryId: categoryId ?? null, propertyId: propertyId ?? null },
      });
    } else {
      await prisma.homeCategoryRule.create({
        data: {
          accountId: account.id,
          matcher,
          categoryId: categoryId ?? null,
          propertyId: propertyId ?? null,
          priority: 10,
        },
      });
    }

    // Apply to all matching rows that are still unresolved.
    const res = await prisma.homeTransaction.updateMany({
      where: { ...where, OR: [{ needsReview: true }, { categoryId: null, propertyId: null }] },
      data: {
        categoryId: propertyId ? null : categoryId ?? null,
        propertyId: propertyId ?? null,
        needsReview: false,
      },
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
