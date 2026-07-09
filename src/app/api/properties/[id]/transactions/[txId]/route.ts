import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";

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
