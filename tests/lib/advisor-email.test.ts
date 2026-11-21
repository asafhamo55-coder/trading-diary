import { describe, expect, it } from "vitest";
import {
  MAILTO_MAX,
  buildMailto,
  emailAsText,
  emailLanguage,
  fillAccountPlaceholders,
  formatAccountRef,
  renderAdvisorEmail,
  resolveRecipient,
  type EmailAccount,
  type EmailContact,
} from "../../src/lib/advisor-email";
import type { AdvisorEmail } from "../../src/lib/advisor-report";

// Synthetic accounts/contacts only (public repo).
const IL_PENSION: EmailAccount = { id: "acc-il-1", country: "IL", provider: "Provider A", planName: "Pension Plus", policyNumber: "000111222", policyLast4: "1222" };
const IL_HISHT: EmailAccount = { id: "acc-il-2", country: "IL", provider: "Provider B", planName: null, policyNumber: null, policyLast4: "9876", details: { contactId: "agent-2" } };
const US_401K: EmailAccount = { id: "acc-us-1", country: "US", provider: "Provider C", planName: "401(k)", policyNumber: null, policyLast4: null };
const ACCOUNTS = [IL_PENSION, IL_HISHT, US_401K];

const CONTACTS: EmailContact[] = [
  { id: "agent-1", name: "Agent One", role: "insurance_agent", country: "IL", email: "agent1@example.com", language: "he" },
  { id: "agent-2", name: "Agent Two", role: "pension_agent", country: "IL", email: "agent2@example.com", language: "he" },
  { id: "hr-1", name: "HR Desk", role: "hr_benefits", country: "US", email: "hr@example.com", language: "en" },
];

const email = (over: Partial<AdvisorEmail> = {}): AdvisorEmail => ({
  id: "e1",
  contactRole: "insurance_agent",
  contactId: null,
  accountIds: ["acc-il-1"],
  language: "he",
  subject: "בקשה להפחתת דמי ניהול — {{account:acc-il-1}}",
  body: "שלום,\nנבקש להפחית את דמי הניהול בפוליסה {{account:acc-il-1}} מ־1.00% ל־0.20%.\nבתודה",
  actionItemId: "a2",
  ...over,
});

describe("emailLanguage", () => {
  it("is Hebrew for Israeli accounts, English when any account is American, else the model's choice", () => {
    expect(emailLanguage({ language: "en", accountIds: ["acc-il-1", "acc-il-2"] }, ACCOUNTS)).toBe("he");
    expect(emailLanguage({ language: "he", accountIds: ["acc-us-1"] }, ACCOUNTS)).toBe("en");
    expect(emailLanguage({ language: "he", accountIds: ["acc-il-1", "acc-us-1"] }, ACCOUNTS)).toBe("en");
    expect(emailLanguage({ language: "en", accountIds: [] }, ACCOUNTS)).toBe("en");
    expect(emailLanguage({ language: "he", accountIds: ["unknown"] }, ACCOUNTS)).toBe("he");
  });
});

describe("account placeholders", () => {
  it("formats the reference in the email's language, falling back to the last 4", () => {
    expect(formatAccountRef(IL_PENSION, "he")).toBe("Provider A — Pension Plus — מס' פוליסה 000111222");
    expect(formatAccountRef(IL_PENSION, "en")).toBe("Provider A — Pension Plus — Policy no. 000111222");
    expect(formatAccountRef(IL_HISHT, "he")).toBe("Provider B — מס' פוליסה ••9876");
    expect(formatAccountRef(US_401K, "en")).toBe("Provider C — 401(k)");
  });

  it("replaces every placeholder (tolerating spaces) and reports unknown ids", () => {
    const r = fillAccountPlaceholders("A {{account:acc-il-1}} B {{ account : acc-us-1 }} C {{account:ghost}}", ACCOUNTS, "en");
    expect(r.text).toBe("A Provider A — Pension Plus — Policy no. 000111222 B Provider C — 401(k) C [account not found]");
    expect(r.missing).toEqual(["ghost"]);
  });
});

describe("resolveRecipient", () => {
  it("prefers the email's contactId", () => {
    expect(resolveRecipient(email({ contactId: "hr-1" }), "he", CONTACTS, ACCOUNTS)?.id).toBe("hr-1");
  });
  it("then the account's own contact (details.contactId)", () => {
    expect(resolveRecipient(email({ accountIds: ["acc-il-2"] }), "he", CONTACTS, ACCOUNTS)?.id).toBe("agent-2");
  });
  it("then the first contact with the same role in the account's country", () => {
    expect(resolveRecipient(email(), "he", CONTACTS, ACCOUNTS)?.id).toBe("agent-1");
    expect(resolveRecipient(email({ contactRole: "hr_benefits", accountIds: ["acc-us-1"] }), "en", CONTACTS, ACCOUNTS)?.id).toBe("hr-1");
  });
  it("uses the language's country without accounts, and returns null when nobody fits", () => {
    expect(resolveRecipient(email({ accountIds: [], contactRole: "hr_benefits" }), "en", CONTACTS, ACCOUNTS)?.id).toBe("hr-1");
    expect(resolveRecipient(email({ contactRole: "cpa" }), "he", CONTACTS, ACCOUNTS)).toBeNull();
    expect(resolveRecipient(email({ contactRole: "insurance_agent", accountIds: ["acc-us-1"] }), "en", CONTACTS, ACCOUNTS)).toBeNull();
  });
});

describe("renderAdvisorEmail", () => {
  it("fills placeholders, picks the language and recipient, keeps the stored email untouched", () => {
    const e = email();
    const r = renderAdvisorEmail(e, ACCOUNTS, CONTACTS);
    expect(r.language).toBe("he");
    expect(r.dir).toBe("rtl");
    expect(r.to).toBe("agent1@example.com");
    expect(r.subject).toBe("בקשה להפחתת דמי ניהול — \u2068Provider A — Pension Plus — מס' פוליסה 000111222\u2069"); // bidi-isolated
    expect(r.body).toContain("מס' פוליסה 000111222");
    expect(r.body).not.toContain("{{");
    expect(r.missingAccounts).toEqual([]);
    expect(e.body).toContain("{{account:acc-il-1}}");
  });

  it("has an empty To when no contact matches", () => {
    const r = renderAdvisorEmail(email({ contactRole: "cpa" }), ACCOUNTS, CONTACTS);
    expect(r.to).toBe("");
    expect(r.recipient).toBeNull();
  });
});

describe("buildMailto", () => {
  it("URL-encodes subject and body (spaces %20, CRLF line breaks, Hebrew as UTF-8)", () => {
    const { url } = buildMailto("a@example.com", "Fee cut & more", "Line 1\nשורה 2");
    expect(url).toBe(
      "mailto:a%40example.com?subject=Fee%20cut%20%26%20more&body=Line%201%0D%0A%D7%A9%D7%95%D7%A8%D7%94%202"
    );
  });

  it("supports several recipients and an empty To", () => {
    expect(buildMailto("a@x.com, b@x.com", "s", "b").url).toBe("mailto:a%40x.com,b%40x.com?subject=s&body=b");
    expect(buildMailto("", "s", "b").url).toBe("mailto:?subject=s&body=b");
  });

  it("returns null past the length limit so the UI falls back to copying", () => {
    const long = "א".repeat(400); // 6 encoded chars each
    const r = buildMailto("a@example.com", "s", long);
    expect(r.url).toBeNull();
    expect(r.length).toBeGreaterThan(MAILTO_MAX);
    expect(buildMailto("a@example.com", "s", long, 10_000).url).not.toBeNull();
  });
});

describe("emailAsText", () => {
  it("labels the headers in the email's language", () => {
    expect(emailAsText({ to: "a@x.com", subject: "S", body: "B" }, "he")).toBe("אל: a@x.com\nנושא: S\n\nB");
    expect(emailAsText({ to: "", subject: "S", body: "B" }, "en")).toBe("To: \nSubject: S\n\nB");
  });
});
