import { getAllTrades } from "@/lib/data";
import MonthlyOverviewClient from "@/components/monthly/MonthlyOverviewClient";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const account = await prisma.account.findFirst();
  const availableYears = account
    ? await getAvailableYears(account.id)
    : [new Date().getFullYear()];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);

  const trades = await getAllTrades({ year });
  return (
    <MonthlyOverviewClient
      trades={trades}
      year={year}
      availableYears={availableYears}
    />
  );
}
