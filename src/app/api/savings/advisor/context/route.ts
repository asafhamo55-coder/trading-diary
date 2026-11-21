import { loadAdvisorPropertyRecords } from "@/lib/advisor-records";
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { getAdvisorActionStatuses, getHomeCashFlowSummary, getLatestAdvisorReport, getNetWorth, getProfile } from "@/lib/savings-data";
import { getGuidelineSummary } from "@/lib/guidelines-data";
import { getProperties } from "@/lib/property-data";
import { ADVISOR_OUTPUT_SCHEMA, ADVISOR_SYSTEM, buildAdvisorSnapshot, snapshotHash } from "@/lib/advisor";
import { previousOpportunityTitlesOf, previousRecommendationsOf, readAdvisorOutput } from "@/lib/advisor-report";

// GET /api/savings/advisor/context — everything the daily Claude Code advisor
// routine needs to write a report: the household snapshot, its hash, the
// advisor brief, the output schema (v2) and the previous report's
// recommendation ids + action items (with done flags) so the next report keeps
// ids and task wording stable, and the previous investment-idea titles so the
// "opportunities" theme rotates. Bearer SAVINGS_INGEST_TOKEN only.
export async function GET(req: NextRequest) {
  const auth = checkSavingsToken(req);
  if (auth !== "ok") return errorResponse(auth === "unconfigured" ? "SAVINGS_INGEST_TOKEN not configured" : "Unauthorized", auth === "unconfigured" ? 500 : 401);
  try {
    const [netWorth, profile, cashFlow, properties] = await Promise.all([getNetWorth(), getProfile(), getHomeCashFlowSummary(), getProperties()]);
    const { coverage, ...nw } = netWorth;
    // The trading account's standing allocation rules (SPY/QQQ/large caps/cash)
    // ride along so the advisor can comment on drift and dip signals.
    const snapshot = {
      ...buildAdvisorSnapshot({ netWorth: nw, coverage, profile, cashFlow, properties, propertyRecords: await loadAdvisorPropertyRecords() }),
      tradingGuidelines: await getGuidelineSummary(),
    };
    const inputHash = snapshotHash(snapshot);
    const [latest, statuses] = await Promise.all([getLatestAdvisorReport(), getAdvisorActionStatuses().catch(() => ({}))]);
    const previous = readAdvisorOutput(latest?.output);
    return jsonResponse({
      inputHash,
      unchangedSinceLastReport: latest?.inputHash === inputHash,
      latestReportAt: latest?.createdAt ?? null,
      system: ADVISOR_SYSTEM,
      outputSchema: ADVISOR_OUTPUT_SCHEMA,
      snapshot,
      // Not part of the snapshot hash: ticking items doesn't force a re-run.
      previousRecommendations: previousRecommendationsOf(previous, statuses),
      // Investment ideas already suggested last time — rotate unless something changed.
      previousOpportunityTitles: previousOpportunityTitlesOf(previous),
    });
  } catch (error) {
    console.error("Advisor context error:", error);
    return errorResponse("Failed to build advisor context", 500);
  }
}
