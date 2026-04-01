"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { TRADE_TYPES, type Direction } from "@/lib/types";
import { DEMO_ACCOUNT, DEMO_ERROR_DEFINITIONS } from "@/lib/demo-data";
import {
  computeAllTradeFields,
  calculateCommission,
  type TradeLegData,
} from "@/lib/calculations/trade";
import { useForm, useFieldArray, Controller } from "react-hook-form";

interface LegInput {
  price: string;
  quantity: string;
}

interface TradeFormValues {
  tradeDate: string;
  symbol: string;
  direction: Direction;
  tradeType: string;
  isSwingContinuation: boolean;
  buyLegs: LegInput[];
  sellLegs: LegInput[];
  entryReason: string;
  exitReason: string;
  conclusions: string;
  chartUrl: string;
  notes: string;
  errorTagIds: string[];
  dailyHigh: string;
  dailyClose: string;
}

function deriveLeg(
  leg: LegInput,
  legType: "BUY" | "SELL",
  legOrder: number
): TradeLegData | null {
  const price = parseFloat(leg.price);
  const quantity = parseFloat(leg.quantity);
  if (isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0)
    return null;
  return {
    legType,
    price,
    quantity,
    commission: calculateCommission(
      quantity,
      DEMO_ACCOUNT.commissionPerShare,
      DEMO_ACCOUNT.minimumCommission
    ),
    legOrder,
  };
}

export default function NewTradePage() {
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const { register, control, watch, handleSubmit, setValue } =
    useForm<TradeFormValues>({
      defaultValues: {
        tradeDate: new Date().toISOString().slice(0, 10),
        symbol: "",
        direction: "LONG",
        tradeType: "",
        isSwingContinuation: false,
        buyLegs: [{ price: "", quantity: "" }],
        sellLegs: [{ price: "", quantity: "" }],
        entryReason: "",
        exitReason: "",
        conclusions: "",
        chartUrl: "",
        notes: "",
        errorTagIds: [],
        dailyHigh: "",
        dailyClose: "",
      },
    });

  const {
    fields: buyFields,
    append: appendBuy,
    remove: removeBuy,
  } = useFieldArray({ control, name: "buyLegs" });

  const {
    fields: sellFields,
    append: appendSell,
    remove: removeSell,
  } = useFieldArray({ control, name: "sellLegs" });

  const watchAll = watch();
  const direction = watchAll.direction;
  const tradeDate = watchAll.tradeDate;
  const derivedMonth = tradeDate
    ? new Date(tradeDate + "T00:00:00").getMonth() + 1
    : null;

  const computed = useMemo(() => {
    const allEntries: TradeLegData[] = [];

    watchAll.buyLegs.forEach((leg, i) => {
      const d = deriveLeg(leg, "BUY", i + 1);
      if (d) allEntries.push(d);
    });
    watchAll.sellLegs.forEach((leg, i) => {
      const d = deriveLeg(leg, "SELL", i + 1);
      if (d) allEntries.push(d);
    });

    if (allEntries.length === 0) return null;

    const dailyHigh = parseFloat(watchAll.dailyHigh) || null;
    const dailyClose = parseFloat(watchAll.dailyClose) || null;

    return computeAllTradeFields(
      {
        direction: watchAll.direction,
        symbol: watchAll.symbol,
        entries: allEntries,
        dailyHigh,
        dailyClose,
      },
      250
    );
  }, [
    watchAll.buyLegs,
    watchAll.sellLegs,
    watchAll.direction,
    watchAll.symbol,
    watchAll.dailyHigh,
    watchAll.dailyClose,
  ]);

  const onSubmit = useCallback(() => {
    alert("Trade saved!");
  }, []);

  const inputClass =
    "w-full rounded-lg bg-[#1C2130] border border-[#2A3040] px-3 py-2 text-sm text-[#E8ECF4] placeholder:text-[#8892A6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]";
  const labelClass = "block text-sm font-medium text-[#8892A6] mb-1";

  return (
    <div className="min-h-screen bg-[#0C0F14] text-[#E8ECF4]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/trades"
            className="inline-flex items-center gap-1.5 text-sm text-[#8892A6] hover:text-[#E8ECF4] transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trades
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">New Trade</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6 space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Trade Date */}
              <div>
                <label className={labelClass}>Trade Date</label>
                <input
                  type="date"
                  {...register("tradeDate")}
                  className={inputClass}
                />
              </div>

              {/* Month (derived) */}
              <div>
                <label className={labelClass}>Month</label>
                <div className="rounded-lg bg-[#1C2130] border border-[#2A3040] px-3 py-2 text-sm text-[#8892A6]">
                  {derivedMonth
                    ? [
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ][derivedMonth - 1]
                    : "—"}
                </div>
              </div>

              {/* Symbol */}
              <div>
                <label className={labelClass}>Symbol</label>
                <input
                  type="text"
                  placeholder="AAPL"
                  {...register("symbol")}
                  className={cn(inputClass, "uppercase")}
                />
              </div>

              {/* Trade Type */}
              <div>
                <label className={labelClass}>Trade Type</label>
                <select {...register("tradeType")} className={inputClass}>
                  <option value="">Select type...</option>
                  {TRADE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Direction Toggle */}
            <div>
              <label className={labelClass}>Direction</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("direction", "LONG")}
                  className={cn(
                    "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    direction === "LONG"
                      ? "bg-[#00D68F]/15 text-[#00D68F] border border-[#00D68F]/30"
                      : "bg-[#1C2130] text-[#8892A6] border border-[#2A3040] hover:text-[#E8ECF4]"
                  )}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setValue("direction", "SHORT")}
                  className={cn(
                    "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    direction === "SHORT"
                      ? "bg-[#FF4D6A]/15 text-[#FF4D6A] border border-[#FF4D6A]/30"
                      : "bg-[#1C2130] text-[#8892A6] border border-[#2A3040] hover:text-[#E8ECF4]"
                  )}
                >
                  SHORT
                </button>
              </div>
            </div>

            {/* Swing Continuation */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("isSwingContinuation")}
                className="h-4 w-4 rounded border-[#2A3040] bg-[#1C2130] text-[#3B82F6] focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-[#8892A6]">
                Swing Continuation
              </span>
            </label>
          </div>

          {/* Buy Legs */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
            <h2 className="text-base font-semibold mb-4">Buy Legs</h2>
            <div className="space-y-3">
              {buyFields.map((field, index) => {
                const qty = parseFloat(watchAll.buyLegs[index]?.quantity) || 0;
                const commission =
                  qty > 0
                    ? calculateCommission(
                        qty,
                        DEMO_ACCOUNT.commissionPerShare,
                        DEMO_ACCOUNT.minimumCommission
                      )
                    : 0;
                return (
                  <div
                    key={field.id}
                    className="flex items-end gap-3 flex-wrap"
                  >
                    <div className="flex-1 min-w-[140px]">
                      <label className={labelClass}>Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register(`buyLegs.${index}.price`)}
                        className={cn(inputClass, "font-mono")}
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className={labelClass}>Quantity</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="0"
                        {...register(`buyLegs.${index}.quantity`)}
                        className={cn(inputClass, "font-mono")}
                      />
                    </div>
                    <div className="w-[120px]">
                      <label className={labelClass}>Commission</label>
                      <div className="rounded-lg bg-[#1C2130] border border-[#2A3040] px-3 py-2 text-sm text-[#8892A6] font-mono">
                        {formatCurrency(commission)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBuy(index)}
                      disabled={buyFields.length <= 1}
                      className="rounded-lg p-2 text-[#8892A6] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            {buyFields.length < 5 && (
              <button
                type="button"
                onClick={() => appendBuy({ price: "", quantity: "" })}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#3B82F6] hover:text-[#3B82F6]/80 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Leg
              </button>
            )}
          </div>

          {/* Sell Legs */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
            <h2 className="text-base font-semibold mb-4">Sell Legs</h2>
            <div className="space-y-3">
              {sellFields.map((field, index) => {
                const qty =
                  parseFloat(watchAll.sellLegs[index]?.quantity) || 0;
                const commission =
                  qty > 0
                    ? calculateCommission(
                        qty,
                        DEMO_ACCOUNT.commissionPerShare,
                        DEMO_ACCOUNT.minimumCommission
                      )
                    : 0;
                return (
                  <div
                    key={field.id}
                    className="flex items-end gap-3 flex-wrap"
                  >
                    <div className="flex-1 min-w-[140px]">
                      <label className={labelClass}>Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register(`sellLegs.${index}.price`)}
                        className={cn(inputClass, "font-mono")}
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className={labelClass}>Quantity</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="0"
                        {...register(`sellLegs.${index}.quantity`)}
                        className={cn(inputClass, "font-mono")}
                      />
                    </div>
                    <div className="w-[120px]">
                      <label className={labelClass}>Commission</label>
                      <div className="rounded-lg bg-[#1C2130] border border-[#2A3040] px-3 py-2 text-sm text-[#8892A6] font-mono">
                        {formatCurrency(commission)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSell(index)}
                      disabled={sellFields.length <= 1}
                      className="rounded-lg p-2 text-[#8892A6] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            {sellFields.length < 5 && (
              <button
                type="button"
                onClick={() => appendSell({ price: "", quantity: "" })}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#3B82F6] hover:text-[#3B82F6]/80 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Leg
              </button>
            )}
          </div>

          {/* Computed Preview */}
          {computed && (
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
              <h2 className="text-base font-semibold mb-4">
                Computed Preview
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <div className="text-xs text-[#8892A6] mb-1">
                    Total Shares
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {computed.totalShares}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8892A6] mb-1">
                    Avg Buy Price
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {formatCurrency(computed.avgBuyPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8892A6] mb-1">
                    Avg Sell Price
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {computed.avgSellPrice > 0
                      ? formatCurrency(computed.avgSellPrice)
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8892A6] mb-1">
                    Position Value
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {formatCurrency(computed.totalPositionValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8892A6] mb-1">P&L</div>
                  <div
                    className={cn(
                      "text-sm font-mono font-semibold",
                      computed.totalPnL > 0 && "text-[#00D68F]",
                      computed.totalPnL < 0 && "text-[#FF4D6A]"
                    )}
                  >
                    {formatCurrency(computed.totalPnL)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#8892A6] mb-1">
                    Commission Total
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    {formatCurrency(computed.totalCommissions)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Post-Trade Analysis */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] overflow-hidden">
            <button
              type="button"
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-[#1C2130] transition-colors"
            >
              <h2 className="text-base font-semibold">
                Post-Trade Analysis
              </h2>
              {analysisOpen ? (
                <ChevronUp className="h-5 w-5 text-[#8892A6]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#8892A6]" />
              )}
            </button>
            {analysisOpen && (
              <div className="px-6 pb-6 space-y-4 border-t border-[#2A3040] pt-4">
                <div>
                  <label className={labelClass}>Entry Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Why did you enter this trade?"
                    {...register("entryReason")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Exit Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Why did you exit?"
                    {...register("exitReason")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Conclusions</label>
                  <textarea
                    rows={3}
                    placeholder="What did you learn?"
                    {...register("conclusions")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Chart URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    {...register("chartUrl")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Additional notes..."
                    {...register("notes")}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Tags */}
          <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
            <h2 className="text-base font-semibold mb-4">Error Tags</h2>
            <div className="flex flex-wrap gap-3">
              {DEMO_ERROR_DEFINITIONS.map((err) => (
                <label
                  key={err.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    value={err.id}
                    {...register("errorTagIds")}
                    className="h-4 w-4 rounded border-[#2A3040] bg-[#1C2130] text-[#3B82F6] focus:ring-[#3B82F6]"
                  />
                  <span className="text-sm text-[#8892A6]">{err.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Daily High / Daily Close (LONG only) */}
          {direction === "LONG" && (
            <div className="rounded-xl bg-[#151921] border border-[#2A3040] p-6">
              <h2 className="text-base font-semibold mb-4">
                Money Left on Table
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Daily High</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("dailyHigh")}
                    className={cn(inputClass, "font-mono")}
                  />
                </div>
                <div>
                  <label className={labelClass}>Daily Close</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("dailyClose")}
                    className={cn(inputClass, "font-mono")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link
              href="/trades"
              className="rounded-lg border border-[#2A3040] bg-[#151921] px-5 py-2.5 text-sm font-medium text-[#8892A6] hover:text-[#E8ECF4] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors"
            >
              Save Trade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
