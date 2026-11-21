import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { checkSavingsToken } from "@/lib/ingest-auth";
import { parseAnswer } from "@/lib/assistant";
import { saveAnswer } from "@/lib/assistant-data";

// POST /api/assistant/answer { id, answer, status?: "answered" | "failed", answeredBy? }
// — the answer-questions Claude Code routine posts a markdown answer, or a
// failure reason with status "failed". Bearer SAVINGS_INGEST_TOKEN only;
// listed in PUBLIC_PATHS in src/proxy.ts.
export async function POST(req: NextRequest) {
  const auth = checkSavingsToken(req);
  if (auth !== "ok") return errorResponse(auth === "unconfigured" ? "SAVINGS_INGEST_TOKEN not configured" : "Unauthorized", auth === "unconfigured" ? 500 : 401);
  try {
    const parsed = parseAnswer(await req.json().catch(() => null));
    if ("error" in parsed) return errorResponse(parsed.error, 422);
    const question = await saveAnswer(parsed);
    if (!question) return errorResponse("Question not found", 404);
    return jsonResponse({ question });
  } catch (error) {
    console.error("Assistant answer error:", error);
    return errorResponse("Failed to save answer", 500);
  }
}
