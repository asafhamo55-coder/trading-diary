import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updateHomeTransactionSchema } from "@/lib/home-validators";

async function owned(id: string, accountId: string) {
  return prisma.homeTransaction.findFirst({ where: { id, accountId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    if (!(await owned(id, account.id))) return errorResponse("Transaction not found", 404);

    const body = await req.json();
    const parsed = updateHomeTransactionSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const patch: Record<string, unknown> = {};
    if (data.description !== undefined) patch.description = data.description;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        const cat = await prisma.homeCategory.findFirst({
          where: { id: data.categoryId, accountId: account.id },
        });
        if (!cat) return errorResponse("Category not found");
      }
      patch.categoryId = data.categoryId || null;
      // Categorizing a row resolves it out of the review queue.
      if (data.categoryId) patch.needsReview = false;
    }
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.isExcluded !== undefined) patch.isExcluded = data.isExcluded;
    if (data.excludeReason !== undefined) patch.excludeReason = data.excludeReason;
    if (data.needsReview !== undefined) patch.needsReview = data.needsReview;
    if (data.date !== undefined) {
      const d = new Date(data.date);
      if (Number.isNaN(d.getTime())) return errorResponse("Invalid date");
      patch.date = d;
      patch.year = d.getUTCFullYear();
      patch.month = d.getUTCMonth() + 1;
    }

    const updated = await prisma.homeTransaction.update({ where: { id }, data: patch });
    return jsonResponse(updated);
  } catch (error) {
    console.error("Update home transaction error:", error);
    return errorResponse("Failed to update transaction", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    if (!(await owned(id, account.id))) return errorResponse("Transaction not found", 404);
    await prisma.homeTransaction.delete({ where: { id } });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete home transaction error:", error);
    return errorResponse("Failed to delete transaction", 500);
  }
}
