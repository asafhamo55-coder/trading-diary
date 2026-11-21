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

// POST /api/properties/[id]/record/[list] — add a loan, improvement,
// maintenance entry, document link or utility account.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; list: string }> }) {
  try {
    const { id, list } = await params;
    if (!isRecordList(list)) return errorResponse("Unknown list", 404);
    const property = await ownedProperty(id);
    if (!property) return errorResponse("Property not found", 404);

    const parsed = RECORD_LISTS[list].safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return errorResponse(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

    const row = await delegateFor(list).create({
      data: { ...toDbData(list, parsed.data as Record<string, unknown>), propertyId: id },
    });
    if (list === "loans") await syncMortgageFromLoans(id);
    return jsonResponse(toDto(list, row), 201);
  } catch (error) {
    console.error("Create record item error:", error);
    return errorResponse("Failed to save", 500);
  }
}
