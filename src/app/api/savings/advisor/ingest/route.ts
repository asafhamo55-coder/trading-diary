import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { saveAdvisorReport } from "@/lib/savings-data";
import { getProperties } from "@/lib/property-data";
import { AdvisorError, parseAdvisorOutput } from "@/lib/advisor";

// POST /api/savings/advisor/ingest — saves a report written outside the app by
// the daily Claude Code routine (runs on the user's Claude subscription, so no
// API cost). Body: { output: AdvisorOutput, inputHash, snapshot?, model? }.
// Bearer SAVINGS_INGEST_TOKEN only.
export async function POST(req: NextRequest) {
  const auth = checkSavingsToken(req);
  if (auth !== "ok") return errorResponse(auth === "unconfigured" ? "SAVINGS_INGEST_TOKEN not configured" : "Unauthorized", auth === "unconfigured" ? 500 : 401);
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.inputHash !== "string") return errorResponse("Body needs output and inputHash");
    // Every active US rental must get at least one property-level recommendation.
    const rentals = (await getProperties()).filter((p) => !p.archivedAt && p.usage !== "residence").map((p) => p.id);
    const output = parseAdvisorOutput(JSON.stringify(body.output ?? null), { requiredPropertyIds: rentals });
    const model = typeof body.model === "string" && body.model ? body.model.slice(0, 60) : "claude-code";
    const report = await saveAdvisorReport({
      model,
      inputHash: body.inputHash,
      snapshot: body.snapshot ?? {},
      output,
      usage: { source: "claude-code-routine", estCostUsd: 0 },
    });
    return jsonResponse({ report });
  } catch (error) {
    if (error instanceof AdvisorError) return errorResponse(error.message, 422);
    console.error("Advisor ingest error:", error);
    return errorResponse("Failed to save advisor report", 500);
  }
}
