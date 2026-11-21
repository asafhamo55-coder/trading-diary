import { getTradesByMonth } from "@/lib/data";
import MonthlyDetailClient from "@/components/monthly/MonthlyDetailClient";
import { parseYear } from "@/lib/year";
import { MONTH_NAMES } from "@/lib/types";
import { PageCrumbs } from "@/components/layout/AppNavShell";

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
  const monthName = MONTH_NAMES[parseInt(month) - 1];
  return (
    <>
      {monthName ? <PageCrumbs items={[{ label: `${monthName} ${year}` }]} /> : null}
      <MonthlyDetailClient month={parseInt(month)} trades={trades} />
    </>
  );
}
