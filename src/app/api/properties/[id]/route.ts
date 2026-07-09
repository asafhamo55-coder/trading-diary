import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updatePropertySchema } from "@/lib/validators";

async function ownedProperty(id: string) {
  const account = await getAccount();
  return prisma.property.findFirst({ where: { id, accountId: account.id } });
}

// GET /api/properties/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    const property = await prisma.property.findFirst({
      where: { id, accountId: account.id },
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    if (!property) return errorResponse("Property not found", 404);
    return jsonResponse(property);
  } catch (error) {
    console.error("Fetch property error:", error);
    return errorResponse("Failed to fetch property", 500);
  }
}

// PATCH /api/properties/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await ownedProperty(id);
    if (!existing) return errorResponse("Property not found", 404);

    const body = await req.json();
    const parsed = updatePropertySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const property = await prisma.property.update({
      where: { id },
      data: {
        ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.purchasePrice !== undefined ? { purchasePrice: data.purchasePrice } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    return jsonResponse(property);
  } catch (error) {
    console.error("Update property error:", error);
    return errorResponse("Failed to update property", 500);
  }
}

// DELETE /api/properties/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await ownedProperty(id);
    if (!existing) return errorResponse("Property not found", 404);
    await prisma.property.delete({ where: { id } });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete property error:", error);
    return errorResponse("Failed to delete property", 500);
  }
}
