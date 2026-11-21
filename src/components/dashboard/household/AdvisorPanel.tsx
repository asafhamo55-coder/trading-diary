"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  HelpCircle,
  KeyRound,
  RefreshCw,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import type { AdvisorOutput, AdvisorRecommendation, AdvisorUsage } from "@/lib/advisor";
import type { AdvisorReportDTO } from "@/lib/savings-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { fmtRelative, fmtUsd, fmtUsdCompact } from "./format";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const PRIORITY_VARIANT = { high: "danger", medium: "warning", low: "neutral" } as const;

const CATEGORY_LABELS: Record<string, string> = {
  fees: "Fees",
  allocation: "Allocation",
  consolidation: "Consolidation",
  insurance: "Insurance",
  "insurance-overlap": "Insurance overlap",
  tax: "Tax",
  liquidity: "Liquidity",
  retirement: "Retirement",
  property: "Property",
  "cash-flow": "Cash flow",
  education: "Education",
  "data-gap": "Data gap",
};

/** Progress copy, keyed by elapsed seconds. Generation usually takes 1–4 min. */
const STAGES: { at: number; text: string }[] = [
  { at: 0, text: "Packaging your household snapshot" },
  { at: 8, text: "Reviewing fees and 10-year fee drag on every account" },
  { at: 40, text: "Checking insurance overlaps and coverage gaps" },
  { at: 80, text: "Weighing allocation, liquidity and cross-border tax" },
  { at: 130, text: "Writing prioritized recommendations" },
  { at: 200, text: "Still thinking — large households take a little longer" },
];
const EXPECTED_SECONDS = 180;

function asOutput(v: unknown): AdvisorOutput | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<AdvisorOutput>;
  if (typeof o.headline !== "string" || !Array.isArray(o.recommendations)) return null;
  return {
    headline: o.headline,
    netWorthCommentary: o.netWorthCommentary ?? "",
    recommendations: o.recommendations,
    questionsForUser: Array.isArray(o.questionsForUser) ? o.questionsForUser : [],
    disclaimers: Array.isArray(o.disclaimers) ? o.disclaimers : [],
  };
}

function asUsage(v: unknown): Partial<AdvisorUsage> | null {
  return v && typeof v === "object" ? (v as Partial<AdvisorUsage>) : null;
}

type RunState =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number }
  | { kind: "error"; message: string }
  | { kind: "needsKey"; message?: string };

export default function AdvisorPanel({
  initialReport,
  hasKey,
  ownerName,
  hasData,
}: {
  initialReport: AdvisorReportDTO | null;
  hasKey: boolean;
  ownerName: (key: string) => string;
  hasData: boolean;
}) {
  const [report, setReport] = useState<AdvisorReportDTO | null>(initialReport);
  const [run, setRun] = useState<RunState>(hasKey ? { kind: "idle" } : { kind: "needsKey" });
  const [lastCached, setLastCached] = useState(false);
  const output = useMemo(() => asOutput(report?.output), [report]);
  const usage = useMemo(() => asUsage(report?.usage), [report]);

  async function start() {
    setRun({ kind: "running", startedAt: Date.now() });
    try {
      const res = await fetch("/api/savings/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report ? { force: true } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        report?: AdvisorReportDTO;
        cached?: boolean;
        needsKey?: boolean;
        message?: string;
        error?: string;
      };
      if (data.needsKey) return setRun({ kind: "needsKey", message: data.message });
      if (!res.ok || !data.report) {
        return setRun({ kind: "error", message: data.error ?? `The advisor request failed (${res.status}).` });
      }
      setReport(data.report);
      setLastCached(!!data.cached);
      setRun({ kind: "idle" });
    } catch (e) {
      setRun({
        kind: "error",
        message:
          e instanceof Error && e.message
            ? `Connection dropped before the analysis finished (${e.message}). Try again — a finished report is saved and will load here.`
            : "Connection dropped before the analysis finished.",
      });
    }
  }

  const running = run.kind === "running";
  const canRun = run.kind !== "needsKey" && hasData;

  return (
    <Card className="overflow-hidden">
      <div className="relative border-b border-border bg-accent-subtle/60">
        <CardHeader
          actions={
            canRun ? (
              <Button
                variant={report ? "secondary" : "primary"}
                size="sm"
                onClick={start}
                loading={running}
                icon={report ? <RefreshCw aria-hidden /> : <Sparkles aria-hidden />}
              >
                {running ? "Analyzing…" : report ? "Re-run" : "Run analysis"}
              </Button>
            ) : null
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-on-solid [&_svg]:size-4" aria-hidden>
              <Sparkles />
            </span>
            <CardTitle as="h2" className="text-lg">
              Fable advisor
            </CardTitle>
            <Badge variant="ai">AI</Badge>
          </div>
          <CardDescription>
            Cross-border (Israel–US) review of your fees, insurance, allocation and liquidity — what to do next and
            why.
          </CardDescription>
          {report ? (
            <p className="text-xs text-muted-foreground">
              Last run {fmtRelative(report.createdAt)}
              {usage?.estCostUsd != null ? ` · cost $${usage.estCostUsd.toFixed(2)}` : ""}
              {` · ${usage?.servedByModel ?? report.model}`}
              {usage?.fallbackUsed ? " (fallback)" : ""}
              {lastCached ? " · inputs unchanged, reused saved report" : ""}
            </p>
          ) : null}
        </CardHeader>
      </div>

      {running ? <ProgressBlock startedAt={(run as { startedAt: number }).startedAt} /> : null}

      {run.kind === "needsKey" ? (
        <div className="m-5 flex gap-3 rounded-lg border border-warning/25 bg-warning-subtle p-4 text-sm">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Connect the advisor</p>
            <p className="text-foreground-secondary">
              The advisor runs on Claude Fable and needs an Anthropic API key. Add{" "}
              <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">ANTHROPIC_API_KEY</code> to the
              project’s Environment Variables in Vercel (Settings → Environment Variables), then redeploy.
              {report ? " Your last saved report is shown below." : ""}
            </p>
          </div>
        </div>
      ) : null}

      {run.kind === "error" ? (
        <div role="alert" className="m-5 flex gap-3 rounded-lg border border-danger/20 bg-danger-subtle p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">The analysis didn’t finish</p>
            <p className="text-foreground-secondary">{run.message}</p>
          </div>
        </div>
      ) : null}

      <div className={cn(running && "pointer-events-none opacity-50 transition-opacity")}>
        {output ? (
          <ReportBody output={output} ownerName={ownerName} />
        ) : run.kind !== "needsKey" && !running ? (
          <EmptyState
            variant="compact"
            icon={<Sparkles />}
            title={hasData ? "No analysis yet" : "Add your accounts first"}
            description={
              hasData
                ? "Run the advisor for a prioritized plan: fee cuts, insurance duplicates, allocation, and questions it needs answered. It takes 1–4 minutes."
                : "The advisor reviews your savings, properties and insurance. Import a pension report on Retirement & Savings to get started."
            }
          />
        ) : null}
      </div>
    </Card>
  );
}

function ProgressBlock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  // Eases toward 95% over the expected duration; never claims completion.
  const pct = Math.min(95, 95 * (1 - Math.exp((-2.2 * elapsed) / EXPECTED_SECONDS)));
  const stageIdx = STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="border-b border-border px-5 py-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium text-foreground">{STAGES[stageIdx].text}…</p>
        <span className="num shrink-0 text-xs text-muted-foreground">
          {mm}:{ss}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STAGES.slice(0, 5).map((s, i) => (
          <li
            key={s.at}
            className={cn(
              "flex items-center gap-1.5",
              i < stageIdx ? "text-success" : i === stageIdx ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                i < stageIdx ? "bg-success" : i === stageIdx ? "animate-pulse bg-accent" : "bg-border-strong"
              )}
            />
            {["Snapshot", "Fees", "Insurance", "Allocation & tax", "Recommendations"][i]}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Usually 1–4 minutes. Keep this tab open; the rest of the dashboard stays usable.
      </p>
    </div>
  );
}

function ReportBody({ output, ownerName }: { output: AdvisorOutput; ownerName: (k: string) => string }) {
  const recs = useMemo(
    () => [...output.recommendations].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    [output.recommendations]
  );
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? recs : recs.slice(0, 6);
  const totalImpact = recs.reduce((s, r) => s + (r.estimatedImpactUsdPerYear ?? 0), 0);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const r of recs) counts[r.priority]++;

  return (
    <CardContent className="space-y-6 pt-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="space-y-2">
          <p className="text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">{output.headline}</p>
          {output.netWorthCommentary ? (
            <p className="max-w-3xl text-sm leading-relaxed text-foreground-secondary">{output.netWorthCommentary}</p>
          ) : null}
        </div>
        <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-subtle p-3 text-center lg:w-[300px]">
          <div>
            <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Actions</dt>
            <dd className="num text-lg font-semibold text-foreground">{recs.length}</dd>
          </div>
          <div>
            <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">High</dt>
            <dd className="num text-lg font-semibold text-danger">{counts.high}</dd>
          </div>
          <div>
            <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Est. / yr</dt>
            <dd className="num text-lg font-semibold text-success">{totalImpact > 0 ? fmtUsdCompact(totalImpact) : "—"}</dd>
          </div>
        </dl>
      </div>

      {recs.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Recommendations
          </h3>
          <ol className="grid gap-3 md:grid-cols-2">
            {visible.map((r, i) => (
              <RecommendationItem key={`${r.title}-${i}`} rec={r} index={i + 1} ownerName={ownerName} />
            ))}
          </ol>
          {recs.length > 6 ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setShowAll((v) => !v)}
              iconRight={<ChevronDown className={cn("transition-transform", showAll && "rotate-180")} aria-hidden />}
            >
              {showAll ? "Show fewer" : `Show all ${recs.length} recommendations`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {output.questionsForUser.length > 0 ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            The advisor needs to know
          </h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {output.questionsForUser.map((q, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-info/20 bg-info-subtle p-3">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{q.question}</p>
                  {q.why ? <p className="mt-0.5 text-xs text-foreground-secondary">{q.why}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {output.disclaimers.length > 0 ? (
        <div className="border-t border-border pt-4">
          <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            {output.disclaimers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </CardContent>
  );
}

function RecommendationItem({
  rec,
  index,
  ownerName,
}: {
  rec: AdvisorRecommendation;
  index: number;
  ownerName: (k: string) => string;
}) {
  const household = rec.owner === "household" || rec.owner === "joint";
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-foreground-secondary"
          aria-hidden
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{rec.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={PRIORITY_VARIANT[rec.priority] ?? "neutral"} className="capitalize">
              {rec.priority}
            </Badge>
            <Badge variant="outline">{CATEGORY_LABELS[rec.category] ?? rec.category}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {household ? <Users className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
              {ownerName(rec.owner)}
            </span>
          </div>
        </div>
        {rec.estimatedImpactUsdPerYear ? (
          <div className="shrink-0 text-right">
            <p className="num text-sm font-semibold text-success">+{fmtUsd(rec.estimatedImpactUsdPerYear)}</p>
            <p className="text-2xs text-muted-foreground">per year</p>
          </div>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-foreground-secondary">{rec.rationale}</p>
      <div className="mt-auto flex gap-2 rounded-md bg-primary-subtle px-3 py-2 text-sm text-foreground">
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="font-medium">Do: </span>
          {rec.action}
        </span>
      </div>
      <p className="text-2xs text-muted-foreground">Confidence: {rec.confidence}</p>
    </li>
  );
}
