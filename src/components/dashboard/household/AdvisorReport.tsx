"use client";

// The advisor report as a drill-down:
//   0. "Money on the table — act this week": quick wins, each with its next
//      action item ticked inline
//   1. executive summary + total-upside KPI + theme cards (summed benefit)
//   2. ranked recommendation rows (filter by theme / owner)
//   3. an expanded row: what to change, why, how, action-item checklist,
//      benefit basis, dependencies and risks.
// Action-item ticks persist through /api/savings/advisor/actions and roll up
// into every level. Text renders in English or Hebrew (dir="rtl"); amounts
// are formatted in the display currency and isolated with <bdi>.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  ExternalLink,
  HelpCircle,
  Languages,
  Link2,
  ListChecks,
  RotateCcw,
  ThumbsDown,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  capturedTenYearUsd,
  dismissKey,
  isDismissed,
  itemKey,
  nextActionItem,
  recProgress,
  sumProgress,
  themeTitle,
  tx,
  type ActionStatusMap,
  type AdvisorActionItem,
  type AdvisorEmail,
  type AdvisorLang,
  type AdvisorOutput,
  type AdvisorQuickWin,
  type AdvisorRecommendation,
  type AdvisorTheme,
  type Progress,
} from "@/lib/advisor-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { useDisplayCurrency } from "@/components/ui/currency";
import { cn } from "@/lib/utils";
import type { EmailAccount, EmailContact } from "@/lib/advisor-email";
import { ADVISOR_STRINGS, fmtDay } from "./advisor-i18n";
import { PrepareEmailButton } from "./AdvisorEmailDialog";

const EMPTY_EMAIL_CONTEXT: { accounts: EmailAccount[]; contacts: EmailContact[] } = { accounts: [], contacts: [] };

const URGENCY_VARIANT = { critical: "danger", high: "warning", medium: "info", low: "neutral" } as const;
const TONE_DOT = { good: "bg-success", watch: "bg-warning", act: "bg-danger" } as const;

const isHousehold = (k: string) => k === "household" || k === "joint";

/** A number/amount kept left-to-right inside RTL text. */
function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("num", className)}>
      {children}
    </bdi>
  );
}

type Strings = (typeof ADVISOR_STRINGS)["en"];

/** Data the "Prepare email" dialog fills placeholders and recipients from. */
export interface AdvisorEmailContext {
  accounts: EmailAccount[];
  contacts: EmailContact[];
}

/** The action item an email completes: its actionItemId, else the first open item. */
export function emailActionItem(rec: AdvisorRecommendation, email: AdvisorEmail, status: ActionStatusMap): AdvisorActionItem | null {
  return rec.actionItems.find((a) => a.id === email.actionItemId) ?? nextActionItem(rec, status);
}

/** Persisted action-item ticks (GET/PUT /api/savings/advisor/actions) with optimistic updates. */
export function useActionStatus(initialStatuses: ActionStatusMap | null | undefined, reportId: string | null) {
  const [status, setStatus] = useState<ActionStatusMap>(initialStatuses ?? {});
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (initialStatuses) return;
    let cancelled = false;
    fetch("/api/savings/advisor/actions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { statuses?: ActionStatusMap } | null) => {
        if (!cancelled && d?.statuses) setStatus((cur) => ({ ...d.statuses, ...cur }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialStatuses]);

  const toggleItem = useCallback(
    async (rec: AdvisorRecommendation, item: AdvisorActionItem, done: boolean) => {
      const key = itemKey(rec, item);
      const prev = status[key];
      setStatus((cur) => ({ ...cur, [key]: { done, doneAt: done ? new Date().toISOString() : null } }));
      setSaveError(false);
      try {
        const res = await fetch("/api/savings/advisor/actions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recId: rec.id, task: item.task.en, done, reportId }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setStatus((cur) => {
          const next = { ...cur };
          if (prev) next[key] = prev;
          else delete next[key];
          return next;
        });
        setSaveError(true);
      }
    },
    [status, reportId]
  );

  /** Mark a whole recommendation "not relevant" (or restore it). */
  const setDismissed = useCallback(
    async (rec: AdvisorRecommendation, dismissed: boolean, reason: string | null = null) => {
      const key = dismissKey(rec.id);
      const prev = status[key];
      setStatus((cur) => ({ ...cur, [key]: { done: dismissed, doneAt: dismissed ? new Date().toISOString() : null, reason } }));
      setSaveError(false);
      try {
        const res = await fetch("/api/savings/advisor/actions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recId: rec.id, title: rec.title.en || rec.title.he, reason, dismissed, reportId }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setStatus((cur) => {
          const next = { ...cur };
          if (prev) next[key] = prev;
          else delete next[key];
          return next;
        });
        setSaveError(true);
      }
    },
    [status, reportId]
  );
  return { status, toggleItem, setDismissed, saveError };
}

export default function AdvisorReport({
  output,
  reportId,
  ownerName,
  initialStatuses,
  lang,
  emailContext = EMPTY_EMAIL_CONTEXT,
  propertyTitles = {},
}: {
  output: AdvisorOutput;
  reportId: string | null;
  ownerName: (k: string) => string;
  /** Server-loaded ticks; when absent the component fetches them. */
  initialStatuses?: ActionStatusMap | null;
  lang: AdvisorLang;
  emailContext?: AdvisorEmailContext;
  /** propertyId → display title, for the per-property real-estate breakdown. */
  propertyTitles?: Record<string, string>;
}) {
  const s = ADVISOR_STRINGS[lang];
  const { money } = useDisplayCurrency();
  const compact = useCallback((usd: number) => money(usd, "USD", { compact: true }), [money]);
  const { status, toggleItem, setDismissed, saveError } = useActionStatus(initialStatuses, reportId);
  // "Not relevant" recommendations drop out of every list, totals and progress.
  const recs = useMemo(() => output.recommendations.filter((r) => !isDismissed(r, status)), [output, status]);
  const dismissed = output.recommendations.filter((r) => isDismissed(r, status));
  const [showDismissed, setShowDismissed] = useState(false);

  // ── Filters + expansion ──────────────────────────────────────────
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLElement | null>(null);

  const owners = useMemo(() => {
    const seen: string[] = [];
    for (const r of recs) if (!seen.includes(r.owner)) seen.push(r.owner);
    return seen;
  }, [recs]);

  const byId = useMemo(() => new Map(recs.map((r) => [r.id, r])), [recs]);
  const rankOf = useMemo(() => new Map(recs.map((r, i) => [r.id, i + 1])), [recs]);
  const themeLabel = (id: string) => tx(output.themes.find((x) => x.id === id)?.title ?? themeTitle(id), lang);
  const visible = recs.filter((r) => (!themeFilter || r.themeId === themeFilter) && (!ownerFilter || r.owner === ownerFilter));

  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const jumpTo = (id: string) => {
    setThemeFilter(null);
    setOwnerFilter(null);
    setOpen((cur) => new Set(cur).add(id));
    requestAnimationFrame(() => {
      const el = rowRefs.current[id];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  };

  const pickTheme = (id: string) => {
    setThemeFilter((t) => (t === id ? null : id));
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const emailSent = (rec: AdvisorRecommendation, email: AdvisorEmail) => {
    const it = rec.actionItems.find((a) => a.id === email.actionItemId);
    return it ? !!status[itemKey(rec, it)]?.done : false;
  };
  const markSent = (rec: AdvisorRecommendation, email: AdvisorEmail) => {
    const it = emailActionItem(rec, email, status);
    if (it && !status[itemKey(rec, it)]?.done) void toggleItem(rec, it, true);
  };
  const emails: EmailHandlers = { context: emailContext, isSent: emailSent, markSent };

  const propertyGroups = useMemo(() => {
    const m = new Map<string, AdvisorRecommendation[]>();
    for (const r of recs) if (r.propertyId) m.set(r.propertyId, [...(m.get(r.propertyId) ?? []), r]);
    return [...m.entries()]
      .map(([id, rs]) => ({ id, recs: rs, total: rs.reduce((acc, r) => acc + r.benefit.tenYearUsd, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [recs]);
  const showPropertyGroups = propertyGroups.length > 0 && (!themeFilter || themeFilter === "real-estate");

  const total = sumProgress(recs, status);
  const captured = capturedTenYearUsd(recs, status);
  // Report totals, less anything marked "not relevant".
  const t =
    dismissed.length === 0
      ? output.totals
      : {
          ...output.totals,
          tenYearUsd: recs.reduce((acc, r) => acc + r.benefit.tenYearUsd, 0),
          annualUsd: recs.reduce((acc, r) => acc + (r.benefit.annualUsd ?? 0), 0),
          oneTimeUsd: recs.reduce((acc, r) => acc + (r.benefit.oneTimeUsd ?? 0), 0),
          recommendationCount: recs.length,
        };
  const wins = output.quickWins.filter((q) => byId.has(q.recId));
  const showEnglishOnly = lang === "he" && !output.languages.includes("he");

  return (
    <CardContent className="space-y-7 pt-5">
      {output.legacy || showEnglishOnly ? (
        <div className="flex gap-3 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-foreground-secondary">
          {output.legacy ? (
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <Languages className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <p>
            {output.legacy ? s.legacyNote : ""}
            {output.legacy && showEnglishOnly ? " " : ""}
            {showEnglishOnly ? s.englishOnlyNote : ""}
          </p>
        </div>
      ) : null}

      {/* ── Level 0: money on the table ──────────────────────────── */}
      {wins.length > 0 ? (
        <section aria-labelledby="advisor-quick-h" className="rounded-xl border border-accent/40 bg-accent-subtle/50 p-4 sm:p-5">
          <div className="mb-3 flex items-start gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-on-solid" aria-hidden>
              <Zap className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 id="advisor-quick-h" className="text-base font-semibold leading-snug text-foreground">
                {s.quickTitle}
              </h3>
              <p className="text-xs text-foreground-secondary">{s.quickSub}</p>
            </div>
          </div>
          <ol className="space-y-2">
            {wins.map((q, i) => (
              <QuickWinRow
                key={q.recId}
                win={q}
                index={i + 1}
                rec={byId.get(q.recId)!}
                status={status}
                lang={lang}
                s={s}
                compact={compact}
                ownerName={ownerName}
                onToggleItem={toggleItem}
                onDetails={() => jumpTo(q.recId)}
                emails={emails}
              />
            ))}
          </ol>
        </section>
      ) : null}

      {/* ── Level 1: where you stand ─────────────────────────────── */}
      <section aria-labelledby="advisor-summary-h" className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0 space-y-3">
            <h3 id="advisor-summary-h" className="text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {tx(output.headline, lang)}
            </h3>
            {output.executiveSummary.length > 0 ? (
              <ul className="space-y-2">
                {output.executiveSummary.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground-secondary">
                    <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    <span>{tx(b, lang)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="rounded-xl border border-border bg-subtle p-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.totalUpside}</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-success">
              <Num>{t.tenYearUsd > 0 ? compact(t.tenYearUsd) : "—"}</Num>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.annualUsd > 0 ? s.recurring("⁨" + compact(t.annualUsd) + "⁩") : s.noRecurring}
              {t.oneTimeUsd > 0 ? ` · ${s.oneTime("⁨" + compact(t.oneTimeUsd) + "⁩")}` : ""}
              {` · ${s.recCount(t.recommendationCount)}`}
            </p>
            {total.total > 0 ? (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    <Num>{total.done}</Num> {s.of} <Num>{total.total}</Num> {s.itemsDone}
                  </span>
                  {captured > 0 ? (
                    <span className="text-success">
                      <Num>{compact(captured)}</Num> {s.captured}
                    </span>
                  ) : null}
                </div>
                <ProgressBar progress={total} label={s.itemsDone} />
              </div>
            ) : null}
          </div>
        </div>

        {output.themes.length > 0 ? (
          <div className="space-y-4">
            <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.byTheme}</h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {output.themes.map((th) => (
                <li key={th.id} className="min-w-0">
                  <ThemeCard
                    theme={th}
                    progress={sumProgress(
                      recs.filter((r) => r.themeId === th.id),
                      status
                    )}
                    selected={themeFilter === th.id}
                    onSelect={() => pickTheme(th.id)}
                    compact={compact}
                    lang={lang}
                    s={s}
                  />
                </li>
              ))}
            </ul>
            </div>
            {showPropertyGroups ? (
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.byProperty}</h3>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {propertyGroups.map((g) => (
                    <li key={g.id} className="min-w-0 rounded-lg border border-border bg-surface p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{propertyTitles[g.id] ?? g.id}</p>
                        <span className="shrink-0 text-sm font-semibold text-success">
                          {g.total > 0 ? <Num>+{compact(g.total)}</Num> : "—"}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {g.recs.map((r) => (
                          <li key={r.id} className="flex items-start gap-2 text-xs">
                            {r.subTheme ? <Badge variant="neutral">{s.subTheme[r.subTheme]}</Badge> : null}
                            <button
                              type="button"
                              onClick={() => jumpTo(r.id)}
                              className="focus-ring min-w-0 flex-1 text-start text-foreground-secondary hover:text-foreground hover:underline"
                            >
                              {tx(r.title, lang)}
                            </button>
                            <span className="shrink-0 text-muted-foreground">
                              <Num>{r.benefit.tenYearUsd > 0 ? compact(r.benefit.tenYearUsd) : "—"}</Num>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ── Level 2: ranked recommendations ──────────────────────── */}
      {recs.length > 0 ? (
        <section aria-labelledby="advisor-recs-h" ref={listRef} className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="advisor-recs-h" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {s.ranked}
            </h3>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {s.shown(visible.length, recs.length)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={s.filterGroup}>
            {themeFilter ? (
              <button
                type="button"
                onClick={() => setThemeFilter(null)}
                className="focus-ring inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary-subtle px-2.5 text-xs font-medium text-primary coarse:h-9"
                aria-label={s.clearTheme(themeLabel(themeFilter))}
              >
                {themeLabel(themeFilter)}
                <X className="size-3" aria-hidden />
              </button>
            ) : null}
            {owners.length > 1 ? (
              <>
                <FilterChip active={!ownerFilter} onClick={() => setOwnerFilter(null)}>
                  {s.everyone}
                </FilterChip>
                {owners.map((o) => (
                  <FilterChip key={o} active={ownerFilter === o} onClick={() => setOwnerFilter(ownerFilter === o ? null : o)}>
                    {isHousehold(o) ? <Users className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
                    {ownerName(o)}
                  </FilterChip>
                ))}
              </>
            ) : null}
          </div>

          {saveError ? (
            <p role="alert" className="flex items-center gap-2 rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {s.saveError}
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{s.noMatch}</p>
          ) : (
            <ol className="space-y-2">
              {visible.map((r, i) => (
                <RecommendationRow
                  groupHeader={
                    themeFilter === "real-estate" && (i === 0 || visible[i - 1].propertyId !== r.propertyId)
                      ? r.propertyId
                        ? propertyTitles[r.propertyId] ?? r.propertyId
                        : s.portfolioWide
                      : null
                  }
                  emails={emails}
                  key={r.id}
                  rec={r}
                  rank={rankOf.get(r.id) ?? 0}
                  themeLabel={themeLabel(r.themeId)}
                  ownerName={ownerName}
                  progress={recProgress(r, status)}
                  status={status}
                  expanded={open.has(r.id)}
                  onToggle={() => toggleOpen(r.id)}
                  onToggleItem={(item, done) => toggleItem(r, item, done)}
                  onDismiss={(reason) => void setDismissed(r, true, reason)}
                  onJump={jumpTo}
                  titleOf={(id) => (byId.get(id) ? tx(byId.get(id)!.title, lang) : id)}
                  rankOfId={(id) => rankOf.get(id) ?? null}
                  buttonRef={(el) => {
                    rowRefs.current[r.id] = el;
                  }}
                  lang={lang}
                  s={s}
                />
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {dismissed.length > 0 ? (
        <DismissedList recs={dismissed} status={status} open={showDismissed} onToggle={() => setShowDismissed((v) => !v)} onRestore={(r) => void setDismissed(r, false)} lang={lang} s={s} />
      ) : null}

      {output.questionsForUser.length > 0 ? (
        <section aria-labelledby="advisor-q-h" className="rounded-lg border border-border bg-subtle/60 p-4">
          <h3 id="advisor-q-h" className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <HelpCircle className="size-4 text-info" aria-hidden />
            {s.needToKnow}
          </h3>
          <ul className="space-y-2">
            {output.questionsForUser.map((q, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-foreground">{tx(q.question, lang)}</p>
                {tx(q.why, lang) ? <p className="text-foreground-secondary">{tx(q.why, lang)}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {output.disclaimers.length > 0 ? (
        <div className="border-t border-border pt-4">
          <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            {output.disclaimers.map((d, i) => (
              <li key={i}>{tx(d, lang)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </CardContent>
  );
}

// ── Level 0 ────────────────────────────────────────────────────────

function QuickWinRow({
  win,
  index,
  rec,
  status,
  lang,
  s,
  compact,
  ownerName,
  onToggleItem,
  onDetails,
  emails,
}: {
  emails: EmailHandlers;
  win: AdvisorQuickWin;
  index: number;
  rec: AdvisorRecommendation;
  status: ActionStatusMap;
  lang: AdvisorLang;
  s: Strings;
  compact: (usd: number) => string;
  ownerName: (k: string) => string;
  onToggleItem: (rec: AdvisorRecommendation, item: AdvisorActionItem, done: boolean) => void;
  onDetails: () => void;
}) {
  const next = nextActionItem(rec, status);
  const progress = recProgress(rec, status);
  const complete = progress.total > 0 && !next;
  const isFirst = next ? rec.actionItems[0]?.id === next.id : false;
  return (
    <li className="rounded-lg border border-border bg-surface p-3 sm:p-3.5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            complete ? "bg-success-subtle text-success" : "bg-accent-subtle text-accent-fg"
          )}
          aria-hidden
        >
          {complete ? <CheckCircle2 className="size-4" /> : <Num>{index}</Num>}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold leading-snug", complete ? "text-muted-foreground line-through" : "text-foreground")}>
            {tx(win.directive, lang)}
          </p>
          {next ? (
            <div className="mt-2 rounded-md bg-subtle/70 px-2.5 py-2">
              <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{isFirst ? s.firstStep : s.nextStep}</p>
              <ActionCheck rec={rec} item={next} done={false} lang={lang} s={s} ownerName={ownerName} onChange={(d) => onToggleItem(rec, next, d)} idPrefix="qw" />
            </div>
          ) : complete ? (
            <p className="mt-1 text-xs text-success">{s.allStepsDone}</p>
          ) : null}
          <EmailButtons rec={rec} emails={emails} lang={lang} className="mt-2" />
        </div>
        <div className="flex w-full shrink-0 items-center justify-between gap-2 ps-9 sm:w-auto sm:flex-col sm:items-end sm:gap-1 sm:ps-0 sm:text-end">
          {rec.benefit.tenYearUsd > 0 ? (
            <span className="text-sm font-semibold text-success">
              <Num>+{compact(rec.benefit.tenYearUsd)}</Num>
            </span>
          ) : null}
          {rec.benefit.annualUsd ? (
            <span className="text-2xs text-muted-foreground">
              <Num>{compact(rec.benefit.annualUsd)}</Num>
              {s.perYearShort}
            </span>
          ) : null}
          <Button variant="link" size="xs" onClick={onDetails} className="text-xs">
            {s.details}
          </Button>
        </div>
      </div>
    </li>
  );
}

// ── Level 1 pieces ─────────────────────────────────────────────────

function ThemeCard({
  theme,
  progress,
  selected,
  onSelect,
  compact,
  lang,
  s,
}: {
  theme: AdvisorTheme;
  progress: Progress;
  selected: boolean;
  onSelect: () => void;
  compact: (usd: number) => string;
  lang: AdvisorLang;
  s: Strings;
}) {
  const hasRecs = theme.recommendationCount > 0;
  const title = tx(theme.title, lang);
  const status = tx(theme.status, lang);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!hasRecs}
      aria-pressed={hasRecs ? selected : undefined}
      aria-label={s.themeAria(title, s.tone[theme.tone], status, theme.recommendationCount, compact(theme.totalTenYearUsd))}
      className={cn(
        "focus-ring flex h-full w-full min-w-0 flex-col gap-1.5 rounded-lg border bg-surface p-3 text-start transition-[border-color,background-color,box-shadow] duration-150",
        hasRecs ? "hover:border-border-strong hover:shadow-sm" : "cursor-default",
        selected ? "border-primary bg-primary-subtle/60 ring-1 ring-primary" : "border-border"
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn("size-2 shrink-0 rounded-full", TONE_DOT[theme.tone])} aria-hidden />
        <span className="truncate text-sm font-semibold text-foreground">{title}</span>
      </span>
      <span className={cn("text-lg font-semibold leading-tight", hasRecs && theme.totalTenYearUsd > 0 ? "text-success" : "text-muted-foreground")}>
        {hasRecs ? theme.totalTenYearUsd > 0 ? <Num>+{compact(theme.totalTenYearUsd)}</Num> : s.unquantified : s.tone[theme.tone]}
      </span>
      {status ? <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{status}</span> : null}
      {hasRecs ? (
        <span className="mt-auto flex items-center gap-2 pt-1 text-2xs text-muted-foreground">
          <span>{s.recs(theme.recommendationCount)}</span>
          {progress.total > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>
                <Num>
                  {progress.done}/{progress.total}
                </Num>{" "}
                {s.done}
              </span>
            </>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function ProgressBar({ progress, label, className }: { progress: Progress; label: string; className?: string }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
      aria-valuetext={`${progress.done} / ${progress.total}`}
      className={cn("h-1.5 overflow-hidden rounded-full bg-border", className)}
    >
      <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors coarse:h-9",
        active ? "border-foreground/20 bg-foreground text-background" : "border-border bg-surface text-foreground-secondary hover:bg-subtle"
      )}
    >
      {children}
    </button>
  );
}

// ── Level 2 row + level 3 detail ───────────────────────────────────

function BenefitSubline({ rec, compact, s }: { rec: AdvisorRecommendation; compact: (usd: number) => string; s: Strings }) {
  const b = rec.benefit;
  if (b.annualUsd)
    return (
      <>
        <Num>{compact(b.annualUsd)}</Num>
        {s.perYearShort}
      </>
    );
  if (b.oneTimeUsd) return <>{s.oneTimeShort}</>;
  if (b.riskReduction) return <>{s.riskAvoided}</>;
  return <>{s.tenYearShort}</>;
}

export function RecommendationRow({
  rec,
  rank,
  themeLabel,
  ownerName,
  progress,
  status,
  expanded,
  onToggle,
  onToggleItem,
  onJump,
  titleOf,
  rankOfId,
  buttonRef,
  lang,
  s,
  emails,
  groupHeader = null,
  onDismiss,
}: {
  emails: EmailHandlers;
  /** Shows a "Not relevant" button in the details; it asks for the reason first. */
  onDismiss?: (reason: string) => void;
  /** When set, a property/group heading rendered above the row. */
  groupHeader?: string | null;
  rec: AdvisorRecommendation;
  rank: number;
  themeLabel: string;
  ownerName: (k: string) => string;
  progress: Progress;
  status: ActionStatusMap;
  expanded: boolean;
  onToggle: () => void;
  onToggleItem: (item: AdvisorActionItem, done: boolean) => void;
  onJump: (id: string) => void;
  titleOf: (id: string) => string;
  rankOfId: (id: string) => number | null;
  buttonRef: (el: HTMLButtonElement | null) => void;
  lang: AdvisorLang;
  s: Strings;
}) {
  const { money } = useDisplayCurrency();
  const compact = (usd: number) => money(usd, "USD", { compact: true });
  const panelId = useId();
  const complete = progress.total > 0 && progress.done === progress.total;
  const u = rec.urgency;
  const title = tx(rec.title, lang);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();

  return (
    <>
    {groupHeader ? (
      <li role="presentation" className="pt-2 text-xs font-semibold text-foreground-secondary first:pt-0">
        {groupHeader}
      </li>
    ) : null}
    <li className={cn("overflow-hidden rounded-lg border bg-surface transition-shadow", expanded ? "border-border-strong shadow-sm" : "border-border")}>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="focus-ring grid w-full scroll-mt-24 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-3 py-3 text-start hover:bg-subtle/50 sm:px-4"
      >
        <span
          className={cn(
            "mt-0.5 flex size-7 items-center justify-center rounded-full text-xs font-semibold",
            complete ? "bg-success-subtle text-success" : rank <= 3 ? "bg-accent-subtle text-accent-fg" : "bg-subtle text-foreground-secondary"
          )}
          aria-hidden
        >
          {complete ? <CheckCircle2 className="size-4" /> : <Num>{rank}</Num>}
        </span>
        <span className="min-w-0">
          <span className="sr-only">{s.rank(rank)}</span>
          <span className={cn("block text-sm font-semibold leading-snug", complete ? "text-muted-foreground line-through decoration-1" : "text-foreground")}>
            {title}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="outline">{themeLabel}</Badge>
            {rec.subTheme ? <Badge variant="neutral">{s.subTheme[rec.subTheme]}</Badge> : null}
            <span className="inline-flex items-center gap-1">
              {isHousehold(rec.owner) ? <Users className="size-3" aria-hidden /> : <User className="size-3" aria-hidden />}
              {ownerName(rec.owner)}
            </span>
            <span>{s.effort[rec.effort]}</span>
            <Badge variant={URGENCY_VARIANT[u.level]}>
              {s.urgency[u.level]}
              {u.deadline ? ` · ${s.by} ${fmtDay(u.deadline, lang)}` : ""}
            </Badge>
            {progress.total > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="size-3" aria-hidden />
                <Num>
                  {progress.done}/{progress.total}
                </Num>
                <span className="sr-only">{s.actionItemsDone}</span>
                <ProgressBar progress={progress} label={`${title}: ${s.actionItemsDone}`} className="hidden w-12 sm:block" />
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex items-start gap-1.5">
          <span className="text-end">
            <span className={cn("block text-sm font-semibold sm:text-base", rec.benefit.tenYearUsd > 0 ? "text-success" : "text-muted-foreground")}>
              {rec.benefit.tenYearUsd > 0 ? <Num>+{compact(rec.benefit.tenYearUsd)}</Num> : "—"}
            </span>
            <span className="block text-2xs text-muted-foreground">
              <BenefitSubline rec={rec} compact={compact} s={s} />
            </span>
          </span>
          <ChevronDown
            className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      <div id={panelId} role="region" aria-label={s.detailsOf(title)} hidden={!expanded} className="border-t border-border px-3 py-4 sm:px-4">
        {expanded ? (
          <RecommendationDetail
            rec={rec}
            ownerName={ownerName}
            status={status}
            onToggleItem={onToggleItem}
            onJump={onJump}
            titleOf={titleOf}
            rankOfId={rankOfId}
            compact={compact}
            money={(v) => money(v, "USD")}
            lang={lang}
            s={s}
            emails={emails}
          />
        ) : null}
        {expanded && onDismiss ? (
          asking ? (
            <form
              className="mt-4 space-y-2 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (reason.trim()) onDismiss(reason.trim());
              }}
            >
              <label htmlFor={reasonId} className="block text-sm font-medium text-foreground">
                {s.dismissPrompt}
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={s.dismissPlaceholder}
                rows={3}
                maxLength={1000}
                required
                autoFocus
                className="w-full resize-y rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAsking(false)}>
                  {s.dismissCancel}
                </Button>
                <Button type="submit" variant="secondary" size="sm" disabled={!reason.trim()} icon={<ThumbsDown aria-hidden />}>
                  {s.dismissConfirm}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex justify-end border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={() => setAsking(true)} icon={<ThumbsDown aria-hidden />}>
                {s.notRelevant}
              </Button>
            </div>
          )
        ) : null}
      </div>
    </li>
    </>
  );
}

function RecommendationDetail({
  rec,
  ownerName,
  status,
  onToggleItem,
  onJump,
  titleOf,
  rankOfId,
  compact,
  money,
  lang,
  s,
  emails,
}: {
  emails: EmailHandlers;
  rec: AdvisorRecommendation;
  ownerName: (k: string) => string;
  status: ActionStatusMap;
  onToggleItem: (item: AdvisorActionItem, done: boolean) => void;
  onJump: (id: string) => void;
  titleOf: (id: string) => string;
  rankOfId: (id: string) => number | null;
  compact: (usd: number) => string;
  money: (usd: number) => string;
  lang: AdvisorLang;
  s: Strings;
}) {
  const b = rec.benefit;
  const current = tx(rec.whatToChange.current, lang);
  const target = tx(rec.whatToChange.target, lang);
  const why = tx(rec.why, lang);
  const risks = tx(rec.risksIfIgnored, lang);
  const basis = tx(b.basis, lang);
  const riskReduction = tx(b.riskReduction, lang);
  const note = tx(rec.urgency.note, lang);
  return (
    <div className="space-y-5">
      {current || target ? (
        <div>
          <DetailHeading>{s.whatToChange}</DetailHeading>
          <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="rounded-md border border-border bg-subtle px-3 py-2">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{s.now}</p>
              <p className="text-sm text-foreground">{current || "—"}</p>
            </div>
            <ArrowRight className="mx-auto size-4 rotate-90 self-center text-muted-foreground sm:rotate-0 sm:rtl:rotate-180" aria-hidden />
            <div className="rounded-md border border-success/25 bg-success-subtle px-3 py-2">
              <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-success">{s.target}</p>
              <p className="text-sm text-foreground">{target || "—"}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          {why ? (
            <div>
              <DetailHeading>{s.why}</DetailHeading>
              <p className="text-sm leading-relaxed text-foreground-secondary">{why}</p>
            </div>
          ) : null}
          {rec.howToChange.length > 0 ? (
            <div>
              <DetailHeading>{s.how}</DetailHeading>
              <ol className="space-y-2">
                {rec.howToChange.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground-secondary">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-2xs font-semibold text-primary" aria-hidden>
                      <Num>{i + 1}</Num>
                    </span>
                    <span>{tx(step, lang)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {risks ? (
            <div className="flex gap-2.5 rounded-md border border-danger/20 bg-danger-subtle px-3 py-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <p>
                <span className="font-semibold text-foreground">{s.ifNothing}</span>
                <span className="text-foreground-secondary">{risks}</span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-5">
          {rec.actionItems.length > 0 ? (
            <fieldset>
              <legend className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.actionItems}</legend>
              <ul className="divide-y divide-border rounded-md border border-border">
                {rec.actionItems.map((a) => (
                  <li key={a.id} className="px-3 py-2.5">
                    <ActionCheck
                      rec={rec}
                      item={a}
                      done={!!status[itemKey(rec, a)]?.done}
                      lang={lang}
                      s={s}
                      ownerName={ownerName}
                      onChange={(d) => onToggleItem(a, d)}
                      idPrefix="ai"
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}
          <EmailButtons rec={rec} emails={emails} lang={lang} />

          <div>
            <DetailHeading>{s.benefit}</DetailHeading>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <BenefitStat label={s.perYear} value={b.annualUsd ? compact(b.annualUsd) : "—"} />
              <BenefitStat label={s.oneTimeLabel} value={b.oneTimeUsd ? compact(b.oneTimeUsd) : "—"} />
              <BenefitStat label={s.tenYearValue} value={b.tenYearUsd ? money(b.tenYearUsd) : "—"} strong />
            </dl>
            {riskReduction ? <p className="mt-2 text-sm text-foreground-secondary">{riskReduction}</p> : null}
            {basis ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{basis}</p> : null}
          </div>

          {rec.dependsOn.length > 0 ? (
            <div>
              <DetailHeading>{s.doFirst}</DetailHeading>
              <ul className="space-y-1">
                {rec.dependsOn.map((d) => (
                  <li key={d}>
                    <Button variant="link" size="sm" onClick={() => onJump(d)} icon={<Link2 aria-hidden />} className="h-auto whitespace-normal text-start">
                      {rankOfId(d) ? <Num>#{rankOfId(d)} </Num> : null}
                      {titleOf(d)}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CircleDot className="size-3" aria-hidden />
              {s.confidence}: {s.level[rec.confidence]}
            </span>
            {note ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" aria-hidden />
                {note}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Recommendations marked "not relevant", collapsed, each restorable. */
export function DismissedList({
  recs,
  status,
  open,
  onToggle,
  onRestore,
  lang,
  s,
}: {
  recs: AdvisorRecommendation[];
  status: ActionStatusMap;
  open: boolean;
  onToggle: () => void;
  onRestore: (rec: AdvisorRecommendation) => void;
  lang: AdvisorLang;
  s: Strings;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ThumbsDown className="size-3" aria-hidden />
        <span>{s.dismissedCount(recs.length)}</span>
        <Button variant="link" size="sm" onClick={onToggle} aria-expanded={open} className="h-auto px-0 text-xs">
          {open ? s.hideDismissed : s.showDismissed}
        </Button>
      </div>
      {open ? (
        <ul className="divide-y divide-border rounded-lg border border-dashed border-border">
          {recs.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0 text-sm">
                <span className="block text-muted-foreground">{tx(r.title, lang)}</span>
                {status[dismissKey(r.id)]?.reason ? (
                  <span className="mt-0.5 block text-xs text-foreground-secondary">
                    {s.reasonLabel}: {status[dismissKey(r.id)]?.reason}
                  </span>
                ) : null}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onRestore(r)} icon={<RotateCcw aria-hidden />}>
                {s.restore}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export interface EmailHandlers {
  context: AdvisorEmailContext;
  isSent: (rec: AdvisorRecommendation, email: AdvisorEmail) => boolean;
  markSent: (rec: AdvisorRecommendation, email: AdvisorEmail) => void;
}

function EmailButtons({ rec, emails, lang, className }: { rec: AdvisorRecommendation; emails: EmailHandlers; lang: AdvisorLang; className?: string }) {
  if (rec.emails.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {rec.emails.map((e) => (
        <PrepareEmailButton
          key={e.id}
          email={e}
          accounts={emails.context.accounts}
          contacts={emails.context.contacts}
          uiLang={lang}
          sent={emails.isSent(rec, e)}
          onMarkSent={() => emails.markSent(rec, e)}
        />
      ))}
    </div>
  );
}

function DetailHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h4>;
}

function BenefitStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-md border px-2 py-2", strong ? "border-success/25 bg-success-subtle" : "border-border bg-subtle")}>
      <dt className="text-2xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-semibold", strong ? "text-success" : "text-foreground")}>
        <Num>{value}</Num>
      </dd>
    </div>
  );
}

const DOMAIN_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,;)]*)?)/i;

/** Render a contact string, turning a URL/domain into a link. */
function Contact({ text }: { text: string }) {
  const m = DOMAIN_RE.exec(text);
  if (!m || /^\d/.test(m[1])) return <>{text}</>;
  const href = m[1].startsWith("http") ? m[1] : `https://${m[1]}`;
  return (
    <>
      {text.slice(0, m.index)}
      <a href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline">
        {m[1]}
        <ExternalLink className="size-3" aria-hidden />
      </a>
      {text.slice(m.index + m[1].length)}
    </>
  );
}

function ActionCheck({
  rec,
  item,
  done,
  lang,
  s,
  ownerName,
  onChange,
  idPrefix,
}: {
  rec: AdvisorRecommendation;
  item: AdvisorActionItem;
  done: boolean;
  lang: AdvisorLang;
  s: Strings;
  ownerName: (k: string) => string;
  onChange: (done: boolean) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${rec.id}-${item.id}`;
  const contact = tx(item.contact, lang);
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        checked={done}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-meta`}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-[var(--success-solid)] coarse:size-5"
      />
      <div className="min-w-0">
        <label htmlFor={id} className={cn("block cursor-pointer text-sm leading-snug", done ? "text-muted-foreground line-through" : "text-foreground")}>
          {tx(item.task, lang)}
        </label>
        <p id={`${id}-meta`} className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="size-3" aria-hidden />
            {ownerName(item.who)}
          </span>
          {contact ? (
            <span className="min-w-0 break-words">
              <Contact text={contact} />
            </span>
          ) : null}
          {item.dueBy ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" aria-hidden />
              {s.by} {fmtDay(item.dueBy, lang)}
            </span>
          ) : null}
          {item.effortMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {s.minutes(item.effortMinutes)}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
