import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Tailwind text-color class for a signed money value (green ≥ 0, red < 0). */
export function signedClass(value: number): string {
  return value >= 0 ? "text-profit" : "text-loss";
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Today's date as `YYYY-MM-DD` in US market time (America/New_York).
 * Trades are journaled by the Eastern market day, so new-trade forms should
 * default to this rather than the browser/UTC date. Call at render time (not
 * module scope) so the value can't freeze on a long-lived tab/PWA session.
 */
export function todayInEastern(): string {
  // en-CA formats as YYYY-MM-DD; timeZone pins it to the Eastern calendar date.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
