// Live USD→ILS rate sources. Pure parsing + a plain fetcher with an injectable
// `fetch`, so it's unit-testable; the Next cache wrapper lives in fx-server.ts.

/** A rate read from an external source. `asOf` is the rate's own date (YYYY-MM-DD). */
export interface LiveFxQuote {
  usdIls: number;
  asOf: string | null;
  provider: "boi" | "frankfurter";
}

/** Bank of Israel official representative rate (SDMX, CSV). */
export const BOI_USD_ILS_URL =
  "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?format=csv&lastNObservations=1";

/** ECB reference rates via Frankfurter (api.frankfurter.app now 301s here). */
export const FRANKFURTER_USD_ILS_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=ILS";

/** Sane bounds — anything outside is treated as a bad payload, not a rate. */
function plausible(rate: number): boolean {
  return Number.isFinite(rate) && rate > 1 && rate < 10;
}

function isoDate(s: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((s ?? "").trim());
  return m ? m[1] : null;
}

/**
 * Parse the BOI SDMX CSV. Header names the columns (TIME_PERIOD, OBS_VALUE);
 * the last data row is the most recent observation.
 */
export function parseBoiCsv(csv: string): LiveFxQuote | null {
  const lines = csv
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toUpperCase());
  const iVal = header.indexOf("OBS_VALUE");
  const iDate = header.indexOf("TIME_PERIOD");
  if (iVal < 0) return null;
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rate = Number(cols[iVal]);
    if (plausible(rate)) return { usdIls: rate, asOf: iDate >= 0 ? isoDate(cols[iDate]) : null, provider: "boi" };
  }
  return null;
}

/** Parse Frankfurter `{ base:"USD", date, rates:{ ILS } }`. */
export function parseFrankfurter(json: unknown): LiveFxQuote | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { date?: unknown; rates?: { ILS?: unknown } };
  const rate = Number(j.rates?.ILS);
  if (!plausible(rate)) return null;
  return { usdIls: rate, asOf: isoDate(typeof j.date === "string" ? j.date : null), provider: "frankfurter" };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Bank of Israel first, Frankfurter second. Never throws — returns null when
 * both fail, so callers fall through to env / default.
 */
export async function fetchLiveUsdIls(
  fetchImpl: FetchLike = fetch,
  opts: { timeoutMs?: number } = {}
): Promise<LiveFxQuote | null> {
  const timeoutMs = opts.timeoutMs ?? 3500;
  const get = async (url: string, accept: string) => {
    const res = await fetchImpl(url, {
      headers: { Accept: accept },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  };
  try {
    const q = parseBoiCsv(await (await get(BOI_USD_ILS_URL, "text/csv")).text());
    if (q) return q;
  } catch (e) {
    console.warn("FX: Bank of Israel rate unavailable:", e instanceof Error ? e.message : e);
  }
  try {
    const q = parseFrankfurter(await (await get(FRANKFURTER_USD_ILS_URL, "application/json")).json());
    if (q) return q;
  } catch (e) {
    console.warn("FX: Frankfurter rate unavailable:", e instanceof Error ? e.message : e);
  }
  return null;
}
