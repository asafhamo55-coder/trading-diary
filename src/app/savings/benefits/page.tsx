import type { Metadata } from "next";
import BenefitsManager from "@/components/savings/BenefitsManager";

export const metadata: Metadata = { title: "Benefits & insurance · Hamo" };

export default function SavingsBenefitsPage() {
  return <BenefitsManager />;
}
