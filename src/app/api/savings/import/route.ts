import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { householdBundleSchema, savingsImportSchema } from "@/lib/savings-validators";
import { importHouseholdBundle, importSavingsDoc } from "@/lib/savings-data";

export const maxDuration = 60;

// POST /api/savings/import — accepts either:
//  - the Israeli PDF-extract JSON ({ asOf, people, ... }): upserts accounts by
//    owner+provider+type+policy last-4, appends a snapshot per statement date,
//    upserts coverages as Benefit rows; or
//  - a household bundle ({ israel?, accounts?, benefits?, profile? }) that
//    loads everything in one go (see householdBundleSchema).
export async function POST(req: NextRequest) {
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
