"use client";

import { Lock, LockOpen, Pencil, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BENCHMARK_FEES, convert, normalizeCurrency, type FxRate, type SavingsAccountView } from "@/lib/savings";
import { cn } from "@/lib/utils";
import { fmtDate, humanize, money, pct, statusTone } from "./format";
import { Sparkline, Stat } from "./ui";

function monthsAgo(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth());
}

/** Employee / employer / severance split as a stacked bar + legend. */
function DepositSplit({ a }: { a: SavingsAccountView }) {
  const cur = a.currency;
  const parts = [
    { key: "Employee", v: a.monthlyDepositEmployee ?? 0, cls: "bg-primary" },
    { key: "Employer", v: a.monthlyDepositEmployer ?? 0, cls: "bg-success" },
    { key: "Severance", v: a.monthlyDepositSeverance ?? 0, cls: "bg-accent" },
  ].filter((p) => p.v > 0);
  const total = a.monthlyDeposit;
  if (total <= 0) return <p className="text-sm text-muted-foreground">No monthly deposits</p>;
  const splitSum = parts.reduce((s, p) => s + p.v, 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-sm font-medium text-foreground">{money(total, cur)}/mo</span>
        {splitSum <= 0 ? <span className="text-xs text-muted-foreground">split not recorded</span> : null}
      </div>
      {splitSum > 0 ? (
        <>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-subtle" aria-hidden>
            {parts.map((p) => (
              <span key={p.key} className={p.cls} style={{ width: `${(p.v / total) * 100}%` }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {parts.map((p) => (
              <li key={p.key} className="inline-flex items-center gap-1">
                <span className={cn("size-2 rounded-full", p.cls)} aria-hidden />
                {p.key} <span className="num text-foreground-secondary">{money(p.v, cur)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function AccountCard({
  a,
  fx,
  history,
  ownerName,
  onEdit,
  now,
}: {
  a: SavingsAccountView;
  fx: FxRate;
  history: number[] | undefined;
  ownerName?: string;
  onEdit: () => void;
  now: Date;
}) {
  const cur = normalizeCurrency(a.currency);
  const isUsd = cur === "USD";
  const details = (a.details ?? {}) as Record<string, unknown>;
  const hasFees = a.feeDepositPct != null || a.feeAccumulationPct != null;
  const feeApplies = a.type !== "cash" && a.type !== "rsu" && a.type !== "other";
  const bench = BENCHMARK_FEES[a.type];
  const drag = a.feeDrag10y;
  const dragUsd = drag ? convert(drag.costVsBenchmark, cur, "USD", fx) : 0;
  const age = monthsAgo(a.balanceAsOf, now);
  const stale = age != null && age > 6;
  const unvested = typeof details.unvestedValue === "number" ? (details.unvestedValue as number) : null;

  return (
    <Card className="flex min-w-0 flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="min-w-0 truncate text-base font-semibold text-foreground">{a.provider}</h4>
            {a.status ? <StatusPill size="sm" tone={statusTone(a.status)} label={humanize(a.status)} /> : null}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {ownerName ? <span className="font-medium text-foreground-secondary">{ownerName}</span> : null}
            {ownerName && (a.planName || a.policyLast4) ? <span aria-hidden>·</span> : null}
            {a.planName ? <span className="truncate">{a.planName}</span> : null}
            {a.policyLast4 ? (
              <span className="num" title="Last 4 digits of the policy number">
                ••{a.policyLast4}
              </span>
            ) : null}
            <Badge variant="outline" className="ml-0.5">
              {a.country}
            </Badge>
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.provider}`} onClick={onEdit}>
          <Pencil />
        </Button>
      </div>

      {/* Balance + sparkline */}
      <div className="flex items-end justify-between gap-3 px-4 sm:px-5">
        <div className="min-w-0">
          <p className="num text-2xl font-semibold tracking-tight text-foreground">{money(a.balance, cur)}</p>
          <p className="num mt-0.5 text-xs text-muted-foreground">
            {isUsd ? `≈ ${money(a.balanceIls, "ILS")}` : `≈ ${money(a.balanceUsd, "USD")}`}
            <span aria-hidden> · </span>
            <span className={cn(stale && "font-medium text-warning")}>
              {a.balanceAsOf ? `as of ${fmtDate(a.balanceAsOf)}` : "no date"}
            </span>
          </p>
        </div>
        <Sparkline values={history ?? []} width={112} height={34} label={`${a.provider} balance history`} />
      </div>

      {/* Details */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3.5 sm:px-5">
        {a.track ? <Stat label="Track" className="col-span-2">{a.track}</Stat> : null}

        {a.type === "rsu" ? (
          <>
            <Stat label="Ticker">{typeof details.ticker === "string" ? details.ticker : "—"}</Stat>
            <Stat label="Unvested (not counted)">{unvested != null ? money(unvested, cur) : "—"}</Stat>
            {typeof details.nextVestDate === "string" ? <Stat label="Next vest">{fmtDate(details.nextVestDate)}</Stat> : null}
          </>
        ) : null}

        {feeApplies ? (
          <>
            <Stat label="Fees (dep. / acc.)">
              {hasFees ? (
                <>
                  {pct(a.feeDepositPct)} <span className="text-muted-foreground">/</span> {pct(a.feeAccumulationPct)}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-warning">
                  <TriangleAlert className="size-3.5" aria-hidden /> Missing
                </span>
              )}
            </Stat>
            <Stat label="Annual fee cost">{hasFees ? money(a.annualFees.total, cur) : "—"}</Stat>
          </>
        ) : null}

        {(a.type === "pension" || a.type === "managers_insurance") && a.projectedMonthlyPension ? (
          <Stat label="Projected pension">{money(a.projectedMonthlyPension, cur)}/mo</Stat>
        ) : null}
        {a.insuredSalary ? <Stat label="Insured salary">{money(a.insuredSalary, cur)}</Stat> : null}

        {a.liquidity ? (
          <div className="col-span-2">
            <dt className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Liquidity</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {a.liquidity.status === "liquid" ? (
                <StatusPill tone="success" icon={<LockOpen />} label="Liquid — withdrawable tax-free" />
              ) : a.liquidity.status === "locked" ? (
                <StatusPill
                  tone="info"
                  icon={<Lock />}
                  label={`Locked · ${a.liquidity.monthsRemaining} mo left`}
                />
              ) : (
                <StatusPill tone="neutral" label="Unknown — add open or liquidity date" />
              )}
              {a.liquidity.liquidityDate ? (
                <span className="text-xs text-muted-foreground">
                  {fmtDate(a.liquidity.liquidityDate)}
                  {a.liquidity.basis === "openDate+6y" ? " (open date + 6y)" : ""}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {/* Deposits */}
      {a.type !== "cash" && a.type !== "rsu" && a.type !== "brokerage" ? (
        <div className="border-t border-border px-4 py-3.5 sm:px-5">
          <p className="mb-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">Monthly deposits</p>
          <DepositSplit a={a} />
        </div>
      ) : null}

      {/* Fee drag */}
      {drag && bench ? (
        <div
          className={cn(
            "mt-auto border-t border-border px-4 py-3 text-xs sm:px-5",
            drag.costVsBenchmark > 0 ? "bg-warning-subtle/60" : "bg-success-subtle/50"
          )}
        >
          {drag.costVsBenchmark > 0 ? (
            <p className="text-foreground-secondary">
              <span className="font-semibold text-warning">10-yr fee drag {money(drag.costVsBenchmark, cur)}</span>
              {!isUsd ? <span className="num text-muted-foreground"> (≈ {money(dragUsd, "USD")})</span> : null} vs. a
              benchmark of {pct(bench.depositPct)} / {pct(bench.accumulationPct)}.
            </p>
          ) : (
            <p className="text-foreground-secondary">
              <span className="font-semibold text-success">At or below benchmark fees</span> ({pct(bench.depositPct)} /{" "}
              {pct(bench.accumulationPct)}).
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
