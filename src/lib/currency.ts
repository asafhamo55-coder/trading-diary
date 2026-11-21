// Display-currency helpers shared by the server (cookie parsing) and the
// client (CurrencyProvider). Pure — no React, no Prisma.
import type { FxRate } from "./savings";

export type DisplayCurrency = "USD" | "ILS";

export const DISPLAY_CURRENCY_COOKIE = "hhe-display-currency";

export function parseDisplayCurrency(v: string | null | undefined): DisplayCurrency {
  return (v ?? "").toUpperCase() === "ILS" ? "ILS" : "USD";
}

/** Anything not USD is treated as ILS (the household's only two currencies). */
export function asDisplayCurrency(c: string | null | undefined): DisplayCurrency {
  const s = (c ?? "").toUpperCase().trim();
  return s === "USD" || s === "$" ? "USD" : "ILS";
}

export function currencySymbol(c: DisplayCurrency): string {
  return c === "USD" ? "$" : "₪";
}

export function convertTo(amount: number, from: DisplayCurrency, to: DisplayCurrency, usdIls: number): number {
  if (from === to || !Number.isFinite(amount)) return amount;
  return from === "USD" ? amount * usdIls : amount / usdIls;
}

export interface FormatOpts {
  /** "$1.23M" / "₪412K". */
  compact?: boolean;
  /** Max fraction digits for the non-compact form (default 0). */
  digits?: number;
  /** Pad to exactly `digits` fraction digits ("$1,234.50"). */
  fixed?: boolean;
  /** Prefix "+" on positive values. */
  signed?: boolean;
}

function trim(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(digits: number, fixed: boolean): Intl.NumberFormat {
  const key = `${digits}|${fixed}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: fixed ? digits : 0 });
    nfCache.set(key, f);
  }
  return f;
}

/**
 * Format an amount already in `currency`. Same house style as the dashboard:
 * "−$1,234" (true minus), compact "$1.23M" / "$412K" / "$9.5K" / "$950".
 */
export function formatCurrency(amount: number | null | undefined, currency: DisplayCurrency, opts: FormatOpts = {}): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const sym = currencySymbol(currency);
  const neg = amount < 0;
  const sign = neg ? "−" : opts.signed && amount > 0 ? "+" : "";
  const a = Math.abs(amount);
  if (opts.compact) {
    if (a >= 1_000_000_000) return `${sign}${sym}${trim(a / 1_000_000_000, 2)}B`;
    if (a >= 1_000_000) return `${sign}${sym}${trim(a / 1_000_000, a >= 10_000_000 ? 1 : 2)}M`;
    if (a >= 10_000) return `${sign}${sym}${Math.round(a / 1000)}K`;
    if (a >= 1_000) return `${sign}${sym}${trim(a / 1000, 1)}K`;
    return `${sign}${sym}${Math.round(a)}`;
  }
  const digits = opts.digits ?? 0;
  const v = digits === 0 ? Math.round(a) : a;
  return `${sign}${sym}${nf(digits, !!opts.fixed).format(v)}`;
}

// ── Rate provenance ────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-20" → "Nov 20". */
export function fxDateLabel(asOf: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(asOf ?? "");
  if (!m) return null;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** "Bank of Israel" / "ECB via Frankfurter" / "your saved rate" / … */
export function fxSourceName(fx: Pick<FxRate, "source" | "provider">): string {
  if (fx.source === "live") return fx.provider === "frankfurter" ? "ECB via Frankfurter" : "Bank of Israel";
  if (fx.source === "profile") return "your saved rate";
  if (fx.source === "env") return "configured rate";
  return "default rate";
}

/** "Bank of Israel, Nov 20" — source plus the rate's date when known. */
export function fxProvenance(fx: Pick<FxRate, "source" | "provider" | "asOf">): string {
  const d = fxDateLabel(fx.asOf);
  return d ? `${fxSourceName(fx)}, ${d}` : fxSourceName(fx);
}
