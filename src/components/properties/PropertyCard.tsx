"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, Home, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useDisplayCurrency } from "@/components/ui/currency";
import { MONTH_ABBR } from "@/lib/property";
import { formatShortDate } from "@/lib/property-attention";
import { appreciationOf, equityOf, type PropertyRow } from "@/lib/property-portfolio";

/** "+12.3%" / "−4.0%" with a true minus. */
export function fmtPct(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}%`;
}

export function toneClass(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  return v > 0 ? "text-success" : v < 0 ? "text-danger" : "text-foreground";
}

/** Leased / Vacant pill. Text plus icon, never colour alone. */
export function LeaseStatus({ row: r }: { row: PropertyRow }) {
  return r.currentTenantName ? (
    <StatusPill tone="success" label="Leased" />
  ) : (
    <StatusPill tone="danger" label="Vacant" />
  );
}

/** "Jane Doe · $2,100/mo · ends Mar 3, 2027", or the vacancy context. */
export function TenantLine({ row: r, className }: { row: PropertyRow; className?: string }) {
  const { money } = useDisplayCurrency();
  if (!r.currentTenantName) {
    return (
      <p className={cn("truncate text-xs text-muted-foreground", className)}>
        {r.lastLeaseEnd ? `Since ${formatShortDate(r.lastLeaseEnd)}` : r.hasTenants ? "No current lease" : "No lease on file"}
      </p>
    );
  }
  const parts = [
    r.monthlyRent != null ? `${money(r.monthlyRent)}/mo` : null,
    r.leaseEnd ? `ends ${formatShortDate(r.leaseEnd)}` : "month-to-month",
  ].filter(Boolean);
  return (
    <p className={cn("min-w-0 truncate text-xs text-muted-foreground", className)}>
      <span className="text-foreground-secondary">{r.currentTenantName}</span>
      {parts.length ? <span className="num"> · {parts.join(" · ")}</span> : null}
    </p>
  );
}

/**
 * Value split into mortgage and equity. The figures are spelled out next to
 * it, so the bar is decorative for screen readers.
 */
export function EquityBar({
  value,
  mortgage,
  className,
}: {
  value: number | null;
  mortgage: number | null;
  className?: string;
}) {
  if (value == null || value <= 0) {
    return <div aria-hidden className={cn("h-2 rounded-full bg-subtle", className)} />;
  }
  const debtPct = Math.max(0, Math.min(100, ((mortgage ?? 0) / value) * 100));
  return (
    <div aria-hidden className={cn("flex h-2 overflow-hidden rounded-full bg-subtle", className)}>
      <div className="h-full bg-border-strong" style={{ width: `${debtPct}%` }} />
      <div className="h-full bg-success" style={{ width: `${100 - debtPct}%` }} />
    </div>
  );
}

/** Tiny monthly net bars for the months elapsed. */
export function MiniBars({ values, elapsed, label }: { values: number[]; elapsed: number; label: string }) {
  const { money } = useDisplayCurrency();
  const bars = values.slice(0, Math.max(1, elapsed));
  const maxAbs = Math.max(1, ...bars.map((v) => Math.abs(v)));
  return (
    <div
      role="img"
      aria-label={`${label}: ${bars.map((v, i) => `${MONTH_ABBR[i]} ${money(v)}`).join(", ")}`}
      className="flex h-6 items-end gap-0.5"
    >
      {bars.map((v, i) => (
        <div
          key={i}
          className={cn("min-h-[2px] flex-1 rounded-sm", v >= 0 ? "bg-success/70" : "bg-danger/70")}
          style={{ height: `${Math.max(8, Math.min(100, (Math.abs(v) / maxAbs) * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function ArchiveButton({
  archived,
  busy,
  onClick,
  title,
}: {
  archived: boolean;
  busy: boolean;
  onClick: () => void;
  title: string;
}) {
  const label = `${archived ? "Restore" : "Archive"} ${title}`;
  return (
    <Tooltip content={archived ? "Restore property" : "Archive property"}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : archived ? (
          <ArchiveRestore className="size-4" aria-hidden />
        ) : (
          <Archive className="size-4" aria-hidden />
        )}
      </Button>
    </Tooltip>
  );
}

function Figure({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("num truncate text-sm font-semibold text-foreground", className)}>{children}</dd>
    </div>
  );
}

export function PropertyCard({
  row: r,
  elapsed,
  busy,
  compact,
  onArchive,
  onUnarchive,
}: {
  row: PropertyRow;
  elapsed: number;
  busy: boolean;
  compact?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
}) {
  const { money } = useDisplayCurrency();
  const partialYear = elapsed > 0 && elapsed < 12;
  const appr = appreciationOf(r);
  const equity = equityOf(r);

  return (
    <Card
      variant="interactive"
      className={cn("relative flex flex-col gap-3 p-4 sm:p-5", r.archived && "opacity-75")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {/* Stretched link: the whole card navigates, the archive button sits above it. */}
            <Link
              href={`/properties/${r.id}`}
              className="rounded-sm no-underline after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {r.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{r.address}</span>
          </p>
        </div>
        <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
          {r.archived ? <Badge variant="neutral">Archived</Badge> : <LeaseStatus row={r} />}
          {onArchive || onUnarchive ? (
            <ArchiveButton
              archived={r.archived}
              busy={busy}
              title={r.title}
              onClick={(onArchive ?? onUnarchive)!}
            />
          ) : null}
        </div>
      </div>

      {!compact ? <TenantLine row={r} /> : null}

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Net {partialYear ? "YTD" : "for the year"}</p>
          <p className={cn("num text-2xl font-semibold tracking-tight", toneClass(r.net))}>
            {money(r.net, "USD", { signed: true })}
          </p>
          <p className="num text-xs text-muted-foreground">
            {money(r.income)} in · {money(r.expenses)} out
          </p>
        </div>
        {!compact && r.txCount > 0 ? (
          <div className="w-28 shrink-0">
            <MiniBars values={r.monthlyNet} elapsed={elapsed} label={`Monthly net for ${r.title}`} />
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div className="space-y-2 border-t border-border pt-3">
          <dl className="grid grid-cols-3 gap-2">
            <Figure label="Value">{r.currentValue != null ? money(r.currentValue, "USD", { compact: true }) : "—"}</Figure>
            <Figure label="Mortgage" className={r.mortgageBalance == null ? "text-muted-foreground" : undefined}>
              {r.mortgageBalance != null ? money(r.mortgageBalance, "USD", { compact: true }) : "Add"}
            </Figure>
            <Figure label="Equity">{equity != null ? money(equity, "USD", { compact: true }) : "—"}</Figure>
          </dl>
          <EquityBar value={r.currentValue} mortgage={r.mortgageBalance} />
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          Cash-on-cash{partialYear ? " YTD" : ""}
          {r.unitCount > 1 ? <Badge variant="neutral">{r.unitCount} units</Badge> : null}
        </span>
        {r.cashOnCashPct != null ? (
          <span className={cn("num font-semibold", toneClass(r.cashOnCashPct))}>
            {fmtPct(r.cashOnCashPct)} <span className="font-normal text-muted-foreground">on {money(r.cashInvested, "USD", { compact: true })}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{r.needsDownPayment ? "Add a down payment" : "—"}</span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {r.txCount} entr{r.txCount !== 1 ? "ies" : "y"}
          {r.taxOnlyCount > 0 && ` · ${r.taxOnlyCount} tax only`}
        </span>
        <span className="num">
          {r.yieldPct != null ? `${r.yieldPct.toFixed(1)}% yield` : null}
          {appr != null ? (
            <span className={cn("ml-2", toneClass(appr))}>{fmtPct(appr * 100)} appr.</span>
          ) : null}
        </span>
      </div>
    </Card>
  );
}

/** The family's own home: value, mortgage, equity. Excluded from rental figures. */
export function ResidenceCard({ row: r }: { row: PropertyRow }) {
  const { money } = useDisplayCurrency();
  const equity = equityOf(r);
  return (
    <Card variant="interactive" className="relative flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
            <Home className="size-4 shrink-0 text-primary" aria-hidden />
            <Link
              href={`/properties/${r.id}`}
              className="truncate rounded-sm no-underline after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {r.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{r.address}</span>
          </p>
        </div>
        <StatusPill tone="info" label="Primary residence" icon={<Home aria-hidden />} />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Figure label="Value" className={r.currentValue == null ? "text-muted-foreground" : undefined}>
          {r.currentValue != null ? money(r.currentValue, "USD", { compact: true }) : "Add"}
        </Figure>
        <Figure label="Mortgage" className={r.mortgageBalance == null ? "text-muted-foreground" : undefined}>
          {r.mortgageBalance != null ? money(r.mortgageBalance, "USD", { compact: true }) : "Add"}
        </Figure>
        <Figure label="Equity" className={toneClass(equity)}>
          {equity != null ? money(equity, "USD", { compact: true }) : "—"}
        </Figure>
      </dl>
      <EquityBar value={r.currentValue} mortgage={r.mortgageBalance} />
      <p className="text-xs text-muted-foreground">Counts in net worth only, not in rental returns.</p>
    </Card>
  );
}
