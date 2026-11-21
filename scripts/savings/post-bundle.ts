// POST a validated household bundle to /api/savings/import.
//
//   SAVINGS_INGEST_TOKEN=... npx tsx scripts/savings/post-bundle.ts private-data/<name>.bundle.json [baseUrl]
//
// baseUrl defaults to $SAVINGS_BASE_URL, then https://trading-diary-lilac.vercel.app
// (use http://localhost:3000 against `npm run dev`).
// Env:
//   SAVINGS_INGEST_TOKEN        required; must match the value set in Vercel
//                               (`vercel env add SAVINGS_INGEST_TOKEN production`).
//   VERCEL_PROTECTION_BYPASS    optional; the "Protection Bypass for Automation"
//                               secret when Vercel Deployment Protection is on.
// The script refuses to send a file that fails the schema or the privacy scrub;
// run validate-bundle.ts first. Docs: docs/savings/pdf-import.md

import { readFileSync } from "node:fs";
import { householdBundleSchema } from "../../src/lib/savings-validators";
import { scrubBundle, toBundle } from "../../src/lib/bundle-tools";

async function main() {
  const [file, baseArg] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: npx tsx scripts/savings/post-bundle.ts <bundle.json> [baseUrl]");
    process.exit(1);
  }
  const token = process.env.SAVINGS_INGEST_TOKEN;
  if (!token) {
    console.error("SAVINGS_INGEST_TOKEN is not set. Export it (same value as in Vercel) and retry.");
    process.exit(1);
  }
  const base = (baseArg ?? process.env.SAVINGS_BASE_URL ?? "https://trading-diary-lilac.vercel.app").replace(/\/+$/, "");

  const bundle = toBundle(JSON.parse(readFileSync(file, "utf8")));
  const { findings } = scrubBundle(bundle);
  if (findings.length) {
    console.error(`Refusing to send: ${findings.length} personal identifier(s) found. Run validate-bundle.ts --fix first.`);
    process.exit(1);
  }
  const parsed = householdBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    console.error("Refusing to send: the bundle fails householdBundleSchema. Run validate-bundle.ts for details.");
    process.exit(1);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  if (process.env.VERCEL_PROTECTION_BYPASS) headers["x-vercel-protection-bypass"] = process.env.VERCEL_PROTECTION_BYPASS;

  const res = await fetch(`${base}/api/savings/import`, { method: "POST", headers, body: JSON.stringify(bundle) });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // not JSON (e.g. a Vercel SSO page)
  }
  if (!res.ok) {
    console.error(`Import failed: HTTP ${res.status}`);
    if (typeof data === "string" && /vercel|sso|<html/i.test(data))
      console.error("Looks like Vercel Deployment Protection intercepted the request; set VERCEL_PROTECTION_BYPASS.");
    else console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  const r = data as { accountsCreated: number; accountsUpdated: number; snapshotsWritten: number; benefitsCreated: number; benefitsUpdated: number; membersAdded: string[]; warnings: string[] };
  console.log(`Imported into ${base}:`);
  console.log(`  accounts: ${r.accountsCreated} created, ${r.accountsUpdated} updated; history points: ${r.snapshotsWritten}`);
  console.log(`  benefits: ${r.benefitsCreated} created, ${r.benefitsUpdated} updated; members added: ${r.membersAdded.join(", ") || "none"}`);
  for (const w of r.warnings) console.log(`  ! ${w}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
