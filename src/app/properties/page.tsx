import { getProperties, getPropertyRecords, getPropertyYears } from "@/lib/property-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import { monthsElapsed } from "@/lib/property";
import { buildPropertyRows } from "@/lib/property-portfolio";
import { attentionItems } from "@/lib/property-attention";
import { keyDatesOf, type KeyDate } from "@/lib/property-profile";
import { todayInEastern } from "@/lib/utils";
import PropertiesClient from "@/components/properties/PropertiesClient";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const [properties, txYears, records] = await Promise.all([
    getProperties(),
    getPropertyYears(),
    getPropertyRecords(),
  ]);

  const currentYear = new Date().getFullYear();
  const availableYears = txYears.length ? txYears : [currentYear];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);
  const today = todayInEastern();
  const elapsed = monthsElapsed(year, today);

  // Rows carry the building-level cash-on-cash (shared with the detail page
  // through buildingCashForYear) and everything the list shows.
  const rows = buildPropertyRows(properties, year, today);

  // Insurance renewals, tax due dates, ARM resets, … from each record.
  const keyDates = new Map<string, KeyDate[]>();
  for (const [id, rec] of records) keyDates.set(id, keyDatesOf(rec.profile, rec.loans, today));
  const attention = attentionItems(rows, today, keyDates);

  return (
    <PropertiesClient
      rows={rows}
      attention={attention}
      year={year}
      availableYears={availableYears}
      elapsed={elapsed}
    />
  );
}
