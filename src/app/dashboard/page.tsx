import {
  getDashboardStats,
  getMonthlyPnL,
  getRecentTrades,
  getDashboardInsights,
} from "@/lib/data";
import DashboardClient from "@/components/dashboard/DashboardClient";
import YearPicker from "@/components/layout/YearPicker";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
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

  const [stats, monthlyPnL, recentTrades, insights] = await Promise.all([
    getDashboardStats(year),
    getMonthlyPnL(year),
    getRecentTrades(5, year),
    getDashboardInsights({ year }),
  ]);

  return (
    <DashboardClient
      stats={stats}
      monthlyPnL={monthlyPnL}
      recentTrades={recentTrades}
      insights={insights}
      year={year}
      availableYears={availableYears}
    />
  );
}
