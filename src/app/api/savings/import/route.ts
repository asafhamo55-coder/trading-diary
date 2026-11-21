import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { AUTH_COOKIE, expectedAuthCookie } from "@/lib/auth";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { householdBundleSchema, savingsImportSchema } from "@/lib/savings-validators";
import { importHouseholdBundle, importSavingsDoc } from "@/lib/savings-data";

export const maxDuration = 60;

// POST /api/savings/import — accepts either:
//  - the Israeli PDF-extract JSON ({ asOf, people, ... }): upserts accounts by
//    owner+provider+type+policy last-4, appends a snapshot per statement date,
//    upserts coverages as Benefit rows; or
//  - a household bundle ({ israel?, accounts?, benefits?, profile? }) that
//    loads everything in one go (see householdBundleSchema).
//
// Auth: this path is in PUBLIC_PATHS (src/proxy.ts) so machine callers can
// reach it, which means the route enforces auth itself. Either
//  - the app-password cookie (browser upload at /savings/import), or
//  - `Authorization: Bearer $SAVINGS_INGEST_TOKEN` (the import-statements
//    Claude Code skill via scripts/savings/post-bundle.ts).
// See docs/savings/pdf-import.md.
async function authorized(req: NextRequest): Promise<boolean> {
  const expected = await expectedAuthCookie();
  if (expected && req.cookies.get(AUTH_COOKIE)?.value === expected) return true;
  return checkSavingsToken(req) === "ok";
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return errorResponse("Unauthorized", 401);
  try {
    const body = await req.json();
    const isBundle = body && typeof body === "object" && !("people" in body);
    if (isBundle) {
      const parsed = householdBundleSchema.safeParse(body);
      if (!parsed.success) return errorResponse(parsed.error.message);
      return jsonResponse(await importHouseholdBundle(parsed.data));
    }
    const parsed = savingsImportSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    return jsonResponse(await importSavingsDoc(parsed.data));
  } catch (error) {
    console.error("Savings import error:", error);
    return errorResponse(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`, 500);
  }
}
