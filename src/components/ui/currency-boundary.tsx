// Server half of the display-currency provider: reads the cookie (so the
// first render is already in the chosen currency) and resolves the rate
// (profile override → live → env → default). Never throws.
import { cookies } from "next/headers";
import { DISPLAY_CURRENCY_COOKIE, parseDisplayCurrency } from "@/lib/currency";
import { getFxRateSafe } from "@/lib/savings-data";
import { DEFAULT_USD_ILS_RATE, type FxRate } from "@/lib/savings";
import { CurrencyProvider } from "./currency";

export default async function CurrencyBoundary({ children }: { children: React.ReactNode }) {
  const [jar, fx] = await Promise.all([
    cookies(),
    getFxRateSafe().catch((e): FxRate => {
      console.error("FX: rate resolution failed", e);
      return { usdIls: DEFAULT_USD_ILS_RATE, source: "default", asOf: null, provider: null };
    }),
  ]);
  const initial = parseDisplayCurrency(jar.get(DISPLAY_CURRENCY_COOKIE)?.value);
  return (
    <CurrencyProvider initialCurrency={initial} fx={fx}>
      {children}
    </CurrencyProvider>
  );
}
