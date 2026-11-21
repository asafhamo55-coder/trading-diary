import SavingsShell from "@/components/savings/SavingsShell";

export default function SavingsLayout({ children }: LayoutProps<"/savings">) {
  return <SavingsShell>{children}</SavingsShell>;
}
