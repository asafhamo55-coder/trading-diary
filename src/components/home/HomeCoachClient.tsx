"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Wallet,
  PiggyBank,
  Send,
  Loader2,
  Bot,
  KeyRound,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import YearPicker from "@/components/layout/YearPicker";
import type { Recommendation, CoachSummary } from "@/lib/home-coach";

const KIND_META: Record<
  Recommendation["kind"],
  { color: string; icon: React.ReactNode; label: string }
> = {
  reduce: { color: "#FF4D6A", icon: <TrendingDown className="w-4 h-4" />, label: "Cut spend" },
  grow: { color: "#00D68F", icon: <TrendingUp className="w-4 h-4" />, label: "Grow savings" },
  watch: { color: "#FFB547", icon: <AlertTriangle className="w-4 h-4" />, label: "Watch" },
  win: { color: "#3B82F6", icon: <Trophy className="w-4 h-4" />, label: "Win" },
};

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Where can I save the most each month?",
  "Which subscriptions should I cancel?",
  "How do I reach a 20% savings rate?",
  "What changed in my spending recently?",
];

export default function HomeCoachClient({
  summary,
  recommendations,
  hasData,
  year,
  availableYears,
  aiConfigured,
}: {
  summary: CoachSummary;
  recommendations: Recommendation[];
  hasData: boolean;
  year: number;
  availableYears: number[];
  aiConfigured: boolean;
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
      const res = await fetch("/api/home/copilot", {
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
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/home"
            className="pressable inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00D68F]/12">
              <Sparkles className="w-4.5 h-4.5 text-[#00D68F]" />
            </span>
            Coach
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Analysis, recommendations & a co-pilot to grow your home profitability · {year}
          </p>
        </div>
        <YearPicker years={availableYears} selected={year} />
      </div>

      {!hasData ? (
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-12 text-center shadow-sm">
          <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00D68F]/12 mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-[#00D68F]" />
          </span>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-1">Nothing to coach yet</h2>
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
            Import a statement for {year} and your coach will analyze it and suggest ways to improve.
          </p>
        </div>
      ) : (
        <>
          {/* Profitability snapshot */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <ScoreTile score={summary.score} savingsRate={summary.savingsRate} />
            <SnapTile label="Monthly income" value={summary.monthlyIncome} icon={<TrendingUp className="w-5 h-5" />} color="text-[#00D68F]" />
            <SnapTile label="Monthly spend" value={summary.monthlySpend} icon={<Wallet className="w-5 h-5" />} color="text-[#FF4D6A]" />
            <SnapTile label="Monthly net" value={summary.monthlyNet} icon={<PiggyBank className="w-5 h-5" />} color={summary.monthlyNet >= 0 ? "text-[#00D68F]" : "text-[#FF4D6A]"} signed />
          </div>

          {/* Recommendations */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#00D68F]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Recommendations</h3>
              <span className="text-xs text-[var(--muted-foreground)] ml-auto">This period</span>
            </div>
            {recommendations.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-2">
                Nothing pressing — your finances look balanced. Ask the co-pilot for deeper ideas.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recommendations.map((r) => {
                  const meta = KIND_META[r.kind];
                  return (
                    <div key={r.id} className="flex gap-3 rounded-xl border border-[var(--border)] p-3.5 hover:border-[color:var(--border)] transition-colors">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5" style={{ background: `${meta.color}1A`, color: meta.color }}>
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[var(--foreground)]">{r.title}</span>
                          {r.monthlyImpact != null && r.monthlyImpact >= 5 && (
                            <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 font-data" style={{ background: `${meta.color}1A`, color: meta.color }}>
                              ~{formatCurrency(r.monthlyImpact)}/mo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--muted-foreground)] mt-0.5 leading-relaxed">{r.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Co-pilot */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#00D68F]/12">
                <Bot className="w-4 h-4 text-[#00D68F]" />
              </span>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Co-pilot</h3>
              <span className="text-xs text-[var(--muted-foreground)] ml-auto">Ask anything about your money</span>
            </div>

            {needsKey ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--muted)] mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-[var(--muted-foreground)]" />
                </span>
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">Connect a free AI key</h4>
                <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto mb-2">
                  The co-pilot runs on a free LLM. Add a <span className="font-medium text-[var(--foreground)]">GEMINI_API_KEY</span> (from
                  {" "}<a className="text-[#00D68F] underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>)
                  {" "}or a <span className="font-medium text-[var(--foreground)]">GROQ_API_KEY</span> in your Vercel project&apos;s
                  environment variables, then redeploy.
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Your finance summary is sent to that provider to answer questions.
                </p>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="pressable text-xs rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[#00D68F]/40 transition-colors"
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
                          m.role === "user"
                            ? "bg-[#00D68F] text-[#0C0F14] font-medium"
                            : "bg-[var(--muted)] text-[var(--foreground)]"
                        )}
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(input);
                  }}
                  className="mt-4 flex items-center gap-2"
                >
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
                    style={{ background: "#00D68F" }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ScoreTile({ score, savingsRate }: { score: number; savingsRate: number }) {
  const color = score >= 66 ? "#00D68F" : score >= 33 ? "#FFB547" : "#FF4D6A";
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--muted-foreground)] font-medium">Profitability</span>
        <Sparkles className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-2xl font-bold font-data" style={{ color }}>
        {score}<span className="text-sm text-[var(--muted-foreground)] font-normal">/100</span>
      </p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">{Math.round(savingsRate * 100)}% savings rate</p>
    </div>
  );
}

function SnapTile({
  label, value, icon, color, signed,
}: {
  label: string; value: number; icon: React.ReactNode; color: string; signed?: boolean;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--muted-foreground)] font-medium">{label}</span>
        <div className="text-[var(--muted-foreground)]">{icon}</div>
      </div>
      <p className={cn("text-2xl font-bold font-data", color)}>
        {signed && value >= 0 ? "+" : ""}{formatCurrency(value)}
      </p>
    </div>
  );
}
