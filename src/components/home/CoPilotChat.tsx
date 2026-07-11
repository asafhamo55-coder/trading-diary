"use client";

import { useRef, useState } from "react";
import { Send, Loader2, Bot, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/** Reusable co-pilot chat panel. `endpoint` returns { answer } or { needsKey }. */
export default function CoPilotChat({
  endpoint,
  suggestions,
  accent,
  aiConfigured,
  title = "Co-pilot",
  subtitle = "Ask anything about your money",
}: {
  endpoint: string;
  suggestions: string[];
  accent: string;
  aiConfigured: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(!aiConfigured);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.needsKey) {
        setNeedsKey(true);
        setMessages((m) => m.slice(0, -1));
        return;
      }
      if (!res.ok || !data?.answer) throw new Error(data?.error || "The co-pilot couldn't answer.");
      setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The co-pilot couldn't answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: `${accent}1F` }}>
          <Bot className="w-4 h-4" style={{ color: accent }} />
        </span>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        <span className="text-xs text-[var(--muted-foreground)] ml-auto">{subtitle}</span>
      </div>

      {needsKey ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--muted)] mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-[var(--muted-foreground)]" />
          </span>
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">Connect a free AI key</h4>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto mb-2">
            The co-pilot runs on a free LLM. Add a <span className="font-medium text-[var(--foreground)]">GEMINI_API_KEY</span> (from{" "}
            <a className="underline" style={{ color: accent }} href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>){" "}
            or a <span className="font-medium text-[var(--foreground)]">GROQ_API_KEY</span> in your Vercel project&apos;s environment variables, then redeploy.
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Your finance summary is sent to that provider to answer questions.</p>
        </div>
      ) : (
        <>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="pressable text-xs rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  style={{ ["--tw-border-opacity" as string]: "1" }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={scrollRef} className="space-y-3 max-h-[420px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user" ? "text-[#0C0F14] font-medium" : "bg-[var(--muted)] text-[var(--foreground)]"
                  )}
                  style={m.role === "user" ? { background: accent } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[var(--muted)] px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-[#FF4D6A] mt-3">{error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-4 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your co-pilot…"
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="pressable flex items-center justify-center w-11 h-11 rounded-xl text-[#0C0F14] shadow-sm disabled:opacity-50"
              style={{ background: accent }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
