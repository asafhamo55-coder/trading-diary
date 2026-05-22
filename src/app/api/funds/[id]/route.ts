import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";

// DELETE /api/funds/[id] — delete a fund transaction
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    const existing = await prisma.fundTransaction.findUnique({ where: { id } });
    if (!existing || existing.accountId !== account.id) {
      return errorResponse("Not found", 404);
    }
    await prisma.fundTransaction.delete({ where: { id } });
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(
      `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
