import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { getHomeInsights, getHomeYears } from "@/lib/home-data";
import { getPropertyYearNet } from "@/lib/property-data";
import { buildCopilotContext } from "@/lib/home-coach";
import { llmChat, hasLLMKey, cleanHistory } from "@/lib/llm";

export const maxDuration = 30;

const SYSTEM = `You are the Hamo Home co-pilot — a sharp, friendly personal-finance advisor embedded in the user's household finance app. Your single goal is to help them improve their home profitability: spend less, save more, and generate more cash for the home.

Rules:
- Ground every answer in the FINANCIAL SNAPSHOT provided. Cite the user's real numbers.
- Be concise and concrete. Prefer specific, actionable steps with dollar estimates and a clear "so what".
- Amounts are USD. Transfers and credit-card payments are already excluded from spending, so don't double-count them.
- Never invent transactions, merchants, or figures not present in the snapshot. If the data can't answer, say so briefly and suggest what to start tracking.
- Format with short paragraphs or tight bullet points. No preamble.`;

// POST /api/home/copilot — ask the co-pilot a question about your finances.
export async function POST(req: NextRequest) {
  try {
    if (!hasLLMKey()) {
      return jsonResponse({
        needsKey: true,
        message:
          "No AI key configured. Add a free GEMINI_API_KEY (or GROQ_API_KEY) in Vercel and redeploy.",
      });
    }

    const body = await req.json();
    const question: string = (body?.question ?? "").toString().slice(0, 2000);
    const history = cleanHistory(body?.history);
    if (!question.trim()) return errorResponse("Ask a question");

    // Build fresh, server-side context from the user's own data.
    await getAccount();
    const years = await getHomeYears();
    const year = years[0] ?? new Date().getFullYear();
    const [insights, propertyNet] = await Promise.all([
      getHomeInsights(year),
      getPropertyYearNet(year),
    ]);
    const system = `${SYSTEM}\n\n=== FINANCIAL SNAPSHOT ===\n${buildCopilotContext(insights, year, propertyNet)}`;

    const answer = await llmChat(system, history, question);
    if (!answer) return errorResponse("The model returned an empty response. Try rephrasing.", 502);
    return jsonResponse({ answer });
  } catch (error) {
    console.error("Copilot error:", error);
    return errorResponse(
      `Co-pilot failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
