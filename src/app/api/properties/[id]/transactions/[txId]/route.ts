import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updatePropertyTransactionSchema } from "@/lib/validators";
import { getCategory } from "@/lib/property";

// PATCH /api/properties/[id]/transactions/[txId] — edit an entry
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  try {
    const { id, txId } = await params;
    const account = await getAccount();
    const tx = await prisma.propertyTransaction.findFirst({
      where: { id: txId, propertyId: id, property: { accountId: account.id } },
    });
    if (!tx) return errorResponse("Transaction not found", 404);

    const body = await req.json();
    const parsed = updatePropertyTransactionSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    // Resolve the effective type + category and validate they match.
    const type = data.type ?? tx.type;
    const category = data.category ?? tx.category;
    if (data.type !== undefined || data.category !== undefined) {
      const cat = getCategory(category);
      if (!cat) return errorResponse("Unknown category");
      if (cat.type !== type)
        return errorResponse(`Category "${cat.label}" is not a valid ${type.toLowerCase()} category`);
    }

    const patch: Record<string, unknown> = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.category !== undefined) patch.category = data.category;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.date !== undefined) {
      const d = new Date(data.date);
      if (Number.isNaN(d.getTime())) return errorResponse("Invalid date");
      patch.date = d;
      patch.year = d.getUTCFullYear();
      patch.month = d.getUTCMonth() + 1;
    }

    const updated = await prisma.propertyTransaction.update({ where: { id: txId }, data: patch });
    return jsonResponse(updated);
  } catch (error) {
    console.error("Update property transaction error:", error);
    return errorResponse("Failed to update transaction", 500);
  }
}

// DELETE /api/properties/[id]/transactions/[txId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  try {
    const { id, txId } = await params;
    const account = await getAccount();
    // Ensure the transaction belongs to a property owned by this account.
    const tx = await prisma.propertyTransaction.findFirst({
      where: { id: txId, propertyId: id, property: { accountId: account.id } },
    });
    if (!tx) return errorResponse("Transaction not found", 404);
    await prisma.propertyTransaction.delete({ where: { id: txId } });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete property transaction error:", error);
    return errorResponse("Failed to delete transaction", 500);
  }
}
