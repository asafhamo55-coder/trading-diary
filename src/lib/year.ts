// Year filtering helpers — resolve selected year from URL, build Prisma date ranges.

import { prisma } from "./db";

export function parseYear(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 2000 || n > 2100) return null;
  return n;
}

/**
 * Build a `tradeDate` filter for Prisma queries.
 * Returns undefined when no year is selected (= all years).
 */
export function tradeDateYearFilter(year: number | null | undefined) {
  if (year == null) return undefined;
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  return { gte: start, lt: end };
}

/**
 * Same shape for FundTransaction (occurredAt column).
 */
export function occurredAtYearFilter(year: number | null | undefined) {
  if (year == null) return undefined;
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  return { gte: start, lt: end };
}

/**
 * Fetch the distinct trade-years on record for the user's account.
 * Used by YearPicker to populate the list.
 */
export async function getAvailableYears(accountId: string): Promise<number[]> {
  try {
    const trades = await prisma.trade.findMany({
      where: { accountId },
      select: { tradeDate: true },
    });
    const years = new Set<number>();
    for (const t of trades) {
      years.add(t.tradeDate.getFullYear());
    }
    // Always include current year so user can start adding new trades for it.
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  } catch {
    return [new Date().getFullYear()];
  }
}

/**
 * Resolve a year from URL searchParams, falling back to:
 *   - current calendar year if it has trades
 *   - else the most recent year with trades
 */
export function resolveSelectedYear(
  searchParamYear: number | null,
  availableYears: number[]
): number {
  if (searchParamYear != null && availableYears.includes(searchParamYear)) {
    return searchParamYear;
  }
  const thisYear = new Date().getFullYear();
  if (availableYears.includes(thisYear)) return thisYear;
  return availableYears[0] ?? thisYear;
}
