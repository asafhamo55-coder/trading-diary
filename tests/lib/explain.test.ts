import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPLAIN, EXPLAIN_KEYS, isExplainKey, splitBidi } from "../../src/lib/explain";

const ROOT = join(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

const NAMESPACES = new Set(EXPLAIN_KEYS.map((k) => k.split(".")[0]));

/** Every glossary key referenced by a component: tip="…", tip: "…", or a "<namespace>.…" literal in a file that uses InfoTip. */
function usedKeys(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = [];
  for (const file of walk(join(ROOT, "src/components"))) {
    const src = readFileSync(file, "utf8");
    if (!/InfoTip|ExplainKey|\btip[=:]/.test(src)) continue;
    const seen = new Set<string>();
    for (const m of src.matchAll(/\btip(?:=|:\s*)"([^"]+)"/g)) seen.add(m[1]);
    for (const m of src.matchAll(/"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)"/g)) {
      if (NAMESPACES.has(m[1].split(".")[0])) seen.add(m[1]);
    }
    for (const key of seen) out.push({ key, file: file.slice(ROOT.length + 1) });
  }
  return out;
}

describe("explain glossary", () => {
  it("has every key used in components", () => {
    const used = usedKeys();
    expect(used.length).toBeGreaterThan(80);
    const missing = used.filter((u) => !isExplainKey(u.key));
    expect(missing).toEqual([]);
  });

  it("covers the properties and advisor metrics for later wiring", () => {
    for (const k of [
      "properties.portfolioValue",
      "properties.equity",
      "properties.netCashFlowYtd",
      "properties.cashOnCash",
      "properties.unitsLeased",
      "properties.appreciation",
      "properties.needsAttention",
      "properties.yield",
      "properties.netIfSold",
      "advisor.totalUpside",
      "advisor.tenYearBenefit",
      "advisor.effort",
      "advisor.urgency",
      "advisor.quickWins",
      "advisor.themes",
    ]) {
      expect(isExplainKey(k), k).toBe(true);
    }
  });

  it("every entry has Hebrew title / what / how, with balanced {ltr} markup", () => {
    for (const k of EXPLAIN_KEYS) {
      const e = EXPLAIN[k];
      for (const t of [e.he, e.en].filter(Boolean)) {
        expect(t!.title.trim(), k).not.toBe("");
        expect(t!.what.trim(), k).not.toBe("");
        expect(t!.how.trim(), k).not.toBe("");
        for (const s of [t!.title, t!.what, t!.how, t!.formula ?? "", t!.note ?? ""]) {
          // After removing {…} runs no stray braces may remain.
          expect(s.replace(/\{[^{}]+\}/g, ""), `${k}: ${s}`).not.toMatch(/[{}]/);
        }
      }
      expect(e.he.what, k).toMatch(/[֐-׿]/);
    }
  });

  it("splitBidi isolates {ltr} runs", () => {
    expect(splitBidi("קרן {401(k)} בארה״ב")).toEqual([
      { text: "קרן ", ltr: false },
      { text: "401(k)", ltr: true },
      { text: " בארה״ב", ltr: false },
    ]);
  });
});
