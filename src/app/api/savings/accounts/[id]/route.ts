import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { updateSavingsAccountSchema } from "@/lib/savings-validators";
import { deleteSavingsAccount, getSavingsAccount, updateSavingsAccount } from "@/lib/savings-data";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/savings/accounts/:id — one account with its balance history
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const acct = await getSavingsAccount(id);
    if (!acct) return errorResponse("Savings account not found", 404);
    return jsonResponse(acct);
  } catch (error) {
    console.error("Get savings account error:", error);
    return errorResponse("Failed to load savings account", 500);
  }
}

// PATCH /api/savings/accounts/:id — partial update (archived: true|false to archive)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const parsed = updateSavingsAccountSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message);
    const updated = await updateSavingsAccount(id, parsed.data);
    if (!updated) return errorResponse("Savings account not found", 404);
    return jsonResponse(updated);
  } catch (error) {
    console.error("Update savings account error:", error);
    return errorResponse("Failed to update savings account", 500);
  }
}

// DELETE /api/savings/accounts/:id — permanently delete (snapshots cascade)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!(await deleteSavingsAccount(id))) return errorResponse("Savings account not found", 404);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete savings account error:", error);
    return errorResponse("Failed to delete savings account", 500);
  }
}
