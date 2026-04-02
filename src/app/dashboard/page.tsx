import { getDashboardStats, getMonthlyPnL, getRecentTrades } from "@/lib/data";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, monthlyPnL, recentTrades] = await Promise.all([
    getDashboardStats(),
    getMonthlyPnL(),
    getRecentTrades(5),
  ]);

  return (
    <DashboardClient
      stats={stats}
      monthlyPnL={monthlyPnL}
      recentTrades={recentTrades}
    />
  );
}
