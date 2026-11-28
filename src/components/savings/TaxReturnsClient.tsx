"use client";

import * as React from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tab, TabGroup, TabList } from "@/components/ui/tabs";
import { useDisplayCurrency } from "@/components/ui/currency";
import type { TaxReturnDTO } from "@/lib/tax-return-data";
import type { RentalReconciliation } from "@/lib/tax-return-advisor";
import { categoryLabel } from "@/lib/property";

type Row = [label: string, value: number | null | undefined];

function Lines({ rows, money }: { rows: Row[]; money: (n: number) => string }) {
  const shown = rows.filter(([, v]) => v != null && v !== 0);
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">Nothing reported.</p>;
  return (
    <dl className="divide-y divide-border text-sm">
      {shown.map(([label, v]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-foreground-secondary">{label}</dt>
          <dd className="num font-medium text-foreground">{money(v!)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function TaxReturnsClient({
  returns,
  reconciliation,
  propertyTitles,
}: {
  returns: TaxReturnDTO[];
  reconciliation: RentalReconciliation[];
  propertyTitles: Record<string, string>;
}) {
  const { money: fmt } = useDisplayCurrency();
  const money = (n: number) => fmt(n, "USD");
  const years = [...new Set(returns.map((r) => r.taxYear))].sort((a, b) => b - a);
  const [year, setYear] = React.useState(String(years[0] ?? ""));

  const header = (
    <PageHeader
      title="Tax returns"
      description="What your filed returns declared — read-only. The advisor uses these as the source of truth."
    />
  );
  if (years.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<FileText />}
          title="No tax returns loaded yet"
          description="In Claude Code, ask to import your tax return PDFs. Only the figures are loaded — never the PDF, SSNs or account numbers."
        />
      </div>
    );
  }

  const fed = returns.find((r) => r.taxYear === Number(year) && r.jurisdiction === "US-federal");
  const ga = returns.find((r) => r.taxYear === Number(year) && r.jurisdiction === "US-GA");
  const s = fed?.data.summary;
  const d = fed?.data;
  const effective = s?.totalTax != null && s.agi ? (s.totalTax / s.agi) * 100 : null;
  const refund = s?.refund ?? (s?.amountOwed != null ? -s.amountOwed : null);
  const recon = new Map(reconciliation.filter((r) => r.declaredYear === Number(year)).map((r) => [r.propertyId, r]));

  return (
    <div className="space-y-6">
      {header}
      <TabGroup variant="segmented" value={year} onValueChange={setYear}>
        <TabList aria-label="Tax year">
          {years.map((y) => (
            <Tab key={y} value={String(y)}>
              {y}
            </Tab>
          ))}
        </TabList>
      </TabGroup>

      {fed ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {fed.filingStatus ? <span>{fed.filingStatus}</span> : null}
            {fed.preparer ? <span>· Prepared by {fed.preparer}</span> : null}
            {fed.partial ? <Badge variant="warning">Summary only (from the next year&rsquo;s comparison)</Badge> : null}
            {fed.amended ? <Badge variant="info">Amended</Badge> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Adjusted gross income" value={s?.agi != null ? money(s.agi) : "—"} />
            <Kpi label="Total tax" value={s?.totalTax != null ? money(s.totalTax) : "—"} />
            <Kpi label="Effective rate" value={effective != null ? `${effective.toFixed(1)}%` : "—"} hint={s?.marginalBracketPct ? `${s.marginalBracketPct}% bracket` : undefined} />
            <Kpi
              label={refund != null && refund < 0 ? "Amount owed" : "Refund"}
              value={refund != null ? money(Math.abs(refund)) : "—"}
              valueTone={refund != null && refund < 0 ? "negative" : "positive"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Income">
              <Lines
                money={money}
                rows={[
                  ["Wages", s?.wages],
                  ["Taxable interest", s?.taxableInterest],
                  ["Ordinary dividends", s?.ordinaryDividends],
                  ["Capital gain / loss", s?.capitalGainLoss],
                  ["Business (Schedule C)", s?.scheduleC],
                  ["Sales of business property (4797)", s?.form4797],
                  ["Rentals (Schedule E)", s?.scheduleE],
                  ["Other income", s?.otherIncome],
                  ["Total income", s?.totalIncome],
                  ["Adjustments", s?.adjustments],
                  ["Adjusted gross income", s?.agi],
                ]}
              />
            </Section>
            <Section title="Deductions, credits & tax">
              <Lines
                money={money}
                rows={[
                  ["Standard deduction", s?.standardDeduction],
                  ["Itemized: taxes", s?.itemized?.taxes],
                  ["Itemized: interest", s?.itemized?.interest],
                  ["Itemized: contributions", s?.itemized?.contributions],
                  ["Itemized total", s?.itemized?.total],
                  ["Taxable income", s?.taxableIncome],
                  ["Foreign tax credit", s?.credits?.foreignTax],
                  ["Child & dependent care credit", s?.credits?.childCare],
                  ["Self-employment tax", s?.selfEmploymentTax],
                  ["Additional Medicare tax", s?.additionalMedicare],
                  ["Net investment income tax", s?.niit],
                  ["Total tax", s?.totalTax],
                  ["Withheld (W-2)", s?.withholdingW2],
                  ["Withheld (other)", s?.withholdingOther],
                  ["Estimated payments", s?.estimatedPayments],
                  ["Total payments", s?.totalPayments],
                ]}
              />
            </Section>
          </div>

          {d && d.rentals.length > 0 ? (
            <Section title="Rentals (Schedule E)" description="Declared per property. “vs books” compares with this year’s app books, annualized.">
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">Property</th>
                      <th className="py-2 pr-3 text-right font-medium">Rent</th>
                      <th className="py-2 pr-3 text-right font-medium">Expenses</th>
                      <th className="py-2 pr-3 text-right font-medium">Depreciation</th>
                      <th className="py-2 pr-3 text-right font-medium">Net</th>
                      <th className="py-2 font-medium">vs books</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {d.rentals.map((r) => {
                      const l = r.lines;
                      const expenses = Object.entries(l)
                        .filter(([k, v]) => k !== "RENT" && k !== "OTHER_INCOME" && k !== "DEPRECIATION" && v != null && v > 0)
                        .reduce((a, [, v]) => a + (v ?? 0), 0);
                      const rc = [...recon.values()].find((x) => (r.propertyId ? x.propertyIds.includes(r.propertyId) : false)) ??
                        [...recon.values()].find((x) => x.propertyIds.some((id) => (r.unitIds ?? []).includes(id)));
                      const linkId = r.propertyId ?? r.unitIds?.[0] ?? rc?.propertyId ?? null;
                      return (
                        <tr key={r.address}>
                          <td className="py-2 pr-3">
                            {linkId ? (
                              <Link href={`/properties/${linkId}`} className="font-medium text-foreground hover:underline">
                                {propertyTitles[linkId] ?? r.address}
                              </Link>
                            ) : (
                              <span className="font-medium text-foreground">{r.address}</span>
                            )}
                            {linkId ? null : <span className="ms-2 text-xs text-muted-foreground">not in the app</span>}
                          </td>
                          <td className="num py-2 pr-3 text-right">{l.RENT != null ? money(l.RENT) : "—"}</td>
                          <td className="num py-2 pr-3 text-right">{expenses ? money(expenses) : "—"}</td>
                          <td className="num py-2 pr-3 text-right">{l.DEPRECIATION != null ? money(l.DEPRECIATION) : "—"}</td>
                          <td className="num py-2 pr-3 text-right">{r.net != null ? money(r.net) : "—"}</td>
                          <td className="py-2 text-xs text-foreground-secondary">
                            {rc && rc.diffs.length > 0
                              ? rc.diffs.map((x) => `${x.field === "totalExpenses" ? "expenses" : x.field} ${x.pct > 0 ? "+" : ""}${x.pct}%`).join(" · ")
                              : rc
                                ? "in line"
                                : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground">Line detail</summary>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {d.rentals.map((r) => (
                    <div key={r.address}>
                      <p className="mb-1 text-xs font-semibold text-foreground">{r.address}</p>
                      <Lines money={money} rows={Object.entries(r.lines).map(([k, v]) => [categoryLabel(k), v] as Row)} />
                    </div>
                  ))}
                </div>
              </details>
            </Section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {d && (d.carryovers.length > 0 || d.passiveLosses) ? (
              <Section title="Carryovers & suspended losses">
                <Lines
                  money={money}
                  rows={[
                    ["Passive losses allowed", d.passiveLosses?.allowed],
                    ["Passive losses suspended", d.passiveLosses?.suspended],
                    ...d.carryovers.map((c) => [`${c.form}: ${c.description}`, c.amount] as Row),
                  ]}
                />
              </Section>
            ) : null}
            {d?.foreign ? (
              <Section
                title="Foreign reporting"
                description={[
                  d.foreign.fbarFiled ? "FBAR filed" : d.foreign.fbarFiled === false ? "No FBAR" : null,
                  d.foreign.form8938Filed ? "Form 8938 filed" : d.foreign.form8938Filed === false ? "No Form 8938" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <Lines
                  money={money}
                  rows={[
                    ["Aggregate maximum value", d.foreign.aggregateMaxValueUsd],
                    ...d.foreign.taxCredit.map((c) => [`Foreign tax credit (${c.basket})`, c.credit] as Row),
                    ...d.foreign.accounts.map((a) => [`${a.institution}${a.type ? ` · ${a.type}` : ""} (${a.owner})`, a.maxValueUsd] as Row),
                  ]}
                />
              </Section>
            ) : null}
            {d && d.business.length > 0 ? (
              <Section title="Business (Schedule C)">
                <Lines
                  money={money}
                  rows={d.business.flatMap((b) => [
                    [`${b.activity ?? "Business"} (${b.owner}): receipts`, b.grossReceipts],
                    [`${b.activity ?? "Business"}: expenses`, b.expenses],
                    [`${b.activity ?? "Business"}: home office`, b.homeOffice],
                    [`${b.activity ?? "Business"}: net`, b.net],
                  ] as Row[])}
                />
              </Section>
            ) : null}
            {ga?.data.state ? (
              <Section title="Georgia">
                <Lines
                  money={money}
                  rows={[
                    ["Georgia AGI", ga.data.state.agi],
                    ["Taxable income", ga.data.state.taxableIncome],
                    ["Tax", ga.data.state.tax],
                    ["Credits", ga.data.state.credits],
                    ["Withheld", ga.data.state.withholding],
                    ["Refund", ga.data.state.refund],
                    ["Amount owed", ga.data.state.amountOwed],
                  ]}
                />
              </Section>
            ) : null}
          </div>
          {d && d.notes.length > 0 ? (
            <Section title="Notes from the import">
              <ul className="list-disc space-y-1 ps-5 text-sm text-foreground-secondary">
                {d.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No federal return loaded for {year}.</p>
      )}
    </div>
  );
}
