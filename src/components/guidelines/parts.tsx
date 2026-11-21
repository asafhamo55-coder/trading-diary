"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  LogOut,
  PiggyBank,
  TrendingDown,
} from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import type { ActionKind, BucketStatus, GuidelineAction } from "@/lib/guidelines";
import { describeAction } from "@/lib/guidelines";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
import type { ExplainKey } from "@/lib/explain";

const BUCKET_TIP: Record<BucketStatus["id"], ExplainKey> = {
  sp500: "guidelines.bucket.sp500",
  nasdaq: "guidelines.bucket.nasdaq",
  largeCap: "guidelines.bucket.largeCap",
  cash: "guidelines.bucket.cash",
};

// Small presentational pieces shared by the Guidelines page and the
// dashboard card. All colours are theme tokens.

export function pts(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)} pts`;
}

export function pct(n: number, digits = 1): string {
  return `${(Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function DriftChip({ bucket }: { bucket: BucketStatus }) {
  if (bucket.status === "ok") {
    return <StatusPill tone="success" label={Math.abs(bucket.driftPct) < 0.05 ? "On target" : `${pts(bucket.driftPct)} · in band`} />;
  }
  return (
    <StatusPill
      tone={bucket.status === "over" ? "warning" : "info"}
      icon={bucket.status === "over" ? <ArrowUpRight aria-hidden /> : <ArrowDownRight aria-hidden />}
      label={`${pts(bucket.driftPct)} ${bucket.status}`}
    />
  );
}

/**
 * Target-vs-actual bar. The shaded zone is target ± band, the tick is the
 * target, the fill is the actual share.
 */
export function BucketBar({
  bucket,
  band,
  scaleMax,
  money,
}: {
  bucket: BucketStatus;
  band: number;
  scaleMax: number;
  money: (usd: number) => string;
}) {
  const at = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;
  const lo = Math.max(0, bucket.targetPct - band);
  const hi = bucket.targetPct + band;
  const fill =
    bucket.status === "ok" ? "bg-success" : bucket.status === "over" ? "bg-warning" : "bg-primary";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {bucket.label} <InfoTip tip={BUCKET_TIP[bucket.id]} />
        </p>
        <span className="inline-flex items-center gap-1">
          <DriftChip bucket={bucket} />
          <InfoTip tip="guidelines.drift" />
        </span>
      </div>
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-subtle"
        role="img"
        aria-label={`${bucket.label}: ${pct(bucket.actualPct)} of the account, target ${bucket.targetPct}%`}
      >
        <div className="absolute inset-y-0 bg-foreground/10" style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }} />
        <div className={cn("absolute inset-y-0 left-0 rounded-full", fill)} style={{ width: at(bucket.actualPct) }} />
        <div className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: at(bucket.targetPct) }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span className="num">
          Actual <span className="font-medium text-foreground">{pct(bucket.actualPct)}</span> · {money(bucket.actualValue)}
        </span>
        <span className="num">
          Target <span className="font-medium text-foreground">{bucket.targetPct}%</span> · {money(bucket.targetValue)}
        </span>
      </div>
    </div>
  );
}

const KIND_META: Record<ActionKind, { label: string; icon: React.ElementType; tone: string }> = {
  exit: { label: "Sell", icon: LogOut, tone: "bg-danger-subtle text-danger" },
  trim: { label: "Trim", icon: ArrowDownRight, tone: "bg-warning-subtle text-warning" },
  buy: { label: "Buy", icon: ArrowUpRight, tone: "bg-primary-subtle text-primary" },
  "dip-buy": { label: "Dip", icon: TrendingDown, tone: "bg-success-subtle text-success" },
  deposit: { label: "New money", icon: CircleDollarSign, tone: "bg-info-subtle text-info" },
  "hold-cash": { label: "Cash", icon: Banknote, tone: "bg-subtle text-foreground-secondary" },
  refill: { label: "Refill", icon: PiggyBank, tone: "bg-subtle text-foreground-secondary" },
};

export function ActionRow({
  action,
  index,
  money,
  compact = false,
}: {
  action: GuidelineAction;
  index: number;
  money: (usd: number) => string;
  compact?: boolean;
}) {
  const meta = KIND_META[action.kind];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", meta.tone)}
        aria-hidden
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          <span className="sr-only">Step {index + 1}: </span>
          {describeAction(action, money)}
        </p>
        {!compact ? <p className="mt-0.5 text-xs text-muted-foreground">{action.reason}</p> : null}
      </div>
      {!compact ? (
        <span className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
          {meta.label}
        </span>
      ) : null}
    </li>
  );
}
