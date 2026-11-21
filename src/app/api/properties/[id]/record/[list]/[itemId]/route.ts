import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api-helpers";
import { RECORD_LISTS } from "@/lib/property-profile";
import {
  delegateFor,
  isRecordList,
  ownedProperty,
  syncMortgageFromLoans,
  toDbData,
  toDto,
} from "@/lib/property-record-server";

type Ctx = { params: Promise<{ id: string; list: string; itemId: string }> };

async function resolve(ctx: Ctx) {
  const { id, list, itemId } = await ctx.params;
  if (!isRecordList(list)) return { error: errorResponse("Unknown list", 404) } as const;
  const property = await ownedProperty(id);
  if (!property) return { error: errorResponse("Property not found", 404) } as const;
  const existing = await delegateFor(list).findFirst({ where: { id: itemId, propertyId: id } });
  if (!existing) return { error: errorResponse("Not found", 404) } as const;
  return { id, list, itemId } as const;
}

// PATCH /api/properties/[id]/record/[list]/[itemId] — update fields of one item.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const r = await resolve(ctx);
    if ("error" in r) return r.error;
    // Partial update: only the fields sent are validated and written.
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = RECORD_LISTS[r.list].partial().safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const data = Object.fromEntries(
      Object.entries(parsed.data as Record<string, unknown>).filter(([k]) => k in body)
    );
    const row = await delegateFor(r.list).update({ where: { id: r.itemId }, data: toDbData(r.list, data) });
    if (r.list === "loans") await syncMortgageFromLoans(r.id);
    return jsonResponse(toDto(r.list, row));
  } catch (error) {
    console.error("Update record item error:", error);
    return errorResponse("Failed to save", 500);
  }
}

// DELETE /api/properties/[id]/record/[list]/[itemId]
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const r = await resolve(ctx);
    if ("error" in r) return r.error;
    await delegateFor(r.list).delete({ where: { id: r.itemId } });
    if (r.list === "loans") await syncMortgageFromLoans(r.id);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete record item error:", error);
    return errorResponse("Failed to delete", 500);
  }
}
