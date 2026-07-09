import { getAllTrades } from "@/lib/data";
import TradesListClient from "@/components/trades/TradesListClient";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";

export const dynamic = "force-dynamic";

export default async function TradesPage({
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
    <TradesListClient
      trades={trades}
      year={year}
      availableYears={availableYears}
    />
  );
}
