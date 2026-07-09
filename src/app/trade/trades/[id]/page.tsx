import { getTradeById } from "@/lib/data";
import TradeDetailClient from "@/components/trades/TradeDetailClient";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trade = await getTradeById(id);
  return <TradeDetailClient trade={trade} />;
}
