import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updateHomeCategorySchema } from "@/lib/home-validators";

async function owned(id: string, accountId: string) {
  return prisma.homeCategory.findFirst({ where: { id, accountId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    if (!(await owned(id, account.id))) return errorResponse("Category not found", 404);

    const body = await req.json();
    const parsed = updateHomeCategorySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const updated = await prisma.homeCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    });
    return jsonResponse(updated);
  } catch (error) {
    console.error("Update home category error:", error);
    return errorResponse("Failed to update category", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    if (!(await owned(id, account.id))) return errorResponse("Category not found", 404);
    // Children cascade; transactions' categoryId is set null by the FK.
    await prisma.homeCategory.delete({ where: { id } });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete home category error:", error);
    return errorResponse("Failed to delete category", 500);
  }
}
