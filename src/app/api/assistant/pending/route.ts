import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { getPendingBundle } from "@/lib/assistant-data";

export const maxDuration = 60;

// GET /api/assistant/pending — for the answer-questions Claude Code routine
// (.claude/skills/answer-questions). Returns { generatedAt, count, questions,
// data } where data holds the advisor household snapshot, the glossary entries,
// properties, savings accounts and trading-guidelines status the questions
// reference (data is null when count is 0). Bearer SAVINGS_INGEST_TOKEN only;
// listed in PUBLIC_PATHS in src/proxy.ts.
export async function GET(req: NextRequest) {
  const auth = checkSavingsToken(req);
  if (auth !== "ok") return errorResponse(auth === "unconfigured" ? "SAVINGS_INGEST_TOKEN not configured" : "Unauthorized", auth === "unconfigured" ? 500 : 401);
  try {
    return jsonResponse(await getPendingBundle());
  } catch (error) {
    console.error("Assistant pending error:", error);
    return errorResponse("Failed to build pending bundle", 500);
  }
}
