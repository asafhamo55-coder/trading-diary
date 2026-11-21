import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { getGuidelineStatus } from "@/lib/guidelines-data";

export const dynamic = "force-dynamic";

// GET /api/trade/guidelines/status — buckets vs targets, action plan, dip
// signals, outside-the-rules positions, plus the quotes used and their timestamps.
export async function GET() {
  try {
    return jsonResponse(await getGuidelineStatus());
  } catch (error) {
    console.error("Guidelines status error:", error);
    return errorResponse("Failed to compute guideline status", 500);
  }
}
