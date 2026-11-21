import type { Metadata } from "next";
import ImportPanel from "@/components/savings/ImportPanel";
import PdfHelp from "@/components/savings/PdfHelp";

export const metadata: Metadata = { title: "Import statements · Hamo" };

export default function SavingsImportPage() {
  return (
    <div className="space-y-6">
      <ImportPanel />
      <PdfHelp />
    </div>
  );
}
