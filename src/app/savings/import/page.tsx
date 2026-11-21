import type { Metadata } from "next";
import ImportPanel from "@/components/savings/ImportPanel";

export const metadata: Metadata = { title: "Import statements · Hamo" };

export default function SavingsImportPage() {
  return <ImportPanel />;
}
