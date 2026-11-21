"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CandlestickChart,
  CheckCircle2,
  Copy,
  HeartPulse,
  LineChart,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { SavingsAccountView, CoverageGroup } from "@/lib/savings";
import { AllocationDonut, HistoryChart } from "./charts";
import {
  fmtDate,
  fmtIls,
  fmtMoney,
  fmtMonthShort,
  fmtPct,
  fmtSignedUsdCompact,
  fmtUsd,
  fmtUsdCompact,
  riskLabel,
  typeLabel,
} from "./format";
import type { AssetGroup, BarRow, GapItem, NetWorth, Person } from "./model";
import { personName } from "./model";

/** A Hebrew secondary label. */
export function He({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="rtl" lang="he" className={cn("text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-primary">
      <Link href={href}>
        {children}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}

// ── Allocation ─────────────────────────────────────────────────────

export function AllocationCard({ groups }: { groups: AssetGroup[] }) {
  const positive = groups.filter((g) => g.valueUsd > 0);
  const total = positive.reduce((s, g) => s + g.valueUsd, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle as="h2">Allocation by asset type</CardTitle>
        <CardDescription>Share of net assets — real estate shown as equity after mortgages.</CardDescription>
      </CardHeader>
      <CardContent>
        {positive.length === 0 ? (
          <EmptyState variant="compact" icon={<PiggyBank />} title="Nothing to allocate yet" description="Balances will appear once accounts are added." />
        ) : (
          <div className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center sm:gap-8">
            <AllocationDonut
              slices={positive.map((g) => ({ key: g.key, label: g.label, value: g.valueUsd, color: g.color }))}
              total={total}
            />
            <ul className="w-full min-w-0 flex-1 space-y-2">
              {positive.map((g) => (
                <li key={g.key} className="flex items-center gap-2.5 text-sm">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.color }} />
                  <span className="min-w-0 flex-1 text-foreground-secondary">{g.label}</span>
                  <span className="num shrink-0 font-medium text-foreground">{fmtUsdCompact(g.valueUsd)}</span>
                  <span className="num w-11 shrink-0 text-right text-xs text-muted-foreground">
                    {fmtPct((g.valueUsd / total) * 100, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bars({ rows, color }: { rows: BarRow[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.valueUsd)));
  const total = rows.reduce((s, r) => s + Math.max(0, r.valueUsd), 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-medium text-foreground">{r.label}</span>
              {r.labelHe ? <He>{r.labelHe}</He> : null}
              {r.note ? <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {r.note}</span> : null}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="num font-semibold text-foreground">{fmtUsdCompact(r.valueUsd)}</span>
              <span className="num w-9 text-right text-xs text-muted-foreground">
                {r.valueUsd > 0 ? fmtPct((r.valueUsd / total) * 100, 0) : "—"}
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle" title={`${r.label}: ${fmtUsd(r.valueUsd)}`}>
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.max(1.5, (Math.max(0, r.valueUsd) / max) * 100)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PeopleCountryCard({ people, countries }: { people: BarRow[]; countries: BarRow[] }) {
  const hasPeople = people.some((r) => r.valueUsd !== 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle as="h2">By person &amp; country</CardTitle>
        <CardDescription>Real estate and the trading account count as joint, US-held assets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasPeople ? (
          <>
            <section aria-label="By person">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">By person</h3>
              <Bars rows={people} color="var(--chart-1)" />
            </section>
            <section aria-label="By country">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">By country</h3>
              <Bars rows={countries.filter((c) => c.valueUsd !== 0)} color="var(--chart-7)" />
            </section>
          </>
        ) : (
          <EmptyState variant="compact" icon={<UserRound />} title="No owners yet" description="Accounts are split by owner once imported." />
        )}
      </CardContent>
    </Card>
  );
}

// ── History ────────────────────────────────────────────────────────

export function HistoryCard({ history }: { history: NetWorth["history"] }) {
  const last = history[history.length - 1];
  const first = history[0];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        actions={
          history.length >= 2 ? (
            <div className="text-right">
              <p className={cn("num text-sm font-semibold", last.savingsUsd >= first.savingsUsd ? "text-success" : "text-danger")}>
                {fmtSignedUsdCompact(last.savingsUsd - first.savingsUsd)}
              </p>
              <p className="text-2xs text-muted-foreground">since {fmtMonthShort(first.month)}</p>
            </div>
          ) : null
        }
      >
        <CardTitle as="h2">Savings over time</CardTitle>
        <CardDescription>Month-end retirement &amp; savings balances at today’s FX rate.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {history.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={<LineChart />}
            title="No history yet"
            description="Each imported statement adds a point. Import older annual reports to see the trend."
            action={<LinkButton href="/savings">Import statements</LinkButton>}
          />
        ) : history.length === 1 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{fmtMonthShort(last.month)}</p>
            <p className="num text-3xl font-semibold tracking-tight text-foreground">{fmtUsd(last.savingsUsd)}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              One statement so far. Import an earlier report (e.g. last year’s annual statement) to start a trend line.
            </p>
          </div>
        ) : (
          <div className="relative min-h-72 flex-1">
            <div className="absolute inset-0">
              <HistoryChart points={history} />
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Real estate and trading aren’t snapshotted yet, so this line tracks savings only.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Data gaps ──────────────────────────────────────────────────────

const GAP_ICON = {
  property: Building2,
  savings: PiggyBank,
  profile: UserRound,
  trade: CandlestickChart,
  coverage: ShieldAlert,
} as const;

export function DataGapsCard({ gaps }: { gaps: GapItem[] }) {
  const shown = gaps.slice(0, 8);
  return (
    <Card className="h-full">
      <CardHeader
        actions={gaps.length > 0 ? <Badge variant="warning">{gaps.length} open</Badge> : <StatusPill tone="success" label="Complete" />}
      >
        <CardTitle as="h2">Data gaps</CardTitle>
        <CardDescription>Fill these to sharpen the numbers and the advice.</CardDescription>
      </CardHeader>
      <CardContent>
        {gaps.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-success-subtle p-4 text-sm text-foreground">
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
            Everything the dashboard needs is filled in.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((g, i) => {
              const Icon = GAP_ICON[g.kind];
              return (
                <li key={i}>
                  <Link
                    href={g.href}
                    className="group -mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 no-underline transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border-strong" />
                    <span className="min-w-0 flex-1 text-sm text-foreground-secondary">{g.text}</span>
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                      <Icon className="size-3.5" aria-hidden />
                      <span className="hidden sm:inline">{g.where}</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {gaps.length > shown.length ? (
          <p className="mt-2 text-xs text-muted-foreground">+{gaps.length - shown.length} more on Retirement &amp; Savings.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Savings table ──────────────────────────────────────────────────

function statusPill(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (!s) return <span className="text-xs text-muted-foreground">—</span>;
  if (/(frozen|inactive|לא פעיל|מוקפא|paid.?up|dormant)/.test(s)) return <StatusPill tone="neutral" label="Frozen" />;
  if (/(active|פעיל)/.test(s)) return <StatusPill tone="success" label="Active" icon={null} />;
  return <StatusPill tone="neutral" label={status} icon={null} />;
}

function liquidityBadge(a: SavingsAccountView) {
  const l = a.liquidity;
  if (!l) return null;
  if (l.status === "liquid") return <Badge variant="success">Liquid</Badge>;
  if (l.status === "locked")
    return (
      <Badge variant="info" title={`Tax-free withdrawal from ${fmtDate(l.liquidityDate)}`}>
        Liquid {l.liquidityDate ? fmtDate(l.liquidityDate.slice(0, 7)) : "later"}
      </Badge>
    );
  return <Badge variant="neutral">Liquidity unknown</Badge>;
}

function feeCell(a: SavingsAccountView) {
  const hasFees = a.feeDepositPct != null || a.feeAccumulationPct != null;
  if (!hasFees) {
    // RSUs, cash and plain "other" have no management fee to report.
    if (["rsu", "cash", "other"].includes(a.type)) return <span className="text-xs text-muted-foreground">—</span>;
    return <Badge variant="warning">Missing</Badge>;
  }
  return (
    <div className="text-right">
      <p className="num text-sm text-foreground">
        {a.feeDepositPct != null ? `${fmtPct(a.feeDepositPct, 2)} dep` : ""}
        {a.feeDepositPct != null && a.feeAccumulationPct != null ? " · " : ""}
        {a.feeAccumulationPct != null ? `${fmtPct(a.feeAccumulationPct, 2)} bal` : ""}
      </p>
      <p className="num text-xs text-muted-foreground">{fmtUsd(a.annualFees.totalUsd)}/yr</p>
    </div>
  );
}

export function SavingsTableCard({ nw, people }: { nw: NetWorth; people: Map<string, Person> }) {
  const rows = [...nw.savings.accounts].sort((a, b) => b.balanceUsd - a.balanceUsd);
  const columns: DataTableColumn<SavingsAccountView>[] = [
    {
      key: "account",
      header: "Account",
      mobilePrimary: true,
      cell: (a) => {
        const t = typeLabel(a.type);
        return (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{t.en}</p>
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              <span>{a.provider}</span>
              {t.he ? <He>{t.he}</He> : null}
            </p>
          </div>
        );
      },
    },
    {
      key: "owner",
      header: "Owner",
      cell: (a) => <span className="text-sm text-foreground-secondary">{personName(people, a.owner)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <div className="flex flex-wrap gap-1.5">
          {statusPill(a.status)}
          {liquidityBadge(a)}
        </div>
      ),
    },
    { key: "fees", header: "Fees", numeric: true, hideBelowLg: true, cell: feeCell },
    {
      key: "balance",
      header: "Balance",
      numeric: true,
      mobileAside: true,
      cell: (a) => (
        <div className="text-right">
          <p className="num font-semibold text-foreground">{fmtUsd(a.balanceUsd)}</p>
          <p className="num text-xs text-muted-foreground">
            {a.currency.toUpperCase() === "USD" ? fmtIls(a.balanceIls) : fmtMoney(a.balance, a.currency)}
            {a.balanceAsOf ? ` · ${fmtDate(a.balanceAsOf)}` : ""}
          </p>
        </div>
      ),
    },
  ];
  return (
    <section aria-labelledby="savings-table-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="savings-table-title" className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            Savings at a glance
          </h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} account{rows.length === 1 ? "" : "s"} · {fmtUsd(nw.savings.totalUsd)} · deposits{" "}
            {fmtUsd(nw.savings.monthlyDepositsUsd)}/mo
          </p>
        </div>
        <LinkButton href="/savings">Manage accounts</LinkButton>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        mobile="cards"
        caption="Savings accounts"
        empty={
          <EmptyState
            variant="plain"
            icon={<Wallet />}
            title="No savings accounts yet"
            description="Import your pension, manager’s insurance and study-fund reports (דוח שנתי) or add a 401(k) by hand."
            action={
              <Button asChild size="sm">
                <Link href="/savings">Add accounts</Link>
              </Button>
            }
          />
        }
      />
    </section>
  );
}

// ── Coverage ───────────────────────────────────────────────────────

export function CoverageCard({ nw, people }: { nw: NetWorth; people: Map<string, Person> }) {
  const cov = nw.coverage;
  const owners = [...new Set([...cov.groups.map((g) => g.owner), ...cov.gaps.map((g) => g.owner)])];
  const dupCost = cov.duplicates.reduce((s, g) => s + g.monthlyCostUsd, 0);
  return (
    <Card>
      <CardHeader
        actions={
          <div className="flex flex-wrap justify-end gap-1.5">
            {cov.duplicates.length > 0 ? <StatusPill tone="warning" icon={<Copy aria-hidden />} label={`${cov.duplicates.length} overlap${cov.duplicates.length === 1 ? "" : "s"}`} /> : null}
            {cov.gaps.length > 0 ? <StatusPill tone="danger" label={`${cov.gaps.length} gap${cov.gaps.length === 1 ? "" : "s"}`} /> : null}
          </div>
        }
      >
        <CardTitle as="h2">Insurance &amp; benefits coverage</CardTitle>
        <CardDescription>
          {cov.groups.length > 0 ? (
            <>
              Total premiums <span className="num font-medium text-foreground">{fmtUsd(cov.totalMonthlyCostUsd)}/mo</span>
              {dupCost > 0 ? (
                <>
                  {" "}· overlapping cover costs <span className="num font-medium text-warning">{fmtUsd(dupCost)}/mo</span>
                </>
              ) : null}
            </>
          ) : (
            "Life, disability, health and other cover across Israeli and US policies."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {owners.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={<ShieldCheck />}
            title="No coverage recorded"
            description="Coverage imports with your pension reports, or add employer benefits (life, LTD, health) on Retirement & Savings."
            action={<LinkButton href="/savings">Add benefits</LinkButton>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {owners.map((o) => (
              <OwnerCoverage
                key={o}
                name={personName(people, o)}
                nameHe={people.get(o)?.nameHe}
                groups={cov.groups.filter((g) => g.owner === o)}
                gaps={cov.gaps.filter((g) => g.owner === o)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OwnerCoverage({
  name,
  nameHe,
  groups,
  gaps,
}: {
  name: string;
  nameHe?: string | null;
  groups: CoverageGroup[];
  gaps: NetWorth["coverage"]["gaps"];
}) {
  const monthly = groups.reduce((s, g) => s + g.monthlyCostUsd, 0);
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="flex items-baseline gap-2 font-semibold text-foreground">
          {name}
          {nameHe ? <He>{nameHe}</He> : null}
        </p>
        <span className="num text-xs text-muted-foreground">{monthly > 0 ? `${fmtUsd(monthly)}/mo` : ""}</span>
      </div>
      <ul className="divide-y divide-border">
        {groups.map((g) => {
          const r = riskLabel(g.risk);
          return (
            <li key={g.risk} className={cn("px-4 py-2.5", g.duplicate && "bg-warning-subtle/70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
                    <HeartPulse className="size-3.5 self-center text-muted-foreground" aria-hidden />
                    {r.en}
                    {r.he ? <He>{r.he}</He> : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {g.items.map((it) => `${it.source}${it.insideSavingsAccount ? " (in fund)" : ""}`).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {g.totalCoverageUsd > 0 ? <p className="num text-sm text-foreground">{fmtUsdCompact(g.totalCoverageUsd)}</p> : null}
                  {g.monthlyCostUsd > 0 ? <p className="num text-xs text-muted-foreground">{fmtUsd(g.monthlyCostUsd)}/mo</p> : null}
                </div>
              </div>
              {g.duplicate ? (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
                  <Copy className="size-3" aria-hidden />
                  Covered {g.count}× across {g.countries.join(" + ")} — check for overlap
                </p>
              ) : null}
            </li>
          );
        })}
        {gaps.map((g) => (
          <li key={`gap-${g.risk}`} className="flex items-start gap-2 bg-danger-subtle/70 px-4 py-2.5 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-foreground">No {riskLabel(g.risk).en.toLowerCase()} cover</p>
              <p className="text-xs text-foreground-secondary">{g.message}</p>
            </div>
          </li>
        ))}
        {groups.length === 0 && gaps.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">Nothing recorded.</li>
        ) : null}
      </ul>
    </div>
  );
}

