import { getDashboardInsights, getAllTrades } from "@/lib/data";
import AssetsClient from "@/components/assets/AssetsClient";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";

export const dynamic = "force-dynamic";

export default async function StocksPage({
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

  const [insights, allTrades] = await Promise.all([
    getDashboardInsights({ isAsset: false, year }),
    getAllTrades({ year }),
  ]);

  const stockTrades = allTrades.filter((t) => !t.isAsset);

  return (
    <AssetsClient
      kind="stock"
      insights={insights}
      trades={stockTrades}
      year={year}
      availableYears={availableYears}
    />
  );
}
