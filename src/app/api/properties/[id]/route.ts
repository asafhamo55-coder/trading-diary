import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updatePropertySchema } from "@/lib/validators";
import { composeAddress } from "@/lib/property";

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

    // If any address part changed, recompose the single-line address + label
    // from the merged (existing + incoming) parts.
    const partKeys = ["street", "unit", "city", "state", "zip", "address"] as const;
    const addressTouched = partKeys.some((k) => data[k] !== undefined);
    const pick = (k: (typeof partKeys)[number]) =>
      data[k] !== undefined ? data[k] : (existing as Record<string, unknown>)[k];
    const merged = {
      street: pick("street") as string | null,
      unit: pick("unit") as string | null,
      city: pick("city") as string | null,
      state: pick("state") as string | null,
      zip: pick("zip") as string | null,
    };
    const composed = composeAddress(merged);
    const address =
      (data.address ?? "").trim() ? (data.address as string).trim() : composed || existing.address;
    const nickname = (merged.street ?? "").trim() || address || existing.nickname;

    const property = await prisma.property.update({
      where: { id },
      data: {
        ...(data.street !== undefined ? { street: data.street } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.state !== undefined ? { state: data.state } : {}),
        ...(data.zip !== undefined ? { zip: data.zip } : {}),
        ...(addressTouched ? { address, nickname } : {}),
        ...(data.purchasePrice !== undefined ? { purchasePrice: data.purchasePrice } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.archived !== undefined
          ? { archivedAt: data.archived ? new Date() : null }
          : {}),
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
