import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { bulkHomeTransactionSchema } from "@/lib/home-validators";

// POST /api/home/transactions/bulk — apply a batch of per-row edits at once
// (the ledger "Save changes" button). Only rows owned by the account are touched.
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = bulkHomeTransactionSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const { updates } = parsed.data;

    let saved = 0;
    await prisma.$transaction(
      updates.map((u) => {
        const patch: Record<string, unknown> = {};
        if (u.categoryId !== undefined) {
          patch.categoryId = u.categoryId || null;
          if (u.categoryId) {
            patch.needsReview = false;
            patch.propertyId = null;
          }
        }
        if (u.propertyId !== undefined) {
          patch.propertyId = u.propertyId || null;
          if (u.propertyId) {
            patch.needsReview = false;
            patch.categoryId = null;
          }
        }
        if (u.isExcluded !== undefined) {
          patch.isExcluded = u.isExcluded;
          patch.excludeReason = u.isExcluded ? u.excludeReason ?? "Excluded" : null;
          if (u.isExcluded) patch.needsReview = false;
        }
        if (u.notes !== undefined) patch.notes = u.notes;
        saved++;
        // Scope every update to this account so nothing else can be touched.
        return prisma.homeTransaction.updateMany({
          where: { id: u.id, accountId: account.id },
          data: patch,
        });
      })
    );

    return jsonResponse({ ok: true, saved });
  } catch (error) {
    console.error("Bulk home transaction error:", error);
    return errorResponse(
      `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
