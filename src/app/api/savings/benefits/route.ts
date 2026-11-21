import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { createBenefitSchema } from "@/lib/savings-validators";
import { createBenefit, getFxRate, getProfile, listBenefits } from "@/lib/savings-data";
import { findCoverageOverlaps } from "@/lib/savings";

// GET /api/savings/benefits[?includeArchived=1] — benefits + coverage overlaps/gaps
export async function GET(req: NextRequest) {
  try {
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";
    const [benefits, profile] = await Promise.all([listBenefits(includeArchived), getProfile()]);
    const fx = await getFxRate(profile);
    return jsonResponse({ benefits, coverage: findCoverageOverlaps(benefits, profile.members, fx) });
  } catch (error) {
    console.error("List benefits error:", error);
    return errorResponse("Failed to list benefits", 500);
  }
}

// POST /api/savings/benefits — add an insurance / employer benefit
export async function POST(req: NextRequest) {
  try {
    const parsed = createBenefitSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message);
    return jsonResponse(await createBenefit(parsed.data), 201);
  } catch (error) {
    console.error("Create benefit error:", error);
    return errorResponse("Failed to create benefit", 500);
  }
}
