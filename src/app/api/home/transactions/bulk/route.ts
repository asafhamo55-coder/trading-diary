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

    // Build each row's resulting patch, then GROUP rows that share the same
    // patch into a single updateMany. This collapses "apply to all N" from N
    // statements into one, so large saves don't time out or hit statement caps.
    const groups = new Map<string, { ids: string[]; data: Record<string, unknown> }>();
    for (const u of updates) {
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
      if (Object.keys(patch).length === 0) continue;

      const key = JSON.stringify(patch);
      const g = groups.get(key) ?? { ids: [], data: patch };
      g.ids.push(u.id);
      groups.set(key, g);
    }

    const ops = Array.from(groups.values()).map((g) =>
      prisma.homeTransaction.updateMany({
        where: { id: { in: g.ids }, accountId: account.id },
        data: g.data,
      })
    );
    await prisma.$transaction(ops);

    return jsonResponse({ ok: true, saved: updates.length });
  } catch (error) {
    console.error("Bulk home transaction error:", error);
    return errorResponse(
      `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
