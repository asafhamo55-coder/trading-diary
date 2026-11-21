import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { hasAppCookie } from "@/lib/assistant-auth";
import { parseCreateQuestion } from "@/lib/assistant";
import { createQuestion, listQuestions } from "@/lib/assistant-data";

// /api/assistant/questions — the in-app "Ask" assistant (docs/assistant.md).
// App-password cookie only. Questions are answered asynchronously by the
// Claude Code routine (GET /api/assistant/pending → POST /api/assistant/answer).

// GET — the latest 50 questions, newest first.
export async function GET(req: NextRequest) {
  if (!(await hasAppCookie(req))) return errorResponse("Unauthorized", 401);
  try {
    return jsonResponse({ questions: await listQuestions(50) });
  } catch (error) {
    console.error("Assistant list error:", error);
    return errorResponse("Failed to load questions", 500);
  }
}

// POST { question, pagePath, pageTitle?, contextKeys? } — language is detected server-side.
export async function POST(req: NextRequest) {
  if (!(await hasAppCookie(req))) return errorResponse("Unauthorized", 401);
  try {
    const parsed = parseCreateQuestion(await req.json().catch(() => null));
    if ("error" in parsed) return errorResponse(parsed.error);
    return jsonResponse({ question: await createQuestion(parsed) }, 201);
  } catch (error) {
    console.error("Assistant create error:", error);
    return errorResponse("Failed to save question", 500);
  }
}
