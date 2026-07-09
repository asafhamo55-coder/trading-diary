import { getProperties, getPropertyYears } from "@/lib/property-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import { summarizeYear, propertyTitle } from "@/lib/property";
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

  const rows = properties.map((p) => {
    const summary = summarizeYear(p.transactions, year);
    return {
      id: p.id,
      title: propertyTitle(p),
      address: p.address,
      archived: p.archivedAt !== null,
      txCount: p.transactions.filter((t) => t.year === year).length,
      income: summary.income,
      expenses: summary.expenses,
      net: summary.net,
    };
  });

  return (
    <PropertiesClient
      rows={rows}
      year={year}
      availableYears={availableYears}
    />
  );
}
