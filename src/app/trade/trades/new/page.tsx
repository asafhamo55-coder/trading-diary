import TradeFormClient from "@/components/trades/TradeFormClient";
import { getAccount, getErrorDefinitions, getMonthlyReview } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const [account, errorDefs] = await Promise.all([
    getAccount(),
    getErrorDefinitions(),
  ]);

  const currentMonth = new Date().getMonth() + 1;
  const review = await getMonthlyReview(currentMonth);

  return (
    <TradeFormClient
      errorDefinitions={errorDefs.map((e) => ({ id: e.id, name: e.name }))}
      commissionPerShare={account.commissionPerShare}
      riskUnit={review?.riskUnit ?? 1000}
    />
  );
}
