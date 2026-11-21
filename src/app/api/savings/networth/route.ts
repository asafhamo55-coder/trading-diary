import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { getNetWorth } from "@/lib/savings-data";

// GET /api/savings/networth — consolidated household net worth for the dashboard
export async function GET() {
  try {
    return jsonResponse(await getNetWorth());
  } catch (error) {
    console.error("Net worth error:", error);
    return errorResponse("Failed to compute net worth", 500);
  }
}
