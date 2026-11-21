"use client";

import * as React from "react";
import type { FxRate } from "@/lib/savings";
import {
  DISPLAY_CURRENCY_COOKIE,
  asDisplayCurrency,
  convertTo,
  currencySymbol,
  formatCurrency,
  fxProvenance,
  type DisplayCurrency,
  type FormatOpts,
} from "@/lib/currency";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type { DisplayCurrency } from "@/lib/currency";

export interface DisplayCurrencyValue {
  currency: DisplayCurrency;
  /** ILS per 1 USD. */
  rate: number;
  source: FxRate["source"];
  provider: FxRate["provider"];
  asOf: string | null;
  /** The rate as an FxRate (for the domain helpers in lib/savings). */
  fx: FxRate;
  /** "Bank of Israel, Nov 20". */
  provenance: string;
  symbol: string;
  toggle: () => void;
  setCurrency: (c: DisplayCurrency) => void;
  /** Convert an amount in `from` to the display currency (a number, for charts). */
  toDisplay: (amount: number, from?: string) => number;
  /** Convert + format: `money(1200, "ILS")` → "$361" or "₪1,200". */
  money: (amount: number | null | undefined, from?: string, opts?: FormatOpts) => string;
  /** Format an amount that's already in the display currency (axis labels etc.). */
  formatDisplay: (amount: number | null | undefined, opts?: FormatOpts) => string;
  /** True when `from` differs from the display currency (show the native value as a secondary line). */
  isForeign: (from: string | null | undefined) => boolean;
}

const CurrencyContext = React.createContext<DisplayCurrencyValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

function writeCookie(c: DisplayCurrency) {
  try {
    document.cookie = `${DISPLAY_CURRENCY_COOKIE}=${c}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/**
 * Global display currency. `initialCurrency` comes from the cookie on the
 * server (so SSR renders the chosen currency — no flash) and `fx` is the
 * resolved rate (profile override → live → env → default).
 */
export function CurrencyProvider({
  initialCurrency,
  fx,
  children,
}: {
  initialCurrency: DisplayCurrency;
  fx: FxRate;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = React.useState<DisplayCurrency>(initialCurrency);

  const setCurrency = React.useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    writeCookie(c);
  }, []);

  const value = React.useMemo<DisplayCurrencyValue>(() => {
    const rate = fx.usdIls;
    const toDisplay = (amount: number, from: string = "USD") =>
      convertTo(amount, asDisplayCurrency(from), currency, rate);
    return {
      currency,
      rate,
      source: fx.source,
      provider: fx.provider ?? null,
      asOf: fx.asOf ?? null,
      fx,
      provenance: fxProvenance(fx),
      symbol: currencySymbol(currency),
      toggle: () => setCurrency(currency === "USD" ? "ILS" : "USD"),
      setCurrency,
      toDisplay,
      money: (amount, from = "USD", opts) =>
        amount == null || !Number.isFinite(amount) ? "—" : formatCurrency(toDisplay(amount, from), currency, opts),
      formatDisplay: (amount, opts) => formatCurrency(amount, currency, opts),
      isForeign: (from) => asDisplayCurrency(from) !== currency,
    };
  }, [currency, fx, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

const FALLBACK_FX: FxRate = { usdIls: 3.7, source: "default", asOf: null, provider: null };

/**
 * The display currency. Outside a provider it degrades to USD at the default
 * rate with a no-op toggle, so a component never crashes when mounted alone.
 */
export function useDisplayCurrency(): DisplayCurrencyValue {
  const ctx = React.useContext(CurrencyContext);
  if (ctx) return ctx;
  const toDisplay = (amount: number, from: string = "USD") => convertTo(amount, asDisplayCurrency(from), "USD", FALLBACK_FX.usdIls);
  return {
    currency: "USD",
    rate: FALLBACK_FX.usdIls,
    source: FALLBACK_FX.source,
    provider: null,
    asOf: null,
    fx: FALLBACK_FX,
    provenance: fxProvenance(FALLBACK_FX),
    symbol: "$",
    toggle: () => {},
    setCurrency: () => {},
    toDisplay,
    money: (amount, from = "USD", opts) =>
      amount == null || !Number.isFinite(amount) ? "—" : formatCurrency(toDisplay(amount, from), "USD", opts),
    formatDisplay: (amount, opts) => formatCurrency(amount, "USD", opts),
    isForeign: (from) => asDisplayCurrency(from) !== "USD",
  };
}

export function useHasCurrencyProvider(): boolean {
  return React.useContext(CurrencyContext) != null;
}

const OPTIONS: { value: DisplayCurrency; label: string; name: string }[] = [
  { value: "USD", label: "$", name: "US dollars" },
  { value: "ILS", label: "₪", name: "Israeli shekels" },
];

/**
 * Segmented "$ | ₪" switch for the top bar. A radiogroup: Tab focuses the
 * selected option, ←/→ (or Space/Enter on either) switch. 36px tall to match
 * the theme toggle; each option is a ≥36px tap target on phones.
 */
export function CurrencyToggle({ className }: { className?: string }) {
  const hasProvider = useHasCurrencyProvider();
  const { currency, setCurrency, rate, provenance } = useDisplayCurrency();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  if (!hasProvider) return null;

  const rateText = rate.toFixed(rate >= 10 ? 1 : 2);
  const tip = `Showing ${currencySymbol(currency)} at ${rateText} (${provenance})`;

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? OPTIONS.length - 1 : (i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + OPTIONS.length) % OPTIONS.length;
    setCurrency(OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <Tooltip content={tip} side="bottom" align="end">
      <div
        role="radiogroup"
        aria-label={`Display currency. ${tip}`}
        className={cn(
          "relative flex h-9 shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5",
          className
        )}
      >
        <span
          aria-hidden
          className="absolute bottom-0.5 top-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-md bg-[var(--card)] shadow-sm ring-1 ring-[var(--border)] transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: currency === "ILS" ? "translateX(100%)" : "translateX(0)" }}
        />
        {OPTIONS.map((o, i) => {
          const active = o.value === currency;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.name}
              tabIndex={active ? 0 : -1}
              onClick={() => setCurrency(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "pressable relative z-10 inline-flex h-full min-w-9 items-center justify-center rounded-md px-2.5 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                active ? "text-accent-blue" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Tooltip>
  );
}
