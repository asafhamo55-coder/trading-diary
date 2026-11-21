"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw, Sparkles } from "lucide-react";
import type { AdvisorUsage } from "@/lib/advisor";
import { readAdvisorOutput, type ActionStatusMap, type AdvisorLang } from "@/lib/advisor-report";
import type { EmailAccount, EmailContact } from "@/lib/advisor-email";
import type { AdvisorReportDTO } from "@/lib/savings-data";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { fmtRelative } from "./format";
import AdvisorReport from "./AdvisorReport";
import { ADVISOR_STRINGS, readStoredLang, storeLang } from "./advisor-i18n";

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

function asUsage(v: unknown): Partial<AdvisorUsage> | null {
  return v && typeof v === "object" ? (v as Partial<AdvisorUsage>) : null;
}

type RunState =
  | { kind: "idle" }
  | { kind: "running"; startedAt: number }
  | { kind: "error"; message: string }
  | { kind: "needsKey"; message?: string };

const LANG_OPTIONS: { value: AdvisorLang; label: string; name: string }[] = [
  { value: "en", label: "EN", name: "English" },
  { value: "he", label: "עב", name: "עברית" },
];

/** EN | עב segmented switch (radiogroup; ←/→ switch). Persisted in localStorage. */
function LangToggle({ lang, onChange, label }: { lang: AdvisorLang; onChange: (l: AdvisorLang) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = (i + 1) % LANG_OPTIONS.length;
    onChange(LANG_OPTIONS[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} dir="ltr" className="flex h-8 items-center rounded-lg border border-border bg-subtle p-0.5 coarse:h-11">
      {LANG_OPTIONS.map((o, i) => {
        const active = o.value === lang;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.name}
            lang={o.value}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "focus-ring inline-flex h-full min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors",
              active ? "bg-surface text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AdvisorPanel({
  initialReport,
  hasKey,
  ownerName,
  hasData,
  initialStatuses = null,
  accounts = [],
  contacts = [],
  propertyTitles = {},
}: {
  initialReport: AdvisorReportDTO | null;
  hasKey: boolean;
  ownerName: (key: string) => string;
  hasData: boolean;
  /** Ticked action items (server-loaded); fetched client-side when null. */
  initialStatuses?: ActionStatusMap | null;
  /** For the "Prepare email" dialog: the user's accounts (full policy numbers stay client-side). */
  accounts?: EmailAccount[];
  contacts?: EmailContact[];
  propertyTitles?: Record<string, string>;
}) {
  const [report, setReport] = useState<AdvisorReportDTO | null>(initialReport);
  const [run, setRun] = useState<RunState>(hasKey ? { kind: "idle" } : { kind: "needsKey" });
  const [lastCached, setLastCached] = useState(false);
  const [lang, setLang] = useState<AdvisorLang>("en");
  useEffect(() => {
    const stored = readStoredLang();
    if (stored && stored !== "en") setLang(stored); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate from localStorage after SSR
  }, []);
  const changeLang = (l: AdvisorLang) => {
    setLang(l);
    storeLang(l);
  };
  const s = ADVISOR_STRINGS[lang];
  const output = useMemo(() => readAdvisorOutput(report?.output), [report]);
  const usage = useMemo(() => asUsage(report?.usage), [report]);
  const emailContext = useMemo(() => ({ accounts, contacts }), [accounts, contacts]);

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
    <Card className="overflow-hidden" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <div className="relative border-b border-border bg-accent-subtle/60">
        <CardHeader
          actions={
            <>
              {output ? <LangToggle lang={lang} onChange={changeLang} label={s.langGroup} /> : null}
              {canRun ? (
                <Button
                  variant={report ? "secondary" : "primary"}
                  size="sm"
                  onClick={start}
                  loading={running}
                  icon={report ? <RefreshCw aria-hidden /> : <Sparkles aria-hidden />}
                >
                  {running ? "Analyzing…" : report ? "Re-run" : "Run analysis"}
                </Button>
              ) : null}
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-on-solid [&_svg]:size-4" aria-hidden>
              <Sparkles />
            </span>
            <CardTitle as="h2" className="text-lg">
              {s.panelTitle}
            </CardTitle>
            <Badge variant="ai">AI</Badge>
          </div>
          <CardDescription>{s.panelDescription}</CardDescription>
          {report ? (
            <p className="text-xs text-muted-foreground" dir="ltr">
              Last run {fmtRelative(report.createdAt)}
              {usage?.estCostUsd ? ` · cost $${usage.estCostUsd.toFixed(2)}` : ""}
              {` · ${report.model === "claude-code" ? "Claude Code" : (usage?.servedByModel ?? report.model)}`}
              {usage?.fallbackUsed ? " (fallback)" : ""}
              {lastCached ? " · inputs unchanged, reused saved report" : ""}
            </p>
          ) : null}
        </CardHeader>
      </div>

      {running ? <ProgressBlock startedAt={(run as { startedAt: number }).startedAt} /> : null}

      {run.kind === "needsKey" ? (
        <div className="mx-5 mt-4 flex gap-3 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-foreground-secondary">
            {s.dailyNote} <span className="font-medium text-foreground">{s.dailyNoteAsk}</span>.
            {report ? "" : s.firstReportSoon}
          </p>
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
          <AdvisorReport
            output={output}
            reportId={report?.id ?? null}
            ownerName={ownerName}
            initialStatuses={initialStatuses}
            lang={lang}
            emailContext={emailContext}
            propertyTitles={propertyTitles}
          />
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
