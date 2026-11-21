import AppNavShell from "@/components/layout/AppNavShell";
import CurrencyBoundary from "@/components/ui/currency-boundary";

/** Home pages share the app shell; they bring their own page padding. */
export default function HomeLayout({ children }: LayoutProps<"/home">) {
  return (
    <CurrencyBoundary>
      <AppNavShell flush>{children}</AppNavShell>
    </CurrencyBoundary>
  );
}
