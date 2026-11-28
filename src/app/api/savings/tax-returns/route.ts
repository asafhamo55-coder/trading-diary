import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { AUTH_COOKIE, expectedAuthCookie } from "@/lib/auth";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { TaxReturnError, parseTaxReturn } from "@/lib/tax-return-schema";
import { backfillPropertyBooks, listTaxReturns, upsertTaxReturn } from "@/lib/tax-return-data";

// Filed tax returns, extracted outside the app by the import-tax-return Claude
// Code skill (no PDFs, no PII — see tax-return-schema.ts).
//
// POST /api/savings/tax-returns  Bearer SAVINGS_INGEST_TOKEN, body = TaxReturnInput
//   → { row, replaced, skipped, backfill } — a full US-federal return also
//     rewrites that year's Schedule E rows in the property books.
// GET  /api/savings/tax-returns  app cookie → { returns }

export async function POST(req: NextRequest) {
  const auth = checkSavingsToken(req);
  if (auth !== "ok") return errorResponse(auth === "unconfigured" ? "SAVINGS_INGEST_TOKEN not configured" : "Unauthorized", auth === "unconfigured" ? 500 : 401);
  try {
    const input = parseTaxReturn(await req.json().catch(() => null));
    const result = await upsertTaxReturn(input);
    const backfill =
      !result.skipped && !input.partial && input.jurisdiction === "US-federal" ? await backfillPropertyBooks(input) : null;
    return jsonResponse({ ...result, backfill });
  } catch (error) {
    if (error instanceof TaxReturnError) return errorResponse(error.message, 422);
    console.error("Tax return ingest error:", error);
    return errorResponse("Failed to save tax return", 500);
  }
}

export async function GET(req: NextRequest) {
  const expected = await expectedAuthCookie();
  if (!expected || req.cookies.get(AUTH_COOKIE)?.value !== expected) return errorResponse("Unauthorized", 401);
  try {
    return jsonResponse({ returns: await listTaxReturns() });
  } catch (error) {
    console.error("Tax returns GET error:", error);
    return errorResponse("Failed to load tax returns", 500);
  }
}
