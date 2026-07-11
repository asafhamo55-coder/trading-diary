import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { getHomeInsights, getHomeYears } from "@/lib/home-data";
import { getPropertyYearNet } from "@/lib/property-data";
import { buildCopilotContext } from "@/lib/home-coach";

export const maxDuration = 30;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are the Hamo Home co-pilot — a sharp, friendly personal-finance advisor embedded in the user's household finance app. Your single goal is to help them improve their home profitability: spend less, save more, and generate more cash for the home.

Rules:
- Ground every answer in the FINANCIAL SNAPSHOT provided. Cite the user's real numbers.
- Be concise and concrete. Prefer specific, actionable steps with dollar estimates and a clear "so what".
- Amounts are USD. Transfers and credit-card payments are already excluded from spending, so don't double-count them.
- Never invent transactions, merchants, or figures not present in the snapshot. If the data can't answer, say so briefly and suggest what to start tracking.
- Format with short paragraphs or tight bullet points. No preamble.`;

function detectProvider(): { provider: "gemini" | "groq"; key: string } | null {
  if (process.env.GEMINI_API_KEY) return { provider: "gemini", key: process.env.GEMINI_API_KEY };
  if (process.env.GROQ_API_KEY) return { provider: "groq", key: process.env.GROQ_API_KEY };
  return null;
}

async function callGemini(key: string, system: string, history: ChatMsg[], question: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

async function callGroq(key: string, system: string, history: ChatMsg[], question: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: question },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

// POST /api/home/copilot — ask the co-pilot a question about your finances.
export async function POST(req: NextRequest) {
  try {
    const found = detectProvider();
    if (!found) {
      return jsonResponse({
        needsKey: true,
        message:
          "No AI key configured. Add a free GEMINI_API_KEY (or GROQ_API_KEY) in Vercel and redeploy.",
      });
    }

    const body = await req.json();
    const question: string = (body?.question ?? "").toString().slice(0, 2000);
    const history: ChatMsg[] = Array.isArray(body?.history)
      ? body.history
          .slice(-8)
          .filter((m: ChatMsg) => m && (m.role === "user" || m.role === "assistant") && m.content)
          .map((m: ChatMsg) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      : [];
    if (!question.trim()) return errorResponse("Ask a question");

    // Build fresh, server-side context from the user's own data.
    await getAccount();
    const years = await getHomeYears();
    const year = years[0] ?? new Date().getFullYear();
    const [insights, propertyNet] = await Promise.all([
      getHomeInsights(year),
      getPropertyYearNet(year),
    ]);
    const context = buildCopilotContext(insights, year, propertyNet);
    const system = `${SYSTEM}\n\n=== FINANCIAL SNAPSHOT ===\n${context}`;

    const answer =
      found.provider === "gemini"
        ? await callGemini(found.key, system, history, question)
        : await callGroq(found.key, system, history, question);

    if (!answer) return errorResponse("The model returned an empty response. Try rephrasing.", 502);
    return jsonResponse({ answer, provider: found.provider });
  } catch (error) {
    console.error("Copilot error:", error);
    return errorResponse(
      `Co-pilot failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
