import { getTradesByMonth } from "@/lib/data";
import MonthlyDetailClient from "@/components/monthly/MonthlyDetailClient";

export const dynamic = "force-dynamic";

export default async function MonthlyDetailPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const trades = await getTradesByMonth(parseInt(month));
  return <MonthlyDetailClient month={parseInt(month)} trades={trades} />;
}
