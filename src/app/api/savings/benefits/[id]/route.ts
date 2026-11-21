import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { updateBenefitSchema } from "@/lib/savings-validators";
import { deleteBenefit, updateBenefit } from "@/lib/savings-data";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/savings/benefits/:id — partial update (archived: true|false to archive)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const parsed = updateBenefitSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message);
    const updated = await updateBenefit(id, parsed.data);
    if (!updated) return errorResponse("Benefit not found", 404);
    return jsonResponse(updated);
  } catch (error) {
    console.error("Update benefit error:", error);
    return errorResponse("Failed to update benefit", 500);
  }
}

// DELETE /api/savings/benefits/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!(await deleteBenefit(id))) return errorResponse("Benefit not found", 404);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete benefit error:", error);
    return errorResponse("Failed to delete benefit", 500);
  }
}
