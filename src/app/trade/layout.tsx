import AppNavShell from "@/components/layout/AppNavShell";
import CurrencyBoundary from "@/components/ui/currency-boundary";

/** Trade pages share the app shell; they bring their own page padding. */
export default function TradeLayout({ children }: LayoutProps<"/trade">) {
  return (
    <CurrencyBoundary>
      <AppNavShell flush>{children}</AppNavShell>
    </CurrencyBoundary>
  );
}
