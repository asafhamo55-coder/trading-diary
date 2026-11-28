import type { Metadata } from "next";
import { getProperties } from "@/lib/property-data";
import { listTaxReturns } from "@/lib/tax-return-data";
import { reconcileRentals } from "@/lib/tax-return-advisor";
import { todayInEastern } from "@/lib/utils";
import TaxReturnsClient from "@/components/savings/TaxReturnsClient";

export const metadata: Metadata = { title: "Tax returns · Hamo" };
export const dynamic = "force-dynamic";

export default async function SavingsTaxPage() {
  const [returns, properties] = await Promise.all([listTaxReturns().catch(() => []), getProperties()]);
  const reconciliation = reconcileRentals(returns, properties, todayInEastern());
  const propertyTitles = Object.fromEntries(properties.map((p) => [p.id, p.unit ? `${p.street ?? p.address} #${p.unit}` : (p.street ?? p.address)]));
  return <TaxReturnsClient returns={returns} reconciliation={reconciliation} propertyTitles={propertyTitles} />;
}
