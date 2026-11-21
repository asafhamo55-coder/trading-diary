import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { createSavingsAccountSchema } from "@/lib/savings-validators";
import { createSavingsAccount, listSavingsAccounts } from "@/lib/savings-data";

// GET /api/savings/accounts[?includeArchived=1] — list savings accounts
export async function GET(req: NextRequest) {
  try {
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";
    return jsonResponse(await listSavingsAccounts(includeArchived));
  } catch (error) {
    console.error("List savings accounts error:", error);
    return errorResponse("Failed to list savings accounts", 500);
  }
}

// POST /api/savings/accounts — create a manual savings account
export async function POST(req: NextRequest) {
  try {
    const parsed = createSavingsAccountSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message);
    return jsonResponse(await createSavingsAccount(parsed.data), 201);
  } catch (error) {
    console.error("Create savings account error:", error);
    return errorResponse("Failed to create savings account", 500);
  }
}
