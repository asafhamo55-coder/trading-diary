import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/property-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import {
  summarizeYear,
  propertyTitle,
  monthsElapsed,
  occupancyForYear,
  yieldPct,
} from "@/lib/property";
import { todayInEastern } from "@/lib/utils";
import PropertyDetailClient from "@/components/properties/PropertyDetailClient";

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

  const summary = summarizeYear(property.transactions, year);
  const prevSummary = summarizeYear(property.transactions, year - 1);
  const yearTx = property.transactions.filter((t) => t.year === year);
  const today = todayInEastern();
  const elapsed = monthsElapsed(year, today);
  const occ = occupancyForYear(property.tenants, year, today);
  const yieldValue = yieldPct(summary.net, property.purchasePrice, elapsed);

  return (
    <PropertyDetailClient
      property={{
        id: property.id,
        title: propertyTitle(property),
        address: property.address,
        street: property.street,
        unit: property.unit,
        city: property.city,
        state: property.state,
        zip: property.zip,
        purchasePrice: property.purchasePrice,
        purchaseDate: property.purchaseDate,
        notes: property.notes,
        archivedAt: property.archivedAt,
      }}
      year={year}
      availableYears={availableYears}
      summary={summary}
      prevSummary={prevSummary}
      transactions={yearTx}
      tenants={property.tenants}
      today={today}
      elapsed={elapsed}
      occupancy={occ}
      yieldPct={yieldValue}
    />
  );
}
