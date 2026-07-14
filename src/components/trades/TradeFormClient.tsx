"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn, formatCurrency, todayInEastern } from "@/lib/utils";
import { TRADE_TYPES, type Direction } from "@/lib/types";
import {
  computeAllTradeFields,
  calculateCommission,
  type TradeLegData,
} from "@/lib/calculations/trade";
import { useForm, useFieldArray } from "react-hook-form";

interface LegInput {
  price: string;
  quantity: string;
  filledAt: string;
}

export interface TradeFormValues {
  tradeDate: string;
  symbol: string;
  direction: Direction;
  tradeType: string;
  isSwingContinuation: boolean;
  isAsset: boolean;
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

interface ErrorDef {
  id: string;
  name: string;
}

interface TradeFormClientProps {
  initialValues?: Partial<TradeFormValues>;
  tradeId?: string;
  errorDefinitions: ErrorDef[];
  commissionPerShare: number;
  riskUnit: number;
}

function deriveLeg(
  leg: LegInput,
  legType: "BUY" | "SELL",
  legOrder: number,
  commissionPerShare: number
): TradeLegData | null {
  const price = parseFloat(leg.price);
  const quantity = parseFloat(leg.quantity);
  if (isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0)
    return null;
  return {
    legType,
    price,
    quantity,
    commission: calculateCommission(price, quantity, commissionPerShare),
    legOrder,
  };
}

const DEFAULTS: TradeFormValues = {
  // Placeholder only — the real default is computed at mount in `defaultValues`
  // (see below) so it uses the Eastern market date and never freezes on a
  // long-lived tab/PWA session. Do NOT compute a date at module scope here.
  tradeDate: "",
  symbol: "",
  direction: "LONG",
  tradeType: "",
  isSwingContinuation: false,
  isAsset: false,
  buyLegs: [{ price: "", quantity: "", filledAt: "" }],
  sellLegs: [{ price: "", quantity: "", filledAt: "" }],
  entryReason: "",
  exitReason: "",
  conclusions: "",
  chartUrl: "",
  notes: "",
  errorTagIds: [],
  dailyHigh: "",
  dailyClose: "",
};

export default function TradeFormClient({
  initialValues,
  tradeId,
  errorDefinitions,
  commissionPerShare,
  riskUnit,
}: TradeFormClientProps) {
  const router = useRouter();
  const isEdit = Boolean(tradeId);
  const [analysisOpen, setAnalysisOpen] = useState(
    Boolean(
      initialValues?.entryReason ||
        initialValues?.exitReason ||
        initialValues?.conclusions ||
        initialValues?.chartUrl ||
        initialValues?.notes
    )
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, control, watch, handleSubmit, setValue } =
    useForm<TradeFormValues>({
      defaultValues: {
        ...DEFAULTS,
        ...initialValues,
        // New trades default to today's Eastern market date; edits keep theirs.
        tradeDate: initialValues?.tradeDate || todayInEastern(),
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
      const d = deriveLeg(leg, "BUY", i + 1, commissionPerShare);
      if (d) allEntries.push(d);
    });
    watchAll.sellLegs.forEach((leg, i) => {
      const d = deriveLeg(leg, "SELL", i + 1, commissionPerShare);
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
      riskUnit
    );
  }, [
    watchAll.buyLegs,
    watchAll.sellLegs,
    watchAll.direction,
    watchAll.symbol,
    watchAll.dailyHigh,
    watchAll.dailyClose,
    commissionPerShare,
    riskUnit,
  ]);

  const onSubmit = useCallback(
    async (values: TradeFormValues) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const entries: {
          legType: "BUY" | "SELL";
          price: number;
          quantity: number;
          legOrder: number;
          filledAt: string;
        }[] = [];
        values.buyLegs.forEach((leg, i) => {
          const price = parseFloat(leg.price);
          const quantity = parseFloat(leg.quantity);
          if (price > 0 && quantity > 0) {
            entries.push({ legType: "BUY", price, quantity, legOrder: i + 1, filledAt: leg.filledAt || values.tradeDate });
          }
        });
        values.sellLegs.forEach((leg, i) => {
          const price = parseFloat(leg.price);
          const quantity = parseFloat(leg.quantity);
          if (price > 0 && quantity > 0) {
            entries.push({ legType: "SELL", price, quantity, legOrder: i + 1, filledAt: leg.filledAt || values.tradeDate });
          }
        });

        if (entries.length === 0) {
          setSubmitError("Add at least one buy or sell leg with valid price and quantity.");
          setSubmitting(false);
          return;
        }
        if (!values.symbol.trim()) {
          setSubmitError("Symbol is required.");
          setSubmitting(false);
          return;
        }
        if (!values.tradeDate) {
          setSubmitError("Trade date is required.");
          setSubmitting(false);
          return;
        }

        const dailyHighNum = parseFloat(values.dailyHigh);
        const dailyCloseNum = parseFloat(values.dailyClose);

        const payload = {
          tradeDate: values.tradeDate,
          month: new Date(values.tradeDate + "T00:00:00").getMonth() + 1,
          symbol: values.symbol.trim().toUpperCase(),
          direction: values.direction,
          tradeType: values.tradeType || null,
          isSwingContinuation: values.isSwingContinuation,
          isAsset: values.isAsset,
          entries,
          entryReason: values.entryReason || null,
          exitReason: values.exitReason || null,
          conclusions: values.conclusions || null,
          chartUrl: values.chartUrl || "",
          notes: values.notes || null,
          dailyHigh: isNaN(dailyHighNum) ? null : dailyHighNum,
          dailyClose: isNaN(dailyCloseNum) ? null : dailyCloseNum,
          errorIds: values.errorTagIds,
        };

        const url = isEdit ? `/api/trades/${tradeId}` : "/api/trades";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Save failed (HTTP ${res.status})`);
        }

        const saved = await res.json();
        const id = saved?.id ?? tradeId;
        router.push(id ? `/trade/trades/${id}` : "/trade/trades");
        router.refresh();
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Failed to save trade."
        );
        setSubmitting(false);
      }
    },
    [isEdit, tradeId, router]
  );

  const inputClass =
    "w-full rounded-lg bg-[var(--muted)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/60 focus:border-[#3B82F6]/60 transition-shadow";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-1.5";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href={isEdit && tradeId ? `/trade/trades/${tradeId}` : "/trade/trades"}
            className="pressable inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {isEdit ? "Back to Trade" : "Back to Trades"}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Edit Trade" : "New Trade"}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 space-y-5 shadow-sm">
            <h2 className="text-base font-semibold">Trade Details</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>Trade Date</label>
                <input
                  type="date"
                  {...register("tradeDate")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Month</label>
                <div className="rounded-lg bg-[var(--muted)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
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
              <div>
                <label className={labelClass}>Symbol</label>
                <input
                  type="text"
                  placeholder="AAPL"
                  {...register("symbol")}
                  className={cn(inputClass, "uppercase")}
                />
              </div>
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

            <div>
              <label className={labelClass}>Direction</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("direction", "LONG")}
                  className={cn(
                    "pressable flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    direction === "LONG"
                      ? "bg-[#00D68F]/15 text-[#00D68F] border border-[#00D68F]/30 ring-1 ring-[#00D68F]/20"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]"
                  )}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setValue("direction", "SHORT")}
                  className={cn(
                    "pressable flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
                    direction === "SHORT"
                      ? "bg-[#FF4D6A]/15 text-[#FF4D6A] border border-[#FF4D6A]/30 ring-1 ring-[#FF4D6A]/20"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]"
                  )}
                >
                  SHORT
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("isSwingContinuation")}
                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--muted)] text-[#3B82F6] focus:ring-[#3B82F6]"
                />
                <span className="text-sm text-[var(--muted-foreground)]">
                  Swing Continuation
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("isAsset")}
                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--muted)] text-[#A78BFA] focus:ring-[#A78BFA]"
                />
                <span className="text-sm text-[var(--muted-foreground)]">Asset</span>
              </label>
            </div>
          </div>

          {/* Buy Legs */}
          <LegsSection
            title="Buy Legs"
            fields={buyFields}
            name="buyLegs"
            watchLegs={watchAll.buyLegs}
            register={register}
            append={() => appendBuy({ price: "", quantity: "", filledAt: "" })}
            remove={removeBuy}
            commissionPerShare={commissionPerShare}
            inputClass={inputClass}
            labelClass={labelClass}
          />

          {/* Sell Legs */}
          <LegsSection
            title="Sell Legs (leave empty for open trades)"
            fields={sellFields}
            name="sellLegs"
            watchLegs={watchAll.sellLegs}
            register={register}
            append={() => appendSell({ price: "", quantity: "", filledAt: "" })}
            remove={removeSell}
            commissionPerShare={commissionPerShare}
            inputClass={inputClass}
            labelClass={labelClass}
          />

          {/* Computed Preview */}
          {computed && (
            <div className="rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/5 p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                <h2 className="text-base font-semibold">Computed Preview</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Mini label="Total Shares" value={String(computed.totalShares)} />
                <Mini
                  label="Avg Buy Price"
                  value={formatCurrency(computed.avgBuyPrice)}
                />
                <Mini
                  label="Avg Sell Price"
                  value={
                    computed.avgSellPrice > 0
                      ? formatCurrency(computed.avgSellPrice)
                      : "—"
                  }
                />
                <Mini
                  label="Position Value"
                  value={formatCurrency(computed.totalPositionValue)}
                />
                <Mini
                  label="P&L"
                  value={formatCurrency(computed.totalPnL)}
                  color={
                    computed.totalPnL > 0
                      ? "text-[#00D68F]"
                      : computed.totalPnL < 0
                      ? "text-[#FF4D6A]"
                      : undefined
                  }
                />
                <Mini
                  label="Commission Total"
                  value={formatCurrency(computed.totalCommissions)}
                />
              </div>
            </div>
          )}

          {/* Post-Trade Analysis */}
          <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-[var(--muted)]/60 transition-colors"
            >
              <h2 className="text-base font-semibold">Post-Trade Analysis</h2>
              {analysisOpen ? (
                <ChevronUp className="h-5 w-5 text-[var(--muted-foreground)]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[var(--muted-foreground)]" />
              )}
            </button>
            {analysisOpen && (
              <div className="px-6 pb-6 space-y-4 border-t border-[var(--border)] pt-4">
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
          {errorDefinitions.length > 0 && (
            <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-sm">
              <h2 className="text-base font-semibold mb-4">Error Tags</h2>
              <div className="flex flex-wrap gap-2.5">
                {errorDefinitions.map((err) => (
                  <label
                    key={err.id}
                    className="pressable flex items-center gap-2 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 hover:border-[#3B82F6]/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      value={err.id}
                      {...register("errorTagIds")}
                      className="h-4 w-4 rounded border-[var(--border)] bg-[var(--muted)] text-[#3B82F6] focus:ring-[#3B82F6]"
                    />
                    <span className="text-sm text-[var(--muted-foreground)]">{err.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Money Left on Table (LONG only) */}
          {direction === "LONG" && (
            <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-sm">
              <h2 className="text-base font-semibold mb-4">
                Money Left on Table
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Daily High</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    {...register("dailyHigh")}
                    className={cn(inputClass, "font-mono")}
                  />
                </div>
                <div>
                  <label className={labelClass}>Daily Close</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    {...register("dailyClose")}
                    className={cn(inputClass, "font-mono")}
                  />
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-2.5 rounded-lg bg-[#FF4D6A]/10 border border-[#FF4D6A]/30 text-[#FF4D6A] text-sm px-4 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Link
              href={isEdit && tradeId ? `/trade/trades/${tradeId}` : "/trade/trades"}
              className="pressable inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B82F6] px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-[#3B82F6]/20 hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Save Trade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
        {label}
      </div>
      <div className={cn("text-sm font-data font-semibold", color)}>
        {value}
      </div>
    </div>
  );
}

interface LegsSectionProps {
  title: string;
  fields: { id: string }[];
  name: "buyLegs" | "sellLegs";
  watchLegs: LegInput[];
  register: ReturnType<typeof useForm<TradeFormValues>>["register"];
  append: () => void;
  remove: (index: number) => void;
  commissionPerShare: number;
  inputClass: string;
  labelClass: string;
}

function LegsSection({
  title,
  fields,
  name,
  watchLegs,
  register,
  append,
  remove,
  commissionPerShare,
  inputClass,
  labelClass,
}: LegsSectionProps) {
  return (
    <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-sm">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      <div className="space-y-3">
        {fields.map((field, index) => {
          const prc = parseFloat(watchLegs[index]?.price ?? "") || 0;
          const qty = parseFloat(watchLegs[index]?.quantity ?? "") || 0;
          const commission =
            qty > 0 && prc > 0
              ? calculateCommission(prc, qty, commissionPerShare)
              : 0;
          return (
            <div
              key={field.id}
              className="flex items-end gap-3 flex-wrap rounded-lg border border-[var(--border)]/60 bg-[var(--muted)]/20 p-3"
            >
              <div className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--muted)] text-xs font-data font-semibold text-[var(--muted-foreground)]">
                {index + 1}
              </div>
              <div className="w-[150px]">
                <label className={labelClass}>Date</label>
                <input
                  type="date"
                  {...register(`${name}.${index}.filledAt` as const)}
                  className={cn(inputClass, "font-mono")}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className={labelClass}>Price</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  {...register(`${name}.${index}.price` as const)}
                  className={cn(inputClass, "font-mono")}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className={labelClass}>Quantity</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0"
                  {...register(`${name}.${index}.quantity` as const)}
                  className={cn(inputClass, "font-mono")}
                />
              </div>
              <div className="w-[120px]">
                <label className={labelClass}>Commission</label>
                <div className="rounded-lg bg-[var(--muted)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] font-mono">
                  {formatCurrency(commission)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length <= 1}
                className="pressable rounded-lg p-2 text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Remove leg"
                aria-label="Remove leg"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
      {fields.length < 5 && (
        <button
          type="button"
          onClick={append}
          className="pressable mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm font-medium text-[#3B82F6] hover:border-[#3B82F6]/50 hover:bg-[#3B82F6]/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Leg
        </button>
      )}
    </div>
  );
}
