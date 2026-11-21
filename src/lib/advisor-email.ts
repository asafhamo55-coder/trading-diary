// Turns an advisor email (stored with {{account:<id>}} placeholders) into a
// ready-to-send message: fills in the account reference from the user's own
// data, picks the recipient from the profile contacts, and builds a mailto:
// URL. Pure — runs in the browser when the "Prepare email" dialog opens, so
// real policy numbers never pass through the model or the stored report.
import type { AdvisorEmail, AdvisorLang } from "./advisor-report";

export interface EmailAccount {
  id: string;
  country: string;
  provider: string;
  planName?: string | null;
  policyNumber?: string | null;
  policyLast4?: string | null;
  details?: Record<string, unknown> | null;
}

export interface EmailContact {
  id: string;
  name: string;
  role: string;
  country: "IL" | "US";
  email?: string | null;
  language: "he" | "en";
}

/**
 * Hebrew when every account the email concerns is Israeli, English when any is
 * American; with no accounts, the model's choice stands.
 */
export function emailLanguage(email: Pick<AdvisorEmail, "language" | "accountIds">, accounts: EmailAccount[]): AdvisorLang {
  const mine = email.accountIds.map((id) => accounts.find((a) => a.id === id)).filter((a): a is EmailAccount => !!a);
  if (mine.length === 0) return email.language;
  return mine.some((a) => a.country === "US") ? "en" : "he";
}

/** "<provider> — <plan> — מס' פוליסה 123456" / "Policy no. 123456"; ••1234 when only the last 4 are known. */
export function formatAccountRef(a: EmailAccount, lang: AdvisorLang): string {
  const number = a.policyNumber?.trim() || (a.policyLast4 ? `••${a.policyLast4}` : null);
  const label = lang === "he" ? "מס' פוליסה" : "Policy no.";
  return [a.provider, a.planName?.trim() || null, number ? `${label} ${number}` : null].filter(Boolean).join(" — ");
}

const PLACEHOLDER = /\{\{\s*account\s*:\s*([^}\s]+)\s*\}\}/g;

/** Replace every {{account:<id>}}; unknown ids become a visible "[account?]" marker. */
export function fillAccountPlaceholders(text: string, accounts: EmailAccount[], lang: AdvisorLang): { text: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(PLACEHOLDER, (_m, id: string) => {
    const a = accounts.find((x) => x.id === id);
    if (!a) {
      missing.push(id);
      return lang === "he" ? "[חשבון לא נמצא]" : "[account not found]";
    }
    // In Hebrew text, isolate the mixed Latin/Hebrew/number reference (FSI…PDI)
    // so the bidi algorithm doesn't reorder its parts.
    return lang === "he" ? `\u2068${formatAccountRef(a, lang)}\u2069` : formatAccountRef(a, lang);
  });
  return { text: out, missing };
}

/**
 * Recipient: the email's contactId, else the contactId stored on the first
 * account it concerns (details.contactId), else the first contact with the
 * same role in the account's country (IL for Hebrew emails, US otherwise).
 */
export function resolveRecipient(
  email: Pick<AdvisorEmail, "contactId" | "contactRole" | "accountIds">,
  lang: AdvisorLang,
  contacts: EmailContact[],
  accounts: EmailAccount[]
): EmailContact | null {
  const byId = (id: string | null | undefined) => (id ? contacts.find((c) => c.id === id) ?? null : null);
  const direct = byId(email.contactId);
  if (direct) return direct;
  for (const accId of email.accountIds) {
    const a = accounts.find((x) => x.id === accId);
    const c = byId(typeof a?.details?.contactId === "string" ? (a.details.contactId as string) : null);
    if (c) return c;
  }
  const firstAcct = accounts.find((x) => email.accountIds.includes(x.id));
  const country = firstAcct?.country === "IL" || firstAcct?.country === "US" ? firstAcct.country : lang === "he" ? "IL" : "US";
  return contacts.find((c) => c.role === email.contactRole && c.country === country) ?? null;
}

export interface RenderedEmail {
  language: AdvisorLang;
  dir: "rtl" | "ltr";
  to: string;
  recipient: EmailContact | null;
  subject: string;
  body: string;
  missingAccounts: string[];
}

export function renderAdvisorEmail(email: AdvisorEmail, accounts: EmailAccount[], contacts: EmailContact[]): RenderedEmail {
  const language = emailLanguage(email, accounts);
  const subject = fillAccountPlaceholders(email.subject, accounts, language);
  const body = fillAccountPlaceholders(email.body, accounts, language);
  const recipient = resolveRecipient(email, language, contacts, accounts);
  return {
    language,
    dir: language === "he" ? "rtl" : "ltr",
    to: recipient?.email?.trim() ?? "",
    recipient,
    subject: subject.text,
    body: body.text,
    missingAccounts: [...new Set([...subject.missing, ...body.missing])],
  };
}

/** Many mail clients truncate or refuse mailto URLs much past ~2,000 characters. */
export const MAILTO_MAX = 2000;

/** mailto: with RFC 6068 encoding (spaces as %20, CRLF line breaks); null when too long. */
export function buildMailto(to: string, subject: string, body: string, max = MAILTO_MAX): { url: string | null; length: number } {
  const enc = (s: string) => encodeURIComponent(s);
  const url = `mailto:${to.split(/[,;]\s*/).filter(Boolean).map(enc).join(",")}?subject=${enc(subject)}&body=${enc(body.replace(/\r?\n/g, "\r\n"))}`;
  return { url: url.length <= max ? url : null, length: url.length };
}

/** Plain-text bundle for "Copy all". */
export function emailAsText(e: { to: string; subject: string; body: string }, lang: AdvisorLang): string {
  const [toL, subL] = lang === "he" ? ["אל", "נושא"] : ["To", "Subject"];
  return `${toL}: ${e.to}\n${subL}: ${e.subject}\n\n${e.body}`;
}
