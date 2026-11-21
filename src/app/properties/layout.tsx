import AppNavShell from "@/components/layout/AppNavShell";
import CurrencyBoundary from "@/components/ui/currency-boundary";

/** Properties pages share the app shell; they bring their own page padding. */
export default function PropertiesLayout({ children }: LayoutProps<"/properties">) {
  return (
    <CurrencyBoundary>
      <AppNavShell flush>{children}</AppNavShell>
    </CurrencyBoundary>
  );
}
