import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { createHomeTransactionSchema } from "@/lib/home-validators";

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/home/transactions — add a manual transaction row
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = createHomeTransactionSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const homeAccount = await prisma.homeAccount.findFirst({
      where: { id: data.homeAccountId, accountId: account.id },
    });
    if (!homeAccount) return errorResponse("Account not found", 404);

    if (data.categoryId) {
      const cat = await prisma.homeCategory.findFirst({
        where: { id: data.categoryId, accountId: account.id },
      });
      if (!cat) return errorResponse("Category not found");
    }

    const date = parseDate(data.date);
    if (!date) return errorResponse("Invalid date");

    const tx = await prisma.homeTransaction.create({
      data: {
        accountId: account.id,
        homeAccountId: data.homeAccountId,
        date,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        amount: data.amount,
        description: data.description,
        rawDescription: data.description,
        categoryId: data.categoryId ?? null,
        propertyId: data.propertyId ?? null,
        notes: data.notes ?? null,
        isExcluded: data.isExcluded ?? false,
        excludeReason: data.excludeReason ?? null,
        isManual: true,
        needsReview: false,
      },
    });
    return jsonResponse(tx, 201);
  } catch (error) {
    console.error("Create home transaction error:", error);
    return errorResponse("Failed to create transaction", 500);
  }
}
