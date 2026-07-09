import { getTradesByMonth } from "@/lib/data";
import MonthlyDetailClient from "@/components/monthly/MonthlyDetailClient";
import { parseYear } from "@/lib/year";

export const dynamic = "force-dynamic";

export default async function MonthlyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ month: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { month } = await params;
  const sp = await searchParams;
  const year = parseYear(sp.year) ?? new Date().getFullYear();
  const trades = await getTradesByMonth(parseInt(month), year);
  return <MonthlyDetailClient month={parseInt(month)} trades={trades} />;
}
