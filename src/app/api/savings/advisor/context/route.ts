import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { getHomeCashFlowSummary, getLatestAdvisorReport, getNetWorth, getProfile } from "@/lib/savings-data";
import { ADVISOR_OUTPUT_SCHEMA, ADVISOR_SYSTEM, buildAdvisorSnapshot, snapshotHash } from "@/lib/advisor";

// GET /api/savings/advisor/context — everything the daily Claude Code advisor
// routine needs to write a report: the household snapshot, its hash, the
// advisor brief and the output schema. Bearer SAVINGS_INGEST_TOKEN only.
export async function GET(req: NextRequest) {
  const auth = checkSavingsToken(req);
  if (auth !== "ok") return errorResponse(auth === "unconfigured" ? "SAVINGS_INGEST_TOKEN not configured" : "Unauthorized", auth === "unconfigured" ? 500 : 401);
  try {
    const [netWorth, profile, cashFlow] = await Promise.all([getNetWorth(), getProfile(), getHomeCashFlowSummary()]);
    const { coverage, ...nw } = netWorth;
    const snapshot = buildAdvisorSnapshot({ netWorth: nw, coverage, profile, cashFlow });
    const inputHash = snapshotHash(snapshot);
    const latest = await getLatestAdvisorReport();
    return jsonResponse({
      inputHash,
      unchangedSinceLastReport: latest?.inputHash === inputHash,
      latestReportAt: latest?.createdAt ?? null,
      system: ADVISOR_SYSTEM,
      outputSchema: ADVISOR_OUTPUT_SCHEMA,
      snapshot,
    });
  } catch (error) {
    console.error("Advisor context error:", error);
    return errorResponse("Failed to build advisor context", 500);
  }
}
