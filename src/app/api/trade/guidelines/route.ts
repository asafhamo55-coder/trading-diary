import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { guidelineConfigSchema, type GuidelineConfig } from "@/lib/guidelines";
import { getGuidelineConfig, saveGuidelineConfig } from "@/lib/guidelines-data";

export const dynamic = "force-dynamic";

// GET /api/trade/guidelines — the stocks-account guideline config (defaults until saved)
export async function GET() {
  try {
    return jsonResponse(await getGuidelineConfig());
  } catch (error) {
    console.error("Get guidelines error:", error);
    return errorResponse("Failed to load guidelines", 500);
  }
}

// PUT /api/trade/guidelines — replace the config (full GuidelineConfig, zod-validated)
export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Body must be JSON");
  }
  const parsed = guidelineConfigSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.message);
  try {
    return jsonResponse(await saveGuidelineConfig(parsed.data as GuidelineConfig));
  } catch (error) {
    console.error("Save guidelines error:", error);
    return errorResponse("Failed to save guidelines", 500);
  }
}
