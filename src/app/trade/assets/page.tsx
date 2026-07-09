import { getDashboardInsights, getAllTrades } from "@/lib/data";
import AssetsClient from "@/components/assets/AssetsClient";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
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
    getDashboardInsights({ isAsset: true, year }),
    getAllTrades({ year }),
  ]);

  const assetTrades = allTrades.filter((t) => t.isAsset);

  return (
    <AssetsClient
      kind="asset"
      insights={insights}
      trades={assetTrades}
      year={year}
      availableYears={availableYears}
    />
  );
}
