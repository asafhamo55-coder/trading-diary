// Validate a household-bundle JSON before loading it.
//
//   npx tsx scripts/savings/validate-bundle.ts private-data/<name>.bundle.json [more.json ...] [--fix] [--merge out.json]
//
// - Accepts a household bundle ({ israel?, accounts?, benefits?, profile? }) or
//   a bare Israeli extract ({ asOf, people }).
// - Runs the privacy scrubber (national IDs / SSNs). Findings fail the check;
//   --fix writes the scrubbed JSON back to the file instead.
// - Several files: validates each, then merges them (same upsert keys as the
//   import) and validates the merged bundle; --merge out.json writes it.
// - Validates with householdBundleSchema (exactly what POST /api/savings/import
//   runs) and prints a summary plus soft warnings.
// Exit code 0 = OK to load, 1 = fix something first.
// Docs: docs/savings/pdf-import.md

import { readFileSync, writeFileSync } from "node:fs";
import { householdBundleSchema } from "../../src/lib/savings-validators";
import { mergeBundles, scrubBundle, summarizeBundle, toBundle } from "../../src/lib/bundle-tools";

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const mergeIdx = args.indexOf("--merge");
const mergeOut = mergeIdx >= 0 ? args[mergeIdx + 1] : null;
const files = args.filter((a, i) => !a.startsWith("--") && !(mergeIdx >= 0 && i === mergeIdx + 1));

if (files.length === 0) {
  console.error("Usage: npx tsx scripts/savings/validate-bundle.ts <bundle.json> [more.json ...] [--fix] [--merge out.json]");
  process.exit(1);
}

let failed = false;

function check(label: string, doc: unknown, header = true): unknown {
  if (header) console.log(`\n=== ${label} ===`);
  const bundle = toBundle(doc);
  const parsed = householdBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    failed = true;
    console.log("SCHEMA: FAIL");
    for (const issue of parsed.error.issues.slice(0, 25)) console.log(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  } else {
    console.log("SCHEMA: OK (householdBundleSchema)");
  }
  const s = summarizeBundle(bundle);
  console.log(
    `CONTENTS: ${s.people} Israeli people / ${s.israeliProducts} products, ${s.accounts} accounts, ${s.benefits} benefits, ${s.members} profile members`
  );
  for (const l of s.lines) console.log(`  ${l}`);
  const totals = Object.entries(s.totalsByOwner)
    .map(([o, byCur]) => `${o}: ${Object.entries(byCur).map(([c, v]) => `${Math.round(v).toLocaleString("en-US")} ${c}`).join(" + ")}`)
    .join(" | ");
  if (totals) console.log(`TOTALS: ${totals}`);
  if (s.warnings.length) {
    console.log(`WARNINGS (${s.warnings.length}):`);
    for (const w of s.warnings) console.log(`  ! ${w}`);
  }
  return bundle;
}

const docs: unknown[] = [];
for (const file of files) {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    failed = true;
    console.log(`\n=== ${file} ===\nNot readable JSON: ${e instanceof Error ? e.message : e}`);
    continue;
  }
  const { bundle: scrubbed, findings } = scrubBundle(doc);
  if (findings.length) {
    console.log(`\n=== ${file} ===\nPRIVACY: ${findings.length} personal identifier(s) found:`);
    for (const f of findings) console.log(`  - ${f.path}: ${f.detail}`);
    if (fix) {
      writeFileSync(file, JSON.stringify(scrubbed, null, 2) + "\n");
      console.log("  → scrubbed copy written back (--fix).");
    } else {
      failed = true;
      console.log("  → re-run with --fix to remove them, or edit the file.");
    }
  } else {
    console.log(`\n=== ${file} ===\nPRIVACY: OK (no national ID / SSN values)`);
  }
  docs.push(fix ? scrubbed : doc);
  check(file, fix ? scrubbed : doc, false);
}

if (docs.length > 1 || mergeOut) {
  const { bundle, warnings } = mergeBundles(docs);
  for (const w of warnings) console.log(`MERGE: ${w}`);
  check(`merged (${docs.length} files)`, bundle);
  if (mergeOut) {
    writeFileSync(mergeOut, JSON.stringify(bundle, null, 2) + "\n");
    console.log(`\nMerged bundle written to ${mergeOut}`);
  }
}

console.log(failed ? "\nRESULT: NOT READY — fix the items above." : "\nRESULT: READY to load.");
process.exit(failed ? 1 : 0);
