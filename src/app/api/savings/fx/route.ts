import { jsonResponse } from "@/lib/api-helpers";
import { getFxRateSafe } from "@/lib/savings-data";
import { DEFAULT_USD_ILS_RATE } from "@/lib/savings";

// GET /api/savings/fx — the USD→ILS rate the app is using right now:
// profile override → live (Bank of Israel, then Frankfurter; cached ~6h) → env → default.
// Always 200: a failed lookup degrades to the default rather than erroring.
export async function GET() {
  try {
    const fx = await getFxRateSafe();
    return jsonResponse({ usdIls: fx.usdIls, source: fx.source, provider: fx.provider ?? null, asOf: fx.asOf ?? null });
  } catch (error) {
    console.error("FX rate error:", error);
    return jsonResponse({ usdIls: DEFAULT_USD_ILS_RATE, source: "default", provider: null, asOf: null });
  }
}
