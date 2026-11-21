import { notFound } from "next/navigation";
import { getProperties, getPropertyById, getPropertyRecord } from "@/lib/property-data";
import { buildPropertyRows, titleWithUnit } from "@/lib/property-portfolio";
import { attentionItems } from "@/lib/property-attention";
import { keyDatesOf } from "@/lib/property-profile";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import {
  summarizeYear,
  monthsElapsed,
  occupancyForYear,
  yieldPct,
  forReturns,
  buildingCashForYear,
} from "@/lib/property";
import { todayInEastern } from "@/lib/utils";
import PropertyDetailClient from "@/components/properties/PropertyDetailClient";
import { PageCrumbs } from "@/components/layout/AppNavShell";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const property = await getPropertyById(id);
  if (!property) notFound();

  const currentYear = new Date().getFullYear();
  const txYears = Array.from(
    new Set(property.transactions.map((t) => t.year))
  ).sort((a, b) => b - a);
  const availableYears = txYears.length ? txYears : [currentYear];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);

  // Two views of the same year: `taxSummary` keeps every entry for Schedule E,
  // while `summary` drops the tax-only ones and drives all performance figures.
  const returnsTx = forReturns(property.transactions);
  const taxSummary = summarizeYear(property.transactions, year);
  const summary = summarizeYear(returnsTx, year);
  const prevSummary = summarizeYear(returnsTx, year - 1);
  const yearTx = property.transactions.filter((t) => t.year === year);
  const today = todayInEastern();
  const elapsed = monthsElapsed(year, today);
  const occ = occupancyForYear(property.tenants, year, today);
  const yieldValue = yieldPct(summary.net, property.purchasePrice, elapsed);

  // Cash-on-cash is a building-level figure, so it needs this property's
  // siblings — the same helper the properties list uses, so the two agree.
  const [allProperties, record] = await Promise.all([getProperties(), getPropertyRecord(property.id)]);
  const cash = buildingCashForYear(allProperties, year).get(property.id) ?? null;

  // The same "needs attention" rules as the list, for this property only:
  // its row is built alongside its building's siblings so the building-level
  // figures (down payment) match.
  const row = buildPropertyRows(allProperties, year, today).find((r) => r.id === property.id);
  const attention = row
    ? attentionItems([row], today, new Map([[property.id, keyDatesOf(record.profile, record.loans, today)]]))
    : [];

  return (
    <>
      <PageCrumbs items={[{ label: titleWithUnit(property) }]} />
      <PropertyDetailClient
        property={{
          id: property.id,
          title: titleWithUnit(property),
          address: property.address,
          street: property.street,
          unit: property.unit,
          city: property.city,
          state: property.state,
          zip: property.zip,
          purchasePrice: property.purchasePrice,
          downPayment: property.downPayment,
          purchaseDate: property.purchaseDate,
          currentValue: property.currentValue,
          valueAsOf: property.valueAsOf,
          mortgageBalance: property.mortgageBalance,
          mortgageAsOf: property.mortgageAsOf,
          usage: property.usage,
          notes: property.notes,
          archivedAt: property.archivedAt,
        }}
        year={year}
        availableYears={availableYears}
        summary={summary}
        taxSummary={taxSummary}
        prevSummary={prevSummary}
        transactions={yearTx}
        tenants={property.tenants}
        today={today}
        elapsed={elapsed}
        occupancy={occ}
        yieldPct={yieldValue}
        cash={cash}
        record={record}
        attention={attention}
      />
    </>
  );
}
