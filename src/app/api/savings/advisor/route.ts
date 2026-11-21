import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { advisorRequestSchema } from "@/lib/savings-validators";
import {
  getHomeCashFlowSummary,
  getLatestAdvisorReport,
  getNetWorth,
  getProfile,
  saveAdvisorReport,
} from "@/lib/savings-data";
import {
  ADVISOR_MODEL,
  AdvisorError,
  buildAdvisorSnapshot,
  generateAdvice,
  hasAnthropicKey,
  snapshotHash,
} from "@/lib/advisor";

// Fable at high effort over a large snapshot can take minutes.
export const maxDuration = 300;

const NEEDS_KEY = {
  needsKey: true,
  message: "No Anthropic key configured. Add ANTHROPIC_API_KEY in Vercel and redeploy.",
};

// GET /api/savings/advisor — latest saved report (no model call)
export async function GET() {
  try {
    const report = await getLatestAdvisorReport();
    return jsonResponse({ report, hasKey: hasAnthropicKey() });
  } catch (error) {
    console.error("Get advisor report error:", error);
    return errorResponse("Failed to load advisor report", 500);
  }
}

// POST /api/savings/advisor { force?: boolean } — generate (or reuse cached) report
export async function POST(req: NextRequest) {
  try {
    if (!hasAnthropicKey()) return jsonResponse(NEEDS_KEY);
    const body = await req.json().catch(() => ({}));
    const parsed = advisorRequestSchema.safeParse(body ?? {});
    if (!parsed.success) return errorResponse(parsed.error.message);

    const [netWorth, profile, cashFlow] = await Promise.all([getNetWorth(), getProfile(), getHomeCashFlowSummary()]);
    const { coverage, ...nw } = netWorth;
    const snapshot = buildAdvisorSnapshot({ netWorth: nw, coverage, profile, cashFlow });
    const inputHash = snapshotHash(snapshot);

    if (!parsed.data.force) {
      const cached = await getLatestAdvisorReport(inputHash);
      if (cached) return jsonResponse({ report: cached, cached: true });
    }

    const { output, usage } = await generateAdvice(snapshot);
    const report = await saveAdvisorReport({ model: ADVISOR_MODEL, inputHash, snapshot, output, usage });
    return jsonResponse({ report, cached: false });
  } catch (error) {
    if (error instanceof AdvisorError) {
      return errorResponse(error.message, error.kind === "refusal" ? 422 : 502);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Advisor API error:", error.status, error.message);
      return errorResponse(`Advisor API error (${error.status ?? "network"}): ${error.message}`, 502);
    }
    console.error("Advisor error:", error);
    return errorResponse(`Advisor failed: ${error instanceof Error ? error.message : "Unknown error"}`, 500);
  }
}
