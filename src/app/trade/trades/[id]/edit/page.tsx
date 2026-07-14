import { notFound } from "next/navigation";
import TradeFormClient, {
  type TradeFormValues,
} from "@/components/trades/TradeFormClient";
import {
  getAccount,
  getErrorDefinitions,
  getMonthlyReview,
  getTradeById,
} from "@/lib/data";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";

function tradeToFormValues(trade: Trade): Partial<TradeFormValues> {
  const legDate = (e: Trade["entries"][number]) =>
    (e.filledAt ?? trade.tradeDate).slice(0, 10);
  const buyLegs = trade.entries
    .filter((e) => e.legType === "BUY")
    .sort((a, b) => a.legOrder - b.legOrder)
    .map((e) => ({ price: String(e.price), quantity: String(e.quantity), filledAt: legDate(e) }));
  const sellLegs = trade.entries
    .filter((e) => e.legType === "SELL")
    .sort((a, b) => a.legOrder - b.legOrder)
    .map((e) => ({ price: String(e.price), quantity: String(e.quantity), filledAt: legDate(e) }));

  return {
    tradeDate: trade.tradeDate.slice(0, 10),
    symbol: trade.symbol,
    direction: trade.direction,
    tradeType: trade.tradeType ?? "",
    isSwingContinuation: trade.isSwingContinuation,
    isAsset: trade.isAsset ?? false,
    buyLegs: buyLegs.length > 0 ? buyLegs : [{ price: "", quantity: "", filledAt: "" }],
    sellLegs: sellLegs.length > 0 ? sellLegs : [{ price: "", quantity: "", filledAt: "" }],
    entryReason: trade.entryReason ?? "",
    exitReason: trade.exitReason ?? "",
    conclusions: trade.conclusions ?? "",
    chartUrl: trade.chartUrl ?? "",
    notes: trade.notes ?? "",
    errorTagIds: trade.tradeErrors.map((te) => te.errorDefinition.id),
    dailyHigh: trade.dailyHigh != null ? String(trade.dailyHigh) : "",
    dailyClose: trade.dailyClose != null ? String(trade.dailyClose) : "",
  };
}

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trade = await getTradeById(id);
  if (!trade) notFound();

  const [account, errorDefs, review] = await Promise.all([
    getAccount(),
    getErrorDefinitions(),
    getMonthlyReview(trade.month),
  ]);

  return (
    <TradeFormClient
      tradeId={trade.id}
      initialValues={tradeToFormValues(trade)}
      errorDefinitions={errorDefs.map((e) => ({ id: e.id, name: e.name }))}
      commissionPerShare={account.commissionPerShare}
      riskUnit={review?.riskUnit ?? 1000}
    />
  );
}
