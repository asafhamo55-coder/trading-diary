"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CandlestickChart,
  Flag,
  Landmark,
  Receipt,
  Upload,
} from "lucide-react";
import type { AdvisorReportDTO } from "@/lib/savings-data";
import type { ActionStatusMap } from "@/lib/advisor-report";
import { Card } from "@/components/ui/card";
import { Kpi } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";
import AdvisorPanel from "./AdvisorPanel";
import {
  AllocationCard,
  CoverageCard,
  DataGapsCard,
  He,
  HistoryCard,
  PeopleCountryCard,
  SavingsTableCard,
} from "./sections";
import { fmtDate, fmtMonthShort, fmtPct } from "./format";
import { useDisplayCurrency } from "@/components/ui/currency";
import { formatCurrency, fxProvenance } from "@/lib/currency";
import {
  assetGroups,
  byCountry,
  byPerson,
  dataGaps,
  headerInfo,
  kpis,
  peopleDirectory,
  personName,
  type NetWorth,
  type Profile,
} from "./model";

const EMPTY_CONTACTS: never[] = [];

export interface HouseholdDashboardProps {
  netWorth: NetWorth | null;
  profile: Profile | null;
  advisorReport: AdvisorReportDTO | null;
  /** Ticked advisor action items; null → the panel fetches them. */
  advisorActions?: ActionStatusMap | null;
  hasAnthropicKey: boolean;
  /** Set when the net-worth query itself failed. */
  loadError?: string | null;
}

export default function HouseholdDashboard({
  netWorth: nw,
  profile,
  advisorReport,
  advisorActions = null,
  hasAnthropicKey,
  loadError,
}: HouseholdDashboardProps) {
  const people = useMemo(() => peopleDirectory(profile, nw), [profile, nw]);
  const gaps = useMemo(() => dataGaps(nw, profile, people), [nw, profile, people]);
  const ownerName = (k: string) => personName(people, k);
  const advisorAccounts = useMemo(() => nw?.savings.accounts ?? [], [nw]);
  const propertyTitles = useMemo(() => Object.fromEntries((nw?.properties ?? []).map((p) => [p.id, p.title])), [nw]);
  const { money, currency } = useDisplayCurrency();
  const compact = (usd: number) => money(usd, "USD", { compact: true });

  if (!nw) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="flex items-start gap-3 border-danger/30 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Couldn’t load household net worth</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {loadError ?? "The savings database didn’t respond."} The cash-flow section below is unaffected.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isEmpty = nw.savings.accounts.length === 0 && nw.properties.length === 0 && !nw.trade;
  const k = kpis(nw);
  const groups = assetGroups(nw);
  const info = headerInfo(nw);
  const hasData = !isEmpty;

  return (
    <div className="space-y-6 md:space-y-8">
      <Header asOf={nw.asOf} />

      {isEmpty ? (
        <EmptyState
          icon={<Upload />}
          title="Bring your household onto one page"
          description="Import the annual reports for your pension, manager’s insurance and study funds, add the 401(k) and RSUs, and set property values — net worth, fees, coverage and the advisor all build from there."
          action={
            <Button asChild>
              <Link href="/savings">Set up Retirement &amp; Savings</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="secondary">
              <Link href="/properties">Add property values</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Hero nw={nw} groups={groups} info={info} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-6">
            <Kpi
              label="Retirement savings (IL)"
              tip="kpi.ilRetirement"
              icon={<Landmark />}
              href="/savings"
              value={
                k.ilRetirementCount
                  ? currency === "ILS"
                    ? formatCurrency(k.ilRetirementIls, "ILS", { compact: true })
                    : compact(k.ilRetirementUsd)
                  : "—"
              }
              hint={
                k.ilRetirementCount
                  ? currency === "ILS"
                    ? `${k.ilRetirementCount} funds`
                    : `${formatCurrency(k.ilRetirementIls, "ILS", { compact: true })} · ${k.ilRetirementCount} funds`
                  : "Not added yet"
              }
            />
            <Kpi
              label="US retirement (401k)"
              tip="kpi.usRetirement"
              icon={<Flag />}
              href="/savings"
              value={k.usRetirementCount ? compact(k.usRetirementUsd) : "—"}
              hint={k.usRetirementCount ? `${k.usRetirementCount} account${k.usRetirementCount === 1 ? "" : "s"}` : "Not added yet"}
            />
            <Kpi
              label="Equity comp (RSU)"
              tip="kpi.rsu"
              icon={<Briefcase />}
              href="/savings"
              value={k.rsuCount ? compact(k.rsuUsd) : "—"}
              hint={k.rsuCount ? "vested shares held" : "Not added yet"}
            />
            <Kpi
              label="Real estate equity"
              tip="kpi.realEstateEquity"
              icon={<Building2 />}
              href="/properties"
              value={k.propertyCount ? compact(k.realEstateEquityUsd) : "—"}
              valueTone={k.realEstateEquityUsd < 0 ? "negative" : "default"}
              hint={
                k.propertyCount
                  ? `${k.propertyCount} properties · ${compact(k.mortgagesUsd)} owed`
                  : "No properties yet"
              }
            />
            <Kpi
              label="Trading account"
              tip="kpi.tradingAccount"
              icon={<CandlestickChart />}
              href="/trade/dashboard"
              value={k.tradeUsd != null ? compact(k.tradeUsd) : "—"}
              valueTone={k.tradeUsd != null && k.tradeUsd < 0 ? "negative" : "default"}
              hint={k.tradeUsd != null ? "realized equity" : "Not connected"}
            />
            <Kpi
              label="Annual fees paid"
              tip="kpi.annualFees"
              icon={<Receipt />}
              href="/savings"
              value={k.accountsWithFees ? money(k.annualFeesUsd) : "—"}
              valueTone={k.accountsWithFees ? "default" : "muted"}
              hint={
                k.feeDrag10yUsd > 0
                  ? `${compact(k.feeDrag10yUsd)} 10-yr drag vs benchmark`
                  : k.accountsWithFees
                    ? `${k.accountsWithFees} accounts with fees`
                    : "Fee data missing"
              }
            />
          </div>
        </>
      )}

      <AdvisorPanel
        initialReport={advisorReport}
        hasKey={hasAnthropicKey}
        ownerName={ownerName}
        hasData={hasData}
        initialStatuses={advisorActions}
        accounts={advisorAccounts}
        contacts={profile?.contacts ?? EMPTY_CONTACTS}
        propertyTitles={propertyTitles}
      />

      {hasData ? (
        <>
          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <AllocationCard groups={groups} />
            <PeopleCountryCard people={byPerson(nw, people)} countries={byCountry(nw)} />
          </div>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <HistoryCard history={nw.history} />
            </div>
            <div className="lg:col-span-2">
              <DataGapsCard gaps={gaps} />
            </div>
          </div>

          <SavingsTableCard nw={nw} people={people} />
          <CoverageCard nw={nw} people={people} />
        </>
      ) : gaps.length > 0 ? (
        <DataGapsCard gaps={gaps} />
      ) : null}
    </div>
  );
}

function Header({ asOf }: { asOf?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Hamo Home Equity</p>
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">Household net worth</h1>
        <p className="text-sm text-muted-foreground">
          Every household asset in one place — pensions, study funds, 401(k), RSUs, rentals and trading.
        </p>
      </div>
      {asOf ? <p className="text-xs text-muted-foreground">As of {fmtDate(asOf)}</p> : null}
    </header>
  );
}

function Hero({
  nw,
  groups,
  info,
}: {
  nw: NetWorth;
  groups: ReturnType<typeof assetGroups>;
  info: ReturnType<typeof headerInfo>;
}) {
  const positive = groups.filter((g) => g.valueUsd > 0);
  const barTotal = positive.reduce((s, g) => s + g.valueUsd, 0) || 1;
  const change = info.savingsChange;
  const negative = nw.totals.netWorthUsd < 0;
  const { money, currency } = useDisplayCurrency();
  const compact = (usd: number) => money(usd, "USD", { compact: true });
  // Net worth: the payload carries both currencies at the same rate, so show
  // the chosen one big and the other as the secondary line.
  const primary =
    currency === "ILS" ? formatCurrency(nw.totals.netWorthIls, "ILS") : formatCurrency(nw.totals.netWorthUsd, "USD");
  const secondary =
    currency === "ILS" ? formatCurrency(nw.totals.netWorthUsd, "USD") : formatCurrency(nw.totals.netWorthIls, "ILS");
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Net worth <InfoTip tip="networth.total" />
          </p>
          <p
            className={cn(
              "num mt-2 text-4xl font-semibold leading-none tracking-[-0.02em] sm:text-5xl md:text-6xl",
              negative ? "text-danger" : "text-foreground"
            )}
          >
            {primary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span className="num text-lg font-medium text-foreground-secondary">{secondary}</span>
            {change ? (
              <span
                className={cn(
                  "num inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                  change.deltaUsd >= 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"
                )}
              >
                {change.deltaUsd >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                {change.deltaUsd >= 0 ? "+" : "−"}
                {compact(Math.abs(change.deltaUsd))}
                {change.pct != null ? ` (${fmtPct(Math.abs(change.pct))})` : ""}
              </span>
            ) : null}
            {change ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                savings since {fmtMonthShort(change.fromMonth)} <InfoTip tip="networth.savingsChange" />
              </span>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm lg:text-right">
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
              Assets <InfoTip tip="networth.assets" />
            </dt>
            <dd className="num text-base font-semibold text-foreground">{compact(nw.totals.assetsUsd)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
              Liabilities <InfoTip tip="networth.liabilities" />
            </dt>
            <dd className="num text-base font-semibold text-foreground">
              {nw.totals.liabilitiesUsd > 0 ? `−${compact(nw.totals.liabilitiesUsd)}` : compact(0)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
              Monthly deposits <InfoTip tip="networth.monthlyDeposits" />
            </dt>
            <dd className="num text-base font-semibold text-foreground">{compact(nw.savings.monthlyDepositsUsd)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground lg:justify-end">
              Accounts <InfoTip tip="networth.accounts" />
            </dt>
            <dd className="num text-base font-semibold text-foreground">
              {nw.savings.accounts.length + nw.properties.length + (nw.trade ? 1 : 0)}
            </dd>
          </div>
        </dl>
      </div>

      {positive.length > 0 ? (
        <div className="relative border-t border-border px-5 pb-5 pt-4 md:px-7">
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Asset mix">
            {positive.map((g) => (
              <div
                key={g.key}
                title={`${g.label}: ${money(g.valueUsd)}`}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(g.valueUsd / barTotal) * 100}%`, background: g.color }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <li className="flex items-center">
              <span className="sr-only">Asset mix</span>
              <InfoTip tip="networth.assetMix" />
            </li>
            {positive.map((g) => (
              <li key={g.key} className="flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden className="size-2 rounded-[2px]" style={{ background: g.color }} />
                {g.label}
                <span className="num font-medium text-foreground-secondary">{fmtPct((g.valueUsd / barTotal) * 100, 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-2xs text-muted-foreground">
            {info.oldestBalanceAsOf
              ? `Balances from ${fmtDate(info.oldestBalanceAsOf)}${info.newestBalanceAsOf !== info.oldestBalanceAsOf ? ` to ${fmtDate(info.newestBalanceAsOf)}` : ""} · `
              : ""}
            ₪{nw.fx.usdIls.toFixed(2)} = $1 ({fxProvenance(nw.fx)}) <InfoTip tip="fx.usdIls" className="size-3.5" /> ·{" "}
            <He className="text-2xs">שווי נקי משפחתי</He>
          </p>
        </div>
      ) : null}
    </Card>
  );
}
