import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { getCategory, propertyTitle } from "@/lib/property";

// Map a Home category name → a property (Schedule E) category key.
function mapPropertyCategory(homeCatName: string | null, type: "INCOME" | "EXPENSE"): string {
  const n = (homeCatName ?? "").toLowerCase();
  if (type === "INCOME") return n.includes("rent") ? "RENT" : "OTHER_INCOME";
  if (n.includes("mortgage")) return "MORTGAGE_INTEREST";
  if (n.includes("tax")) return "PROPERTY_TAX";
  if (n.includes("insurance")) return "INSURANCE";
  if (n.includes("repair") || n.includes("maintenance")) return "REPAIRS";
  if (n.includes("clean")) return "CLEANING_MAINT";
  if (n.includes("utilit") || n.includes("water") || n.includes("electric") || n.includes("internet") || n.includes("phone")) return "UTILITIES";
  if (n.includes("hoa")) return "HOA";
  if (n.includes("manage")) return "MANAGEMENT";
  if (n.includes("legal") || n.includes("professional")) return "LEGAL";
  if (n.includes("advertis")) return "ADVERTISING";
  if (n.includes("supplies")) return "SUPPLIES";
  return "OTHER";
}

// POST /api/home/transactions/[id]/move-to-property
// Body: { propertyId, category? } — creates a property entry from a Home
// transaction and marks the Home row as excluded (moved), no double-count.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    const body = await req.json();
    const propertyId: string = body?.propertyId;
    if (!propertyId) return errorResponse("Pick a property");

    const tx = await prisma.homeTransaction.findFirst({
      where: { id, accountId: account.id },
    });
    if (!tx) return errorResponse("Transaction not found", 404);

    const property = await prisma.property.findFirst({
      where: { id: propertyId, accountId: account.id },
    });
    if (!property) return errorResponse("Property not found", 404);

    const type: "INCOME" | "EXPENSE" = tx.amount >= 0 ? "INCOME" : "EXPENSE";
    let category: string = body?.category || "";
    if (!category || !getCategory(category) || getCategory(category)!.type !== type) {
      const catRow = tx.categoryId
        ? await prisma.homeCategory.findUnique({ where: { id: tx.categoryId } })
        : null;
      category = mapPropertyCategory(catRow?.name ?? tx.description, type);
    }

    const date = tx.date;
    // Create the property entry with all details.
    const entry = await prisma.propertyTransaction.create({
      data: {
        propertyId,
        date,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        type,
        category,
        amount: Math.abs(tx.amount),
        description: tx.description,
      },
    });

    // Mark the Home row as moved (excluded from Home spend, linked to the property).
    await prisma.homeTransaction.update({
      where: { id },
      data: {
        isExcluded: true,
        needsReview: false,
        propertyId,
        excludeReason: `Moved to ${propertyTitle(property)}`,
      },
    });

    return jsonResponse({ ok: true, entryId: entry.id, propertyTitle: propertyTitle(property) });
  } catch (error) {
    console.error("Move to property error:", error);
    return errorResponse(
      `Failed to move: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
