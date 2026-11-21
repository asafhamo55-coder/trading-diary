// Server-only: the live USD→ILS rate, cached ~6h in Next's data cache.
//
// This app doesn't enable `cacheComponents`, so the Next 16 mechanism here is
// `unstable_cache` (the "previous model"); it keeps working inside routes
// marked `dynamic = "force-dynamic"`, unlike plain fetch revalidation.
import { unstable_cache } from "next/cache";
import { fetchLiveUsdIls, type LiveFxQuote } from "./fx";

export const LIVE_FX_REVALIDATE_SECONDS = 6 * 60 * 60;

// Throw on failure so a miss is never stored for 6 hours.
const cachedLive = unstable_cache(
  async (): Promise<LiveFxQuote> => {
    const q = await fetchLiveUsdIls();
    if (!q) throw new Error("No live USD/ILS source responded");
    return q;
  },
  ["fx-usd-ils-live-v1"],
  { revalidate: LIVE_FX_REVALIDATE_SECONDS, tags: ["fx"] }
);

// Process-local fallbacks: last good quote (used when the Next cache isn't
// available, e.g. scripts) and a short back-off after a failure so a dead
// upstream doesn't add timeouts to every request.
let memo: { q: LiveFxQuote; at: number } | null = null;
let failedAt = 0;
const FAIL_BACKOFF_MS = 5 * 60 * 1000;
const MEMO_MS = 30 * 60 * 1000;

/** Current live rate, or null. Never throws. */
export async function getLiveUsdIls(): Promise<LiveFxQuote | null> {
  const now = Date.now();
  if (memo && now - memo.at < MEMO_MS) return memo.q;
  if (now - failedAt < FAIL_BACKOFF_MS) return memo?.q ?? null;
  try {
    const q = await cachedLive();
    memo = { q, at: now };
    return q;
  } catch (e) {
    // Outside a Next request context unstable_cache itself can throw — try a direct fetch once.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/No live USD\/ILS/.test(msg)) {
      const q = await fetchLiveUsdIls();
      if (q) {
        memo = { q, at: now };
        return q;
      }
    }
    failedAt = now;
    return memo?.q ?? null;
  }
}
