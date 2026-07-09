import { getAllTrades } from "@/lib/data";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const trades = await getAllTrades();
  return <AnalyticsClient trades={trades} />;
}
