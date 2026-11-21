"use client";

import * as React from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import type { ExplainKey } from "@/lib/explain";
import {
  BUCKET_IDS,
  DEFAULT_GUIDELINE_CONFIG,
  bucketLabel,
  guidelineConfigSchema,
  type BucketId,
  type GuidelineConfig,
} from "@/lib/guidelines";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-border bg-[var(--input)] px-3 py-2 text-sm text-foreground num " +
  "placeholder:text-muted-foreground/60 transition-colors hover:border-border-strong " +
  "focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-60";

/** Form state: strings so a half-typed number doesn't snap back. */
interface Draft {
  targets: Record<BucketId, string>;
  bandPct: string;
  dipPct: string;
  deployPct: string;
  largeCapB: string;
  watchlist: string;
  overrideOn: boolean;
  overrideAmount: string;
  overrideAsOf: string;
}

function toDraft(c: GuidelineConfig): Draft {
  return {
    targets: {
      sp500: String(c.targets.sp500),
      nasdaq: String(c.targets.nasdaq),
      largeCap: String(c.targets.largeCap),
      cash: String(c.targets.cash),
    },
    bandPct: String(c.bandPct),
    dipPct: String(c.dipPct),
    deployPct: String(Math.round(c.deployFraction * 1000) / 10),
    largeCapB: String(c.largeCapMinUsd / 1e9),
    watchlist: c.watchlist.join(", "),
    overrideOn: c.cashOverride != null,
    overrideAmount: c.cashOverride ? String(c.cashOverride.amount) : "",
    overrideAsOf: c.cashOverride?.asOf ?? new Date().toISOString().slice(0, 10),
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/[,$\s]/g, "")));

function fromDraft(d: Draft, base: GuidelineConfig): unknown {
  const deploy = num(d.deployPct);
  // 33.3% means a third — keep it exact.
  const deployFraction = Math.abs(deploy - 33.3) < 0.05 ? 1 / 3 : Math.abs(deploy - 66.7) < 0.05 ? 2 / 3 : deploy / 100;
  return {
    ...base,
    targets: {
      sp500: num(d.targets.sp500),
      nasdaq: num(d.targets.nasdaq),
      largeCap: num(d.targets.largeCap),
      cash: num(d.targets.cash),
    },
    bandPct: num(d.bandPct),
    dipPct: num(d.dipPct),
    deployFraction,
    largeCapMinUsd: num(d.largeCapB) * 1e9,
    watchlist: d.watchlist
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    cashOverride: d.overrideOn ? { amount: num(d.overrideAmount), asOf: d.overrideAsOf } : null,
  };
}

function Field({
  label,
  hint,
  tip,
  suffix,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  tip?: ExplainKey;
  suffix?: string;
  children: React.ReactElement<{ id?: string }>;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="block text-xs font-medium text-foreground-secondary">
          {label}
        </label>
        {tip ? <InfoTip tip={tip} /> : null}
      </div>
      <div className="relative">
        {React.cloneElement(children, { id })}
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function GuidelineConfigPanel({
  config,
  updatedAt,
  onSave,
  disabled = false,
}: {
  config: GuidelineConfig;
  updatedAt: string | null;
  onSave: (next: GuidelineConfig) => Promise<void>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(config));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => setDraft(toDraft(config)), [config]);

  const sum = BUCKET_IDS.reduce((s, b) => s + (Number.isFinite(num(draft.targets[b])) ? num(draft.targets[b]) : 0), 0);
  const sumOk = Math.abs(sum - 100) <= 0.01;
  const parsed = guidelineConfigSchema.safeParse(fromDraft(draft, config));
  const firstIssue = parsed.success ? null : parsed.error.issues[0];
  const dirty = JSON.stringify(toDraft(config)) !== JSON.stringify(draft);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    if (!parsed.success) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSave(parsed.data as GuidelineConfig);
      setMessage({ tone: "ok", text: "Saved — the plan above now uses these rules." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Couldn't save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-1.5">
          Rules <InfoTip tip="guidelines.rules" />
        </CardTitle>
        <CardDescription>
          These are the account&apos;s standing guidelines. Change them here; the plan is recalculated on save.
          {updatedAt ? ` Last saved ${new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.` : " Using the default rules (not saved yet)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset className="space-y-3" disabled={disabled}>
          <legend className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            Target mix <InfoTip tip="guidelines.targetMix" />
          </legend>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {BUCKET_IDS.map((b) => (
              <Field key={b} label={bucketLabel(b, config)} suffix="%">
                <input
                  inputMode="decimal"
                  className={cn(inputCls, "pr-8")}
                  value={draft.targets[b]}
                  onChange={(e) => set("targets", { ...draft.targets, [b]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <p className={cn("num text-xs", sumOk ? "text-muted-foreground" : "font-medium text-danger")} aria-live="polite">
            Total {Math.round(sum * 100) / 100}% {sumOk ? "✓" : "— targets must add up to 100%"}
          </p>
          <p className="text-xs text-muted-foreground">
            Only {config.sp500Symbol} counts as the S&amp;P 500 bucket and only {config.nasdaqSymbol} as the Nasdaq bucket; any other ETF is outside the rules.
          </p>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3 lg:grid-cols-4" disabled={disabled}>
          <legend className="col-span-full mb-3 text-sm font-semibold text-foreground">Rebalancing &amp; dips</legend>
          <Field label="Rebalance band" tip="guidelines.band" suffix="pts" hint="Act only beyond this drift">
            <input inputMode="decimal" className={cn(inputCls, "pr-10")} value={draft.bandPct} onChange={(e) => set("bandPct", e.target.value)} />
          </Field>
          <Field label="Dip trigger" tip="guidelines.dipTrigger" suffix="%" hint="Below the 3-month high">
            <input inputMode="decimal" className={cn(inputCls, "pr-8")} value={draft.dipPct} onChange={(e) => set("dipPct", e.target.value)} />
          </Field>
          <Field label="Deploy per dip" tip="guidelines.deployFraction" suffix="%" hint="Of the cash reserve (33.3 = ⅓)">
            <input inputMode="decimal" className={cn(inputCls, "pr-8")} value={draft.deployPct} onChange={(e) => set("deployPct", e.target.value)} />
          </Field>
          <Field label="Large cap from" tip="guidelines.largeCapMin" suffix="$B" hint="Market cap; smaller is outside the rules">
            <input inputMode="decimal" className={cn(inputCls, "pr-10")} value={draft.largeCapB} onChange={(e) => set("largeCapB", e.target.value)} />
          </Field>
          <Field label="Dip watchlist" tip="guidelines.watchlist" hint="Large caps to watch even if you don't hold them, e.g. GOOGL, AMZN" className="col-span-full">
            <input
              className={cn(inputCls, "font-normal uppercase")}
              placeholder="GOOGL, AMZN"
              value={draft.watchlist}
              onChange={(e) => set("watchlist", e.target.value)}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-3" disabled={disabled}>
          <legend className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            Cash balance <InfoTip tip="guidelines.cashOverride" />
          </legend>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--primary)]"
              checked={draft.overrideOn}
              onChange={(e) => set("overrideOn", e.target.checked)}
            />
            <span>
              Use the broker&apos;s cash figure instead of the one worked out from trades
              <span className="block text-xs text-muted-foreground">
                The derived figure misses dividends, interest and fees. Override it when it drifts from your statement.
              </span>
            </span>
          </label>
          {draft.overrideOn ? (
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Field label="Cash (USD)" suffix="$">
                <input inputMode="decimal" className={cn(inputCls, "pr-8")} value={draft.overrideAmount} onChange={(e) => set("overrideAmount", e.target.value)} />
              </Field>
              <Field label="As of">
                <input type="date" className={inputCls} value={draft.overrideAsOf} onChange={(e) => set("overrideAsOf", e.target.value)} />
              </Field>
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={save} loading={saving} disabled={disabled || !dirty || !parsed.success} icon={<Save aria-hidden />}>
            Save rules
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDraft(toDraft({ ...DEFAULT_GUIDELINE_CONFIG, cashOverride: config.cashOverride }))}
            disabled={disabled}
            icon={<RotateCcw aria-hidden />}
          >
            Defaults
          </Button>
          <p className="min-w-0 flex-1 text-xs" aria-live="polite">
            {!parsed.success && dirty && firstIssue ? (
              <span className="text-danger">
                {firstIssue.path.length ? `${firstIssue.path.join(".")}: ` : ""}
                {firstIssue.message}
              </span>
            ) : message ? (
              <span className={message.tone === "ok" ? "text-success" : "text-danger"}>{message.text}</span>
            ) : disabled ? (
              <span className="text-muted-foreground">Read-only preview.</span>
            ) : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
