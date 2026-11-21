import { describe, expect, it } from "vitest";
import {
  ADVISOR_OUTPUT_SCHEMA,
  AdvisorError,
  TEN_YEAR_FACTOR,
  actionKey,
  capturedTenYearUsd,
  computeThemes,
  itemKey,
  nextActionItem,
  normalizeAdvisorOutput,
  normalizeTask,
  parseAdvisorOutput,
  previousOpportunityTitlesOf,
  previousRecommendationsOf,
  rankQuickWins,
  rankRecommendations,
  readAdvisorOutput,
  recProgress,
  sumProgress,
  tenYearValue,
  toLocalized,
  tx,
  type ActionStatusMap,
  type AdvisorRecommendation,
} from "../../src/lib/advisor-report";
import { SYNTHETIC_V1_OUTPUT, SYNTHETIC_V2_OUTPUT } from "../fixtures/advisor-report-v2";

// Loose access for mutating cloned fixtures in negative tests.
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = (): Loose => JSON.parse(JSON.stringify(SYNTHETIC_V2_OUTPUT));
const L = (en: string, he = "") => ({ en, he });

function rec(id: string, tenYearUsd: number, extra: Partial<AdvisorRecommendation> = {}): AdvisorRecommendation {
  return {
    id,
    themeId: "fees",
    title: L(id, id),
    owner: "household",
    confidence: "medium",
    benefit: { annualUsd: null, oneTimeUsd: null, tenYearUsd, riskReduction: null, basis: L("") },
    effort: "medium",
    urgency: { level: "medium", deadline: null, note: null },
    whatToChange: { current: L(""), target: L("") },
    why: L(""),
    howToChange: [],
    actionItems: [],
    dependsOn: [],
    risksIfIgnored: L(""),
    propertyId: null,
    subTheme: null,
    emails: [],
    ...extra,
  };
}

describe("tenYearValue", () => {
  it("compounds an annual amount for 10 years at 4% real and adds one-time", () => {
    expect(TEN_YEAR_FACTOR).toBeCloseTo(12.006, 3);
    expect(tenYearValue(1000, null)).toBe(12006);
    expect(tenYearValue(1000, 500)).toBe(12506);
    expect(tenYearValue(null, 2500)).toBe(2500);
    expect(tenYearValue(null, null)).toBe(0);
  });
});

describe("localized text", () => {
  it("accepts {en, he} or a bare string, and falls back to English", () => {
    expect(toLocalized("Hi")).toEqual({ en: "Hi", he: "" });
    expect(toLocalized({ en: " a ", he: " ב " })).toEqual({ en: "a", he: "ב" });
    expect(tx({ en: "a", he: "" }, "he")).toBe("a");
    expect(tx({ en: "a", he: "ב" }, "he")).toBe("ב");
    expect(tx(null, "en")).toBe("");
  });
});

describe("rankRecommendations", () => {
  it("sorts by tenYearUsd descending", () => {
    const out = rankRecommendations([rec("a", 10), rec("b", 300), rec("c", 50)]);
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by urgency, then the earlier deadline, then lower effort, then input order", () => {
    const out = rankRecommendations([
      rec("low", 100, { urgency: { level: "low", deadline: null, note: null } }),
      rec("late", 100, { urgency: { level: "high", deadline: "2027-06-01", note: null } }),
      rec("crit", 100, { urgency: { level: "critical", deadline: null, note: null } }),
      rec("soon", 100, { urgency: { level: "high", deadline: "2027-01-01", note: null } }),
      rec("hard", 100, { effort: "high" }),
      rec("easy", 100, { effort: "low" }),
      rec("med1", 100),
      rec("med2", 100),
    ]);
    expect(out.map((r) => r.id)).toEqual(["crit", "soon", "late", "easy", "med1", "med2", "hard", "low"]);
  });
});

describe("computeThemes", () => {
  it("sums each theme's benefit and count, adds undeclared themes, orders by total", () => {
    const themes = computeThemes(
      [
        { id: "cash", title: L("Cash & liquidity"), status: L("Fine"), tone: "good" },
        { id: "fees", title: L("Fees"), status: L("High"), tone: "act" },
      ],
      [
        rec("f1", 1000, { benefit: { annualUsd: 50, oneTimeUsd: null, tenYearUsd: 1000, riskReduction: null, basis: L("") } }),
        rec("f2", 500, { benefit: { annualUsd: 25, oneTimeUsd: null, tenYearUsd: 500, riskReduction: null, basis: L("") } }),
        rec("t1", 2000, { themeId: "tax" }),
      ]
    );
    expect(themes.map((t) => [t.id, t.totalTenYearUsd, t.recommendationCount])).toEqual([
      ["tax", 2000, 1],
      ["fees", 1500, 2],
      ["cash", 0, 0],
    ]);
    expect(themes[1].totalAnnualUsd).toBe(75);
    expect(themes[0].title).toEqual({ en: "Tax & reporting", he: "מס ודיווח" });
    expect(themes[2].tone).toBe("good");
  });

  it("always includes the opportunities theme when asked", () => {
    const themes = computeThemes([], [rec("f1", 10)], { ensureOpportunities: true });
    expect(themes.map((t) => t.id)).toEqual(["fees", "opportunities"]);
  });
});

describe("rankQuickWins", () => {
  it("orders declared wins by benefit ÷ effort and drops unknown/duplicate ids", () => {
    const recs = [rec("big-hard", 4000, { effort: "high" }), rec("mid-easy", 1500, { effort: "low" }), rec("small", 100, { effort: "low" })];
    const wins = rankQuickWins(
      [
        { recId: "big-hard", directive: L("a") },
        { recId: "nope", directive: L("x") },
        { recId: "mid-easy", directive: L("b") },
        { recId: "mid-easy", directive: L("dup") },
      ],
      recs
    );
    expect(wins.map((w) => w.recId)).toEqual(["mid-easy", "big-hard"]); // 1500/1 > 4000/4
  });

  it("derives wins from confident, low/medium-effort recommendations when none are declared", () => {
    const wins = rankQuickWins([], [rec("a", 900, { effort: "high" }), rec("b", 800, { confidence: "low" }), rec("c", 300, { effort: "low" }), rec("d", 500)]);
    expect(wins.map((w) => w.recId)).toEqual(["c", "d"]);
    expect(wins[0].directive).toEqual(L("c", "c"));
  });
});

describe("normalizeAdvisorOutput (v2)", () => {
  const out = normalizeAdvisorOutput(clone());

  it("ranks recommendations by 10-year benefit regardless of model order", () => {
    const values = out.recommendations.map((r) => r.benefit.tenYearUsd);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(out.recommendations[0].id).toBe("retirement-adult-a-401k-max");
    expect(out.recommendations.at(-1)?.id).toBe("allocation-household-qqq-trim");
    expect(out.legacy).toBeUndefined();
    expect(out.version).toBe(2);
    expect(out.languages).toEqual(["en", "he"]);
  });

  it("computes theme totals and the overall upside", () => {
    const fees = out.themes.find((t) => t.id === "fees")!;
    expect(fees.totalTenYearUsd).toBe(36018 + 7204);
    expect(fees.totalAnnualUsd).toBe(3600);
    expect(fees.recommendationCount).toBe(2);
    expect(out.themes[0].id).toBe("retirement");
    expect(out.themes.at(-1)?.id).toBe("cash"); // status-only theme last
    expect(out.themes.find((t) => t.id === "opportunities")?.recommendationCount).toBe(2);
    expect(out.totals).toEqual({
      tenYearUsd: 300 + 36018 + 54000 + 10000 + 7204 + 99650 + 7204 + 3002 + 43222,
      annualUsd: 16350,
      oneTimeUsd: 10300,
      recommendationCount: 9,
      actionItemCount: 15,
    });
  });

  it("ranks quick wins by benefit ÷ effort", () => {
    expect(out.quickWins.map((q) => q.recId)).toEqual(["retirement-adult-a-401k-max", "insurance-adult-b-disability", "fees-adult-a-managers-insurance"]);
    expect(out.quickWins[0].directive.he).toMatch(/401\(k\)/);
  });

  it("keeps the summary, questions and dependsOn links that resolve", () => {
    expect(out.executiveSummary).toHaveLength(4);
    expect(out.questionsForUser[0].question.he).toContain("LTD");
    expect(out.recommendations.find((r) => r.id === "fees-adult-b-hishtalmut")?.dependsOn).toEqual(["fees-adult-a-managers-insurance"]);
  });

  it("is idempotent on an already-normalized (stored) report", () => {
    expect(normalizeAdvisorOutput(JSON.parse(JSON.stringify(out)))).toEqual(out);
    expect(readAdvisorOutput(JSON.parse(JSON.stringify(out)))).toEqual(out);
  });

  it("derives tenYearUsd from annual/one-time when missing, and coerces bad enums", () => {
    const raw = clone();
    const r = raw.recommendations[1];
    r.benefit.tenYearUsd = undefined;
    r.effort = "huge";
    r.id = "Fees: Adult A!";
    raw.quickWins[0].recId = "fees-adult-a";
    const n = normalizeAdvisorOutput(raw).recommendations.find((x) => x.id === "fees-adult-a")!;
    expect(n.benefit.tenYearUsd).toBe(tenYearValue(3000, null));
    expect(n.effort).toBe("medium");
    // The hishtalmut rec depended on the old id, which no longer exists.
    expect(normalizeAdvisorOutput(raw).recommendations.find((x) => x.id === "fees-adult-b-hishtalmut")?.dependsOn).toEqual([]);
  });

  it("maps unknown themes to other and de-duplicates repeated ids", () => {
    const raw = clone();
    raw.recommendations[0].themeId = "nonsense";
    raw.recommendations[4].id = raw.recommendations[2].id;
    const n = normalizeAdvisorOutput(raw);
    const ids = n.recommendations.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(n.recommendations.find((r) => r.title.en.startsWith("Trim QQQ"))?.themeId).toBe("other");
  });

  it("rejects v2 output that is missing the ranking number or steps, listing the fields", () => {
    const raw = clone();
    raw.recommendations[0].benefit = { basis: L("x") };
    delete raw.recommendations[0].actionItems;
    expect(() => normalizeAdvisorOutput(raw)).toThrow(AdvisorError);
    expect(() => normalizeAdvisorOutput(raw)).toThrow(/tenYearUsd[\s\S]*actionItems/);
  });

  it("rejects quick wins that reference a missing recommendation", () => {
    const raw = clone();
    raw.quickWins[1].recId = "ghost";
    expect(() => normalizeAdvisorOutput(raw)).toThrow(/quickWins\[1\]\.recId "ghost"/);
  });

  it("requires Hebrew on the headline, summary, titles and directives (strict only)", () => {
    const raw = clone();
    raw.headline = "English only";
    raw.recommendations[3].title.he = "";
    expect(() => normalizeAdvisorOutput(raw)).toThrow(/^(?=[\s\S]*headline\.he)(?=[\s\S]*title\.he)/);
    const lenient = normalizeAdvisorOutput(raw, { strict: false });
    expect(lenient.languages).toEqual(["en"]);
    expect(tx(lenient.headline, "he")).toBe("English only");
  });

  it("requires at least two opportunities ideas (strict only)", () => {
    const raw = clone();
    raw.recommendations = raw.recommendations.filter((r: Loose) => r.id !== "opportunities-adult-a-hsa-invest");
    expect(() => normalizeAdvisorOutput(raw)).toThrow(/at least 2 "opportunities"/);
    expect(normalizeAdvisorOutput(raw, { strict: false }).recommendations).toHaveLength(8);
  });

  it("rejects non-objects and invalid JSON", () => {
    expect(() => normalizeAdvisorOutput(null)).toThrow(AdvisorError);
    expect(() => normalizeAdvisorOutput({ headline: "x" })).toThrow(/missing required/);
    expect(() => parseAdvisorOutput("{nope")).toThrow(/invalid JSON/);
    expect(readAdvisorOutput("garbage")).toBeNull();
  });
});

describe("property recommendations and emails", () => {
  const out = normalizeAdvisorOutput(clone());
  const prop = out.recommendations.find((r) => r.propertyId === "prop-1")!;

  it("keeps propertyId/subTheme and emails with placeholders intact", () => {
    expect(prop.subTheme).toBe("revenue");
    expect(prop.themeId).toBe("real-estate");
    expect(prop.emails[0]).toMatchObject({ contactRole: "property_manager", language: "en", actionItemId: "a1" });
    const fees = out.recommendations.find((r) => r.id === "fees-adult-a-managers-insurance")!;
    expect(fees.emails[0].body).toContain("{{account:acc-il-1}}");
    expect(out.recommendations.find((r) => r.id === "tax-household-fbar-8938")?.emails).toEqual([]);
    expect(out.recommendations.find((r) => r.id === "tax-household-fbar-8938")?.propertyId).toBeNull();
  });

  it("requires a recommendation for every rental when asked", () => {
    expect(() => normalizeAdvisorOutput(clone(), { requiredPropertyIds: ["prop-1"] })).not.toThrow();
    expect(() => normalizeAdvisorOutput(clone(), { requiredPropertyIds: ["prop-1", "prop-2"] })).toThrow(/rental property prop-2/);
  });

  it("rejects an email that contains a raw account number", () => {
    const raw = clone();
    raw.recommendations[1].emails[0].body = "Policy 123456789, please cut the fee.";
    expect(() => normalizeAdvisorOutput(raw)).toThrow(/account number/);
  });
});

describe("normalizeAdvisorOutput (legacy v1)", () => {
  const out = parseAdvisorOutput(JSON.stringify(SYNTHETIC_V1_OUTPUT));

  it("maps a v1 report to v2 with best-effort defaults, English only, legacy: true", () => {
    expect(out.legacy).toBe(true);
    expect(out.version).toBe(2);
    expect(out.languages).toEqual(["en"]);
    expect(out.headline).toEqual({ en: "Solid base; fees are the main drag.", he: "" });
    expect(out.executiveSummary).toEqual([L("Net worth is $1.2M, mostly retirement accounts.")]);
    const fees = out.recommendations[0];
    expect(fees.title.en).toBe("Negotiate pension fees");
    expect(fees.themeId).toBe("fees");
    expect(fees.benefit).toMatchObject({ annualUsd: 3000, tenYearUsd: tenYearValue(3000, null) });
    expect(fees.why.en).toBe("Accumulation fee 1.05% vs 0.3% benchmark.");
    expect(fees.howToChange).toEqual([L("Call the provider and ask for 0.3%.")]);
    expect(fees.actionItems).toEqual([
      { id: "a1", task: L("Call the provider and ask for 0.3%."), who: "adult_a", contact: null, dueBy: null, effortMinutes: null, done: false },
    ]);
  });

  it("ranks unquantified items by priority, derives themes and quick wins, no opportunities theme", () => {
    expect(out.recommendations.map((r) => r.title.en)).toEqual(["Negotiate pension fees", "Check disability cover", "Enter children's birth dates"]);
    expect(out.themes.map((t) => t.id)).toEqual(["fees", "insurance", "data"]);
    expect(out.totals.tenYearUsd).toBe(tenYearValue(3000, null));
    expect(out.quickWins.map((q) => q.recId)).toEqual(["negotiate-pension-fees"]);
  });

  it("stays legacy after a store/read round trip", () => {
    const again = readAdvisorOutput(JSON.parse(JSON.stringify(out)))!;
    expect(again.legacy).toBe(true);
    expect(again.themes.map((t) => t.id)).toEqual(["fees", "insurance", "data"]);
  });
});

describe("action keys and progress", () => {
  it("keys on recommendation id + normalized English task, ignoring case/punctuation/whitespace", () => {
    const k = actionKey("fees-a", "Call the provider, ask for 0.3%.");
    expect(k).toMatch(/^ak_[0-9a-z]+$/);
    expect(actionKey("fees-a", "  call the PROVIDER ask for 0 3 ")).toBe(k);
    expect(actionKey("fees-b", "Call the provider, ask for 0.3%.")).not.toBe(k);
    expect(actionKey("fees-a", "Call a different provider")).not.toBe(k);
    expect(normalizeTask("ניוד  request!")).toBe("ניוד request");
  });

  it("rolls progress up from items to recommendations to the whole report", () => {
    const out = normalizeAdvisorOutput(clone());
    const fees = out.recommendations.find((r) => r.id === "fees-adult-a-managers-insurance")!;
    const k401 = out.recommendations.find((r) => r.id === "retirement-adult-a-401k-max")!;
    const status: ActionStatusMap = {
      [itemKey(fees, fees.actionItems[0])]: { done: true, doneAt: "2026-11-01T00:00:00.000Z" },
      [itemKey(fees, fees.actionItems[1])]: { done: false, doneAt: null },
      [actionKey(k401.id, k401.actionItems[0].task.en)]: { done: true, doneAt: "2026-11-02T00:00:00.000Z" },
    };
    expect(recProgress(fees, status)).toEqual({ done: 1, total: 4 });
    expect(nextActionItem(fees, status)?.id).toBe("a2");
    expect(nextActionItem(k401, status)).toBeNull();
    expect(sumProgress(out.recommendations, status)).toEqual({ done: 2, total: 15 });
    expect(capturedTenYearUsd(out.recommendations, status)).toBe(99650);
    const prev = previousRecommendationsOf(out, status);
    expect(prev[0]).toEqual({
      id: "retirement-adult-a-401k-max",
      title: k401.title.en,
      themeId: "retirement",
      actionItems: [{ task: k401.actionItems[0].task.en, done: true }],
    });
    expect(previousOpportunityTitlesOf(out)).toEqual([
      "Move $40K of excess cash into a 5-year TIPS ladder",
      "Invest the HSA balance above $2K in a total-market index fund",
    ]);
  });
});

describe("ADVISOR_OUTPUT_SCHEMA", () => {
  it("requires every recommendation field the UI drills into, bilingual", () => {
    const item = ADVISOR_OUTPUT_SCHEMA.properties.recommendations.items;
    for (const f of ["benefit", "whatToChange", "why", "howToChange", "actionItems", "dependsOn", "risksIfIgnored", "urgency", "effort"]) {
      expect(item.required).toContain(f);
    }
    expect(item.properties.benefit.required).toContain("tenYearUsd");
    expect(item.properties.title.required).toEqual(["en", "he"]);
    expect(item.properties.themeId.enum).toContain("opportunities");
    expect(ADVISOR_OUTPUT_SCHEMA.required).toEqual(
      expect.arrayContaining(["headline", "executiveSummary", "quickWins", "themes", "recommendations", "questionsForUser", "disclaimers"])
    );
  });
});
