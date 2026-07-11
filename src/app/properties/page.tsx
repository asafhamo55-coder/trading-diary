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
    const summary = summarizeYear(p.transactions, year);
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
      monthlyNet: monthlyNet(yearTx),
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
      yieldPct: yieldPct(summary.net, p.purchasePrice, elapsed),
    };
  });

  return (
    <PropertiesClient
      rows={rows}
      year={year}
      availableYears={availableYears}
      elapsed={elapsed}
    />
  );
}
