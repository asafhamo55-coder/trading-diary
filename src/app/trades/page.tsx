import { getAllTrades } from "@/lib/data";
import TradesListClient from "@/components/trades/TradesListClient";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const trades = await getAllTrades();
  return <TradesListClient trades={trades} />;
}
