import { getAllTrades } from "@/lib/data";
import MonthlyOverviewClient from "@/components/monthly/MonthlyOverviewClient";

export const dynamic = "force-dynamic";

export default async function MonthlyPage() {
  const trades = await getAllTrades();
  return <MonthlyOverviewClient trades={trades} />;
}
