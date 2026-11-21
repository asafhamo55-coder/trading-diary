// Pure builder for GET /api/assistant/pending: decides which entities the
// pending questions reference (planBundle), then assembles one compact data
// bundle from data the route already loaded (buildPendingBundle). Shared
// records (glossary entries, properties, savings accounts) appear once under
// `data` and each question points at them via `refs`.
//
// Privacy: everything here is sent to the Claude Code routine, so strip what
// it never needs (tenant contact details, full policy numbers, national IDs).

import { parseContextKey, type AssistantQuestionDTO } from "./assistant";

export interface BundlePlan {
  explainKeys: string[];
  propertyIds: string[];
  savingsIds: string[];
  guidelines: boolean;
}

export function planBundle(questions: Pick<AssistantQuestionDTO, "contextKeys">[]): BundlePlan {
  const explain = new Set<string>();
  const props = new Set<string>();
  const savings = new Set<string>();
  let guidelines = false;
  for (const q of questions) {
    for (const k of q.contextKeys) {
      const ref = parseContextKey(k);
      if (!ref) continue;
      if (ref.kind === "explain") explain.add(ref.key);
      else if (ref.kind === "property") props.add(ref.id);
      else if (ref.kind === "savings") savings.add(ref.id);
      else guidelines = true;
    }
  }
  return { explainKeys: [...explain], propertyIds: [...props], savingsIds: [...savings], guidelines };
}

// ── Redaction ───────────────────────────────────────────────────────

const SENSITIVE_KEY = /(national|teudat|idnumber|id_number|personalid|ssn|socialsecurity|passport|taxid|policynumber|accountnumber|iban|routing|email|phone|password|token|secret)/i;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
/** A bare 9-digit run (Israeli ID number format). */
const IL_ID_PATTERN = /(?<!\w|\d[.,])\d{9}(?!\w|[.,]\d)/g;

/** Deep copy with sensitive keys dropped and ID-like number runs masked. */
export function redactSensitive<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(SSN_PATTERN, "[redacted]").replace(IL_ID_PATTERN, "[redacted]");
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(k)) continue;
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

// ── Compact entity views ────────────────────────────────────────────

export const MAX_PROPERTY_TRANSACTIONS = 150;

type Rec = Record<string, unknown>;

/**
 * A property record for the answerer: tenants keep lease terms and rent but
 * lose name/email/phone/notes; transactions are capped to the most recent
 * MAX_PROPERTY_TRANSACTIONS (sorted by date desc) with a count of the rest.
 */
export function compactProperty(p: Rec): Rec {
  const { tenants, transactions, ...rest } = p;
  const tx = Array.isArray(transactions) ? [...(transactions as Rec[])] : [];
  tx.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const kept = tx.slice(0, MAX_PROPERTY_TRANSACTIONS);
  return redactSensitive({
    ...rest,
    tenants: Array.isArray(tenants)
      ? (tenants as Rec[]).map((t) => ({
          id: t.id,
          leaseStart: t.leaseStart ?? null,
          leaseEnd: t.leaseEnd ?? null,
          monthlyRent: t.monthlyRent ?? null,
          securityDeposit: t.securityDeposit ?? null,
        }))
      : [],
    transactions: kept,
    transactionsOmitted: tx.length - kept.length,
  });
}

/** A savings account for the answerer (no full policy number, no login URL). */
export function compactSavingsAccount(a: Rec): Rec {
  const { loginUrl: _loginUrl, ...rest } = a;
  void _loginUrl;
  return redactSensitive(rest);
}

// ── Bundle ──────────────────────────────────────────────────────────

export interface PendingQuestionView {
  id: string;
  question: string;
  language: "he" | "en";
  pagePath: string;
  pageTitle: string | null;
  contextKeys: string[];
  createdAt: string;
  refs: {
    explain: string[];
    properties: string[];
    savingsAccounts: string[];
    guidelines: boolean;
    /** Context keys whose data could not be found (unknown glossary key, deleted entity). */
    missing: string[];
  };
}

export interface PendingBundle {
  generatedAt: string;
  count: number;
  questions: PendingQuestionView[];
  data: {
    advisorSnapshot: unknown;
    glossary: Record<string, unknown>;
    properties: Record<string, Rec>;
    savingsAccounts: Record<string, Rec>;
    guidelines: unknown;
  } | null;
}

export interface BundleInputs {
  /** Household snapshot as built for the advisor (advisor-context.ts). null if it failed. */
  advisorSnapshot: unknown;
  /** Glossary entries by key, only those that exist. */
  glossary: Record<string, unknown>;
  properties: Record<string, Rec>;
  savingsAccounts: Record<string, Rec>;
  guidelines: unknown;
}

export function buildPendingBundle(
  questions: AssistantQuestionDTO[],
  inputs: BundleInputs | null,
  now: Date = new Date()
): PendingBundle {
  const pending = questions.filter((q) => q.status === "pending");
  if (pending.length === 0 || !inputs) {
    return { generatedAt: now.toISOString(), count: pending.length, questions: pending.map((q) => view(q, null)), data: null };
  }
  const properties: Record<string, Rec> = {};
  for (const [id, p] of Object.entries(inputs.properties)) properties[id] = compactProperty(p);
  const savingsAccounts: Record<string, Rec> = {};
  for (const [id, a] of Object.entries(inputs.savingsAccounts)) savingsAccounts[id] = compactSavingsAccount(a);
  const data = {
    advisorSnapshot: inputs.advisorSnapshot == null ? null : redactSensitive(inputs.advisorSnapshot),
    glossary: inputs.glossary,
    properties,
    savingsAccounts,
    guidelines: inputs.guidelines ?? null,
  };
  return { generatedAt: now.toISOString(), count: pending.length, questions: pending.map((q) => view(q, data)), data };
}

function view(q: AssistantQuestionDTO, data: PendingBundle["data"]): PendingQuestionView {
  const refs: PendingQuestionView["refs"] = { explain: [], properties: [], savingsAccounts: [], guidelines: false, missing: [] };
  for (const k of q.contextKeys) {
    const ref = parseContextKey(k);
    if (!ref || !data) continue;
    if (ref.kind === "explain") {
      if (ref.key in data.glossary) refs.explain.push(ref.key);
      else refs.missing.push(k);
    } else if (ref.kind === "property") {
      if (ref.id in data.properties) refs.properties.push(ref.id);
      else refs.missing.push(k);
    } else if (ref.kind === "savings") {
      if (ref.id in data.savingsAccounts) refs.savingsAccounts.push(ref.id);
      else refs.missing.push(k);
    } else if (data.guidelines) {
      refs.guidelines = true;
    } else {
      refs.missing.push(k);
    }
  }
  return {
    id: q.id,
    question: q.question,
    language: q.language,
    pagePath: q.pagePath,
    pageTitle: q.pageTitle,
    contextKeys: q.contextKeys,
    createdAt: q.createdAt,
    refs,
  };
}
