import { getTradeById } from "@/lib/data";
import TradeDetailClient from "@/components/trades/TradeDetailClient";
import { PageCrumbs } from "@/components/layout/AppNavShell";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trade = await getTradeById(id);
  return (
    <>
      {trade ? <PageCrumbs items={[{ label: trade.symbol }]} /> : null}
      <TradeDetailClient trade={trade} />
    </>
  );
}
