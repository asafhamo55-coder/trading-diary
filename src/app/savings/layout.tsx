import SavingsShell from "@/components/savings/SavingsShell";
import CurrencyBoundary from "@/components/ui/currency-boundary";

export default function SavingsLayout({ children }: LayoutProps<"/savings">) {
  return (
    <CurrencyBoundary>
      <SavingsShell>{children}</SavingsShell>
    </CurrencyBoundary>
  );
}
