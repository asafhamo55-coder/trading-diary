// Shared free-LLM client. Provider-agnostic: uses a GEMINI_API_KEY or a
// GROQ_API_KEY from the environment (both have free tiers), whichever is set.

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export function detectProvider(): { provider: "gemini" | "groq"; key: string } | null {
  if (process.env.GEMINI_API_KEY) return { provider: "gemini", key: process.env.GEMINI_API_KEY };
  if (process.env.GROQ_API_KEY) return { provider: "groq", key: process.env.GROQ_API_KEY };
  return null;
}

export function hasLLMKey(): boolean {
  return detectProvider() !== null;
}

async function callGemini(key: string, system: string, history: ChatMsg[], question: string) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
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

/** Run a chat completion. Throws if no provider key is configured. */
export async function llmChat(system: string, history: ChatMsg[], question: string): Promise<string> {
  const found = detectProvider();
  if (!found) throw new Error("No LLM provider key configured");
  return found.provider === "gemini"
    ? callGemini(found.key, system, history, question)
    : callGroq(found.key, system, history, question);
}

/** Sanitise inbound chat history from the client. */
export function cleanHistory(raw: unknown): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-8)
    .filter((m): m is ChatMsg => !!m && (m.role === "user" || m.role === "assistant") && !!m.content)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
}
