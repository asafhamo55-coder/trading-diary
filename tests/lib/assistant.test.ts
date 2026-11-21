import { describe, expect, it } from "vitest";

import {
  collectContextKeys,
  contextKeysFromPath,
  detectLanguage,
  normalizeContextKeys,
  parseAnswer,
  parseContextKey,
  parseCreateQuestion,
  startersFor,
  unreadCount,
  type AssistantQuestionDTO,
} from "../../src/lib/assistant";
import {
  MAX_PROPERTY_TRANSACTIONS,
  buildPendingBundle,
  compactProperty,
  compactSavingsAccount,
  planBundle,
  redactSensitive,
} from "../../src/lib/assistant-bundle";
import { parseInline, parseMarkdown, safeHref } from "../../src/lib/assistant-markdown";

function q(over: Partial<AssistantQuestionDTO> & { id: string }): AssistantQuestionDTO {
  return {
    question: "What is this?",
    language: "en",
    pagePath: "/",
    pageTitle: null,
    contextKeys: [],
    status: "pending",
    answer: null,
    answeredAt: null,
    answeredBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    readAt: null,
    ...over,
  };
}

describe("detectLanguage", () => {
  it("detects Hebrew, including mixed questions that start in Hebrew", () => {
    expect(detectLanguage("למה ההון העצמי ירד?")).toBe("he");
    expect(detectLanguage("מה זה cash-on-cash?")).toBe("he");
  });
  it("detects English, even with a Hebrew term inside", () => {
    expect(detectLanguage("What is cash-on-cash?")).toBe("en");
    expect(detectLanguage("What is קרן השתלמות?")).toBe("en");
  });
  it("treats a mostly-Hebrew question that starts with a ticker as Hebrew", () => {
    expect(detectLanguage("SPY ירד היום בבוקר, למה ההנחיה ממליצה לקנות?")).toBe("he");
  });
  it("defaults to English when there are no letters", () => {
    expect(detectLanguage("123?")).toBe("en");
    expect(detectLanguage("")).toBe("en");
  });
});

describe("context keys", () => {
  it("parses glossary keys and entity refs", () => {
    expect(parseContextKey("properties.equity")).toEqual({ kind: "explain", key: "properties.equity" });
    expect(parseContextKey("property:clx123abc")).toEqual({ kind: "property", id: "clx123abc" });
    expect(parseContextKey("savings:abc_1")).toEqual({ kind: "savings", id: "abc_1" });
    expect(parseContextKey("guidelines")).toEqual({ kind: "guidelines" });
  });
  it("rejects junk", () => {
    expect(parseContextKey("")).toBeNull();
    expect(parseContextKey("nodot")).toBeNull();
    expect(parseContextKey("property:")).toBeNull();
    expect(parseContextKey("property:../etc")).toBeNull();
    expect(parseContextKey("<script>.x")).toBeNull();
  });
  it("normalizes, dedupes and caps", () => {
    expect(normalizeContextKeys(["a.b", " a.b ", 3, null, "bad", "guidelines"])).toEqual(["a.b", "guidelines"]);
    expect(normalizeContextKeys("a.b")).toEqual([]);
    const many = Array.from({ length: 50 }, (_, i) => `k.k${i}`);
    expect(normalizeContextKeys(many)).toHaveLength(30);
  });
  it("derives entity refs from the URL", () => {
    expect(contextKeysFromPath("/properties/clx9abc")).toEqual(["property:clx9abc"]);
    expect(contextKeysFromPath("/properties/clx9abc/")).toEqual(["property:clx9abc"]);
    expect(contextKeysFromPath("/properties")).toEqual([]);
    expect(contextKeysFromPath("/properties/mock-preview")).toEqual([]);
    expect(contextKeysFromPath("/trade/guidelines?x=1")).toEqual(["guidelines"]);
    expect(contextKeysFromPath("/savings")).toEqual([]);
  });
  it("collects keys from DOM attributes, defensively", () => {
    const attrs: Record<string, (string | null)[]> = {
      "[data-assistant-context]": ["savings:acc1 property:p2", null],
      "[data-explain-key]": ["properties.equity", "properties.yield", "properties.equity", "", "not valid!"],
    };
    const root = {
      querySelectorAll: (sel: string) => (attrs[sel] ?? []).map((v) => ({ getAttribute: () => v })),
    };
    expect(collectContextKeys("/properties/p1", root)).toEqual([
      "property:p1",
      "savings:acc1",
      "property:p2",
      "properties.equity",
      "properties.yield",
    ]);
    const broken = {
      querySelectorAll: () => {
        throw new Error("boom");
      },
    };
    expect(collectContextKeys("/trade/guidelines", broken)).toEqual(["guidelines"]);
    expect(collectContextKeys("/", null)).toEqual([]);
  });
});

describe("input parsing", () => {
  it("parses a create body and detects the language server-side", () => {
    const r = parseCreateQuestion({ question: "  מה זה cash-on-cash? ", pagePath: "/properties", pageTitle: "Properties", contextKeys: ["properties.yield", "x"] });
    expect(r).toEqual({ question: "מה זה cash-on-cash?", language: "he", pagePath: "/properties", pageTitle: "Properties", contextKeys: ["properties.yield"] });
  });
  it("rejects empty or oversized questions and fixes bad paths", () => {
    expect(parseCreateQuestion({ question: "  " })).toEqual({ error: "question is required" });
    expect("error" in parseCreateQuestion({ question: "x".repeat(2001) })).toBe(true);
    expect(parseCreateQuestion({ question: "hi", pagePath: "https://evil" })).toMatchObject({ pagePath: "/" });
  });
  it("parses answers and failures", () => {
    expect(parseAnswer({ id: "abc", answer: "**Yes**" })).toEqual({ id: "abc", answer: "**Yes**", status: "answered", answeredBy: "claude-code" });
    expect(parseAnswer({ id: "abc", answer: "No data", status: "failed" })).toMatchObject({ status: "failed" });
    expect(parseAnswer({ id: "abc", answer: "x", status: "done" })).toHaveProperty("error");
    expect(parseAnswer({ id: "abc", answer: "" })).toHaveProperty("error");
    expect(parseAnswer({ answer: "x" })).toHaveProperty("error");
  });
});

describe("starters and unread", () => {
  it("gives page-specific starters first", () => {
    expect(startersFor("/properties")[0].he).toBe("מה זה cash-on-cash?");
    expect(startersFor("/properties").map((s) => s.he)).toContain("למה ההון העצמי ירד?");
    expect(startersFor("/trade/guidelines")[0].en).toMatch(/SPY/);
    expect(startersFor("/unknown")).toHaveLength(2);
    for (const p of ["/", "/savings", "/home", "/trade/journal"]) expect(startersFor(p).length).toBeLessThanOrEqual(4);
  });
  it("counts answered/failed questions not yet read", () => {
    expect(unreadCount([q({ id: "1" }), q({ id: "2", status: "answered" }), q({ id: "3", status: "failed" }), q({ id: "4", status: "answered", readAt: "x" })])).toBe(2);
  });
});

describe("pending bundle", () => {
  it("plans which entities to load", () => {
    const plan = planBundle([
      q({ id: "1", contextKeys: ["property:p1", "properties.equity"] }),
      q({ id: "2", contextKeys: ["property:p1", "savings:s1", "guidelines", "junk"] }),
    ]);
    expect(plan).toEqual({ explainKeys: ["properties.equity"], propertyIds: ["p1"], savingsIds: ["s1"], guidelines: true });
  });

  it("returns no data when nothing is pending", () => {
    const b = buildPendingBundle([q({ id: "1", status: "answered" })], null, new Date("2026-01-02T00:00:00Z"));
    expect(b).toEqual({ generatedAt: "2026-01-02T00:00:00.000Z", count: 0, questions: [], data: null });
  });

  it("attaches refs, flags missing context and strips private fields", () => {
    const b = buildPendingBundle(
      [
        q({ id: "1", question: "מה זה?", language: "he", contextKeys: ["property:p1", "properties.equity", "unknown.key", "savings:gone"] }),
        q({ id: "2", contextKeys: ["guidelines"] }),
        q({ id: "3", status: "answered" }),
      ],
      {
        advisorSnapshot: { household: { members: [{ key: "a", nationalId: "123456789" }] }, note: "id 123456789 here" },
        glossary: { "properties.equity": { he: { title: "הון עצמי" } } },
        properties: {
          p1: {
            id: "p1",
            nickname: "Unit A",
            currentValue: 300000,
            tenants: [{ id: "t1", name: "Tenant", email: "t@example.com", phone: "555", monthlyRent: 2000, leaseStart: "2026-01-01" }],
            transactions: [],
          },
        },
        savingsAccounts: {},
        guidelines: null,
      }
    );
    expect(b.count).toBe(2);
    expect(b.questions.map((x) => x.id)).toEqual(["1", "2"]);
    expect(b.questions[0].refs).toEqual({ explain: ["properties.equity"], properties: ["p1"], savingsAccounts: [], guidelines: false, missing: ["unknown.key", "savings:gone"] });
    expect(b.questions[1].refs.missing).toEqual(["guidelines"]);
    const tenant = (b.data!.properties.p1.tenants as Record<string, unknown>[])[0];
    expect(tenant).toEqual({ id: "t1", leaseStart: "2026-01-01", leaseEnd: null, monthlyRent: 2000, securityDeposit: null });
    expect(JSON.stringify(b.data!.advisorSnapshot)).not.toContain("123456789");
  });

  it("caps property transactions, newest first", () => {
    const tx = Array.from({ length: MAX_PROPERTY_TRANSACTIONS + 5 }, (_, i) => ({ id: `x${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, amount: i }));
    const p = compactProperty({ id: "p", transactions: tx, tenants: [] });
    expect((p.transactions as unknown[]).length).toBe(MAX_PROPERTY_TRANSACTIONS);
    expect(p.transactionsOmitted).toBe(5);
    expect((p.transactions as { date: string }[])[0].date).toBe("2026-01-28");
  });

  it("drops policy numbers and login URLs from savings accounts", () => {
    const a = compactSavingsAccount({ id: "s", provider: "P", policyLast4: "1234", policyNumber: "99887766", loginUrl: "https://x", balance: 5 });
    expect(a).toEqual({ id: "s", provider: "P", policyLast4: "1234", balance: 5 });
  });

  it("redacts SSNs and 9-digit ID runs but keeps other numbers and ids", () => {
    expect(redactSensitive({ s: "SSN 123-45-6789, ID 012345678, amount 1,234,567,890, ref ab123456789cd" })).toEqual({
      s: "SSN [redacted], ID [redacted], amount 1,234,567,890, ref ab123456789cd",
    });
    expect(redactSensitive({ balance: 123456789, Email: "x" })).toEqual({ balance: 123456789 });
  });
});

describe("markdown", () => {
  it("parses blocks", () => {
    const md = "## Title\n\nPara **bold** and *it*.\n\n- one\n- two\n\n1. a\n2. b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```\ncode <b>\n```\n\n---";
    expect(parseMarkdown(md).map((b) => b.type)).toEqual(["h", "p", "ul", "ol", "table", "code", "hr"]);
  });
  it("keeps raw HTML as text", () => {
    const blocks = parseMarkdown("<img src=x onerror=alert(1)>");
    expect(blocks).toEqual([{ type: "p", c: [{ t: "text", v: "<img src=x onerror=alert(1)>" }] }]);
  });
  it("only allows safe link targets", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("/properties")).toBe("/properties");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    expect(parseInline("[x](javascript:alert(1))").some((n) => n.t === "link")).toBe(false);
    expect(parseInline("[x](javascript:void)")).toEqual([{ t: "text", v: "x" }]);
  });
  it("does not italicise arithmetic or snake_case", () => {
    expect(parseInline("2 * 3 * 4")).toEqual([{ t: "text", v: "2 * 3 * 4" }]);
    expect(parseInline("cash_on_cash")).toEqual([{ t: "text", v: "cash_on_cash" }]);
    expect(parseInline("`a*b*c`")).toEqual([{ t: "code", v: "a*b*c" }]);
  });
});
