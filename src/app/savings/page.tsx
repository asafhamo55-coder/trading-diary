import { Suspense } from "react";
import type { Metadata } from "next";
import SavingsOverview from "@/components/savings/SavingsOverview";

export const metadata: Metadata = { title: "Retirement & Savings · Hamo" };

export default function SavingsPage() {
  // Suspense: the overview reads ?account= / ?new= deep links via useSearchParams.
  return (
    <Suspense>
      <SavingsOverview />
    </Suspense>
  );
}
