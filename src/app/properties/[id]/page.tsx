import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/property-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import { summarizeYear, propertyTitle } from "@/lib/property";
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
  const yearTx = property.transactions.filter((t) => t.year === year);
  const today = new Date().toISOString().slice(0, 10);

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
      transactions={yearTx}
      tenants={property.tenants}
      today={today}
    />
  );
}
