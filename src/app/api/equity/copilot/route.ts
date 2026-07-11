import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { getMonthlyTradeRevExp } from "@/lib/data";
import { getPropertyMonthlyRevExp } from "@/lib/property-data";
import { getHomeMonthlyRevExp, getHomeYears } from "@/lib/home-data";
import { agg, buildEquityContext, type EquityData } from "@/lib/equity-coach";
import { llmChat, hasLLMKey, cleanHistory } from "@/lib/llm";

export const maxDuration = 30;

const SYSTEM = `You are the Hamo Home Equity co-pilot — a sharp wealth advisor sitting on top of the user's consolidated finances across three modules: Trade (trading P&L), Properties (rentals) and Home (household spending). Your goal is to help them grow total net equity: keep more of what comes in, and generate more cash.

Rules:
- Ground every answer in the CONSOLIDATED SNAPSHOT provided; cite the user's real numbers per module.
- Be concise and concrete with dollar estimates and a clear next step. Point them to the right module (Home for spending, Properties for rentals, Trade for trading) when useful.
- Never invent figures not in the snapshot. If it can't answer, say so and suggest what to track.
- Short paragraphs or tight bullets. No preamble.`;

export async function POST(req: NextRequest) {
  try {
    if (!hasLLMKey()) {
      return jsonResponse({
        needsKey: true,
        message: "No AI key configured. Add a free GEMINI_API_KEY (or GROQ_API_KEY) in Vercel and redeploy.",
      });
    }
    const body = await req.json();
    const question: string = (body?.question ?? "").toString().slice(0, 2000);
    const history = cleanHistory(body?.history);
    if (!question.trim()) return errorResponse("Ask a question");

    const years = await getHomeYears();
    const year = years[0] ?? new Date().getFullYear();
    const [tradeM, propM, homeM] = await Promise.all([
      getMonthlyTradeRevExp(year),
      getPropertyMonthlyRevExp(year),
      getHomeMonthlyRevExp(year),
    ]);
    const monthly = tradeM.map((m, i) => ({
      name: m.name,
      net:
        m.revenue - m.expense +
        ((propM[i]?.revenue ?? 0) - (propM[i]?.expense ?? 0)) +
        ((homeM[i]?.revenue ?? 0) - (homeM[i]?.expense ?? 0)),
    }));
    const data: EquityData = {
      trade: agg(tradeM),
      properties: agg(propM),
      home: agg(homeM),
      monthly,
      year,
    };
    const system = `${SYSTEM}\n\n=== CONSOLIDATED SNAPSHOT ===\n${buildEquityContext(data)}`;

    const answer = await llmChat(system, history, question);
    if (!answer) return errorResponse("The model returned an empty response. Try rephrasing.", 502);
    return jsonResponse({ answer });
  } catch (error) {
    console.error("Equity copilot error:", error);
    return errorResponse(
      `Co-pilot failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
