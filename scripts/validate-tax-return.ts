// Validate an extracted tax-return JSON against the app's schema and PII guard
// before posting it. Prints OK or the problems — never the field values.
//   npx tsx scripts/validate-tax-return.ts private-data/tax/2025-US-federal.json
import { readFileSync } from "node:fs";
import { TaxReturnError, parseTaxReturn } from "../src/lib/tax-return-schema";

const path = process.argv[2];
if (!path) {
  console.error("usage: validate-tax-return.ts <file.json>");
  process.exit(2);
}
try {
  const r = parseTaxReturn(JSON.parse(readFileSync(path, "utf8")));
  console.log(`OK ${r.taxYear} ${r.jurisdiction}${r.partial ? " (partial)" : ""}: ${r.data.rentals.length} rentals, ${r.data.carryovers.length} carryovers, ${r.data.notes.length} notes`);
} catch (e) {
  console.error(e instanceof TaxReturnError ? `INVALID: ${e.message}` : `ERROR: ${(e as Error).message}`);
  process.exit(1);
}
