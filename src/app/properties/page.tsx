import { getProperties, getPropertyYears } from "@/lib/property-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import {
  summarizeYear,
  propertyTitle,
  monthlyNet,
  occupancyForYear,
  currentTenantOf,
  monthsElapsed,
  yieldPct,
  buildingCashForYear,
  forReturns,
  taxOnlyCount,
} from "@/lib/property";
import { todayInEastern } from "@/lib/utils";
import PropertiesClient from "@/components/properties/PropertiesClient";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const [properties, txYears] = await Promise.all([
    getProperties(),
    getPropertyYears(),
  ]);

  const currentYear = new Date().getFullYear();
  const availableYears = txYears.length ? txYears : [currentYear];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);
  const today = todayInEastern();
  const elapsed = monthsElapsed(year, today);

  const rows = properties.map((p) => {
    const yearTx = p.transactions.filter((t) => t.year === year);
    // Performance figures read the tax-only entries out; the entry count below
    // still describes the full list, since that is what the detail page shows.
    const summary = summarizeYear(forReturns(p.transactions), year);
    const occ = occupancyForYear(p.tenants, year, today);
    const current = currentTenantOf(p.tenants, today);
    return {
      id: p.id,
      title: propertyTitle(p),
      address: p.address,
      archived: p.archivedAt !== null,
      txCount: yearTx.length,
      income: summary.income,
      expenses: summary.expenses,
      net: summary.net,
      monthlyNet: monthlyNet(forReturns(yearTx)),
      taxOnlyCount: taxOnlyCount(yearTx),
      hasTenants: p.tenants.length > 0,
      occupiedMonths: occ.occupiedMonths,
      occupancyMonths: occ.totalMonths,
      occupancyPct: occ.totalMonths > 0 ? occ.pct : null,
      currentTenantName: current?.name ?? null,
      monthlyRent: current?.monthlyRent ?? null,
      purchasePrice: p.purchasePrice,
      downPayment: p.downPayment,
      purchaseDate: p.purchaseDate,
      currentValue: p.currentValue,
      valueAsOf: p.valueAsOf,
      mortgageBalance: p.mortgageBalance,
      usage: p.usage,
      yieldPct: yieldPct(summary.net, p.purchasePrice, elapsed),
    };
  });

  // Return on the cash invested, rolled up to the building so a multi-unit
  // address reports one figure across its units. Shared with the detail page so
  // the two never disagree; archived properties and tax-only entries are
  // excluded inside the helper.
  const cashByProperty = buildingCashForYear(properties, year);
  const rowsWithCash = rows.map((r) => {
    const cash = cashByProperty.get(r.id);
    return {
      ...r,
      cashOnCashPct: cash?.cashOnCashPct ?? null,
      cashInvested: cash?.downPayment ?? 0,
      unitCount: cash?.unitCount ?? 1,
      // Active building with entries but no down payment on file anywhere —
      // the card invites you to add one rather than guessing at a basis.
      needsDownPayment: cash != null && cash.downPayment <= 0,
    };
  });

  return (
    <PropertiesClient
      rows={rowsWithCash}
      year={year}
      availableYears={availableYears}
      elapsed={elapsed}
    />
  );
}
