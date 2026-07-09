import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updateHomeAccountSchema } from "@/lib/home-validators";

async function owned(id: string, accountId: string) {
  return prisma.homeAccount.findFirst({ where: { id, accountId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    if (!(await owned(id, account.id))) return errorResponse("Account not found", 404);

    const body = await req.json();
    const parsed = updateHomeAccountSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const updated = await prisma.homeAccount.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.last4 !== undefined ? { last4: data.last4 || null } : {}),
        ...(data.archived !== undefined
          ? { archivedAt: data.archived ? new Date() : null }
          : {}),
      },
    });
    return jsonResponse(updated);
  } catch (error) {
    console.error("Update home account error:", error);
    return errorResponse("Failed to update account", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    if (!(await owned(id, account.id))) return errorResponse("Account not found", 404);
    // Cascades to its transactions and imports.
    await prisma.homeAccount.delete({ where: { id } });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete home account error:", error);
    return errorResponse("Failed to delete account", 500);
  }
}
