// Pure helpers for household-bundle JSON produced by the import-statements
// Claude Code skill (.claude/skills/import-statements): a privacy scrubber,
// a merger for several per-PDF bundles, and a human-readable summary/lint.
// No Prisma / Next imports, and relative imports only, so both vitest and the
// `npx tsx scripts/savings/*.ts` scripts can load it.
//
// See docs/savings/pdf-import.md for the bundle format and the rules.

import { parseLooseDate, policyLast4 } from "./savings";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Owner keys the household uses today (members in the profile may add more). */
export const KNOWN_OWNER_KEYS = ["asaf", "einat", "joint", "yoav", "nadav", "roni"] as const;

// ── Privacy scrubber ───────────────────────────────────────────────
//
// Policy (user decision, 2026-11): full policy / account numbers are allowed
// and kept. A person's own identifier is not: Israeli national ID (ת.ז) and
// US SSN/ITIN values are removed wherever they appear as an identifier. Some
// Israeli pension account numbers are "<9-digit ID>-<suffix>"; those are kept
// as the account number, but the bare 9-digit ID is never kept on its own.

export interface ScrubFinding {
  path: string;
  kind: "id-field" | "ssn" | "national-id" | "known-id";
  detail: string;
}

/** Keys whose value is a person's identifier (removed entirely). */
const PERSON_ID_KEY =
  /^(national_?id(_?number)?|id_?number|id_?no|teudat_?zehut|tz|t_z|ssn|social_?security(_?number)?|tax_?id|tin|itin|personal_?id|identity_?(number|no)?|id)$/i;

/** Keys whose value is an account / policy number (kept in full). */
const ACCOUNT_NUMBER_KEY = /(policy|account|plan|member|participant|fund)_?(number|no|num|id|last4)$|^policyNumber$/i;

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// A 9-digit run (optionally written 8 digits + "-" + check digit) that is not
// part of a longer number, date or decimal.
const NINE_DIGIT_RE = /(?<![\d.,/-])(\d{8}-?\d)(?![\d.,/]|-\d)/g;
// Words that mark the next number as a personal ID.
const ID_CONTEXT_RE = /(ת\.?\s?ז|ת["״']ז|תעודת\s+זהות|מספר\s+זהות|זהות|national\s+id|id\s*(no|number|#)|i\.d\.|ssn|social\s+security|tax\s*id|itin)\W{0,6}$/i;

/** Israeli ID check digit (Luhn variant over 9 digits). */
export function isValidIsraeliId(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 9 || /^0+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(d[i]) * (i % 2 === 0 ? 1 : 2);
    if (v > 9) v -= 9;
    sum += v;
  }
  return sum % 10 === 0;
}

/** IDs that appear as the prefix of ID-based account numbers ("<ID>-2"). */
export function idsFromAccountNumbers(bundle: unknown): Set<string> {
  const ids = new Set<string>();
  const walk = (v: unknown, key: string | null) => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
    if (isObj(v)) return Object.entries(v).forEach(([k, x]) => walk(x, k));
    if (key && ACCOUNT_NUMBER_KEY.test(key) && (typeof v === "string" || typeof v === "number")) {
      const m = /^\s*(\d{9})\s*[-/]\s*\d{1,3}\s*$/.exec(String(v));
      if (m && isValidIsraeliId(m[1])) ids.add(m[1]);
    }
  };
  walk(bundle, null);
  return ids;
}

function scrubText(s: string, path: string, knownIds: Set<string>, findings: ScrubFinding[]): string {
  let out = s.replace(SSN_RE, () => {
    findings.push({ path, kind: "ssn", detail: "SSN-formatted number removed" });
    return "[SSN removed]";
  });
  out = out.replace(NINE_DIGIT_RE, (match: string, _g: string, offset: number, whole: string) => {
    const digits = match.replace(/\D/g, "");
    const before = whole.slice(Math.max(0, offset - 24), offset);
    if (knownIds.has(digits)) {
      findings.push({ path, kind: "known-id", detail: "bare national ID (prefix of an ID-based account number) removed" });
      return "[ID removed]";
    }
    if (ID_CONTEXT_RE.test(before)) {
      findings.push({ path, kind: "national-id", detail: "number labelled as an ID removed" });
      return "[ID removed]";
    }
    return match;
  });
  return out;
}

/**
 * Remove personal identifiers from a bundle (returns a scrubbed deep copy).
 * - Keys that are a person's ID (nationalId, idNumber, ssn, tz, …) are dropped.
 * - SSN-formatted numbers are removed from every string.
 * - In free text, 9-digit numbers labelled as an ID (ת.ז, "ID no", SSN …) are
 *   removed, as is any bare ID that is the prefix of an ID-based account number.
 * - Account / policy number fields are kept in full, except when the value is
 *   exactly a bare ID (e.g. "123456782" when "123456782-2" is also present).
 */
export function scrubBundle<T>(bundle: T): { bundle: T; findings: ScrubFinding[] } {
  const findings: ScrubFinding[] = [];
  const knownIds = idsFromAccountNumbers(bundle);

  const walk = (v: unknown, path: string, key: string | null): unknown => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`, key));
    if (isObj(v)) {
      const out: Obj = {};
      for (const [k, x] of Object.entries(v)) {
        const p = path ? `${path}.${k}` : k;
        if (PERSON_ID_KEY.test(k) && (typeof x === "string" || typeof x === "number") && String(x).replace(/\D/g, "").length >= 5) {
          findings.push({ path: p, kind: "id-field", detail: `personal-ID field "${k}" removed` });
          continue;
        }
        out[k] = walk(x, p, k);
      }
      return out;
    }
    if (key && ACCOUNT_NUMBER_KEY.test(key)) {
      const digits = String(v ?? "").replace(/\D/g, "");
      if ((typeof v === "string" || typeof v === "number") && knownIds.has(digits)) {
        findings.push({ path, kind: "known-id", detail: "account-number field held a bare national ID" });
        return "[ID removed]";
      }
      if (typeof v === "string" && SSN_RE.test(v)) {
        SSN_RE.lastIndex = 0;
        findings.push({ path, kind: "ssn", detail: "SSN in an account-number field removed" });
        return "[SSN removed]";
      }
      return v;
    }
    if (typeof v === "string") return scrubText(v, path, knownIds, findings);
    return v;
  };

  return { bundle: walk(clone(bundle), "", null) as T, findings };
}

// ── Bundle shape helpers ───────────────────────────────────────────

/** Accept an Israeli extract ({asOf, people}) or a bundle; always return a bundle. */
export function toBundle(doc: unknown): Obj {
  if (!isObj(doc)) throw new Error("Expected a JSON object.");
  if ("people" in doc) return { israel: doc };
  return doc;
}

/** Strip extraction-only metadata that the import API does not need. */
export const EXTRACTION_META_KEYS = ["documentType", "sourceFile", "extractionWarnings", "warnings", "confidence"] as const;

const accountKey = (a: Obj) =>
  [str(a.owner) ?? "", (str(a.type) ?? "").toLowerCase(), (str(a.provider) ?? "").trim().toLowerCase(), policyLast4(a.policyNumber as string | number | null) ?? ""].join("|");
const benefitKey = (b: Obj) =>
  [str(b.owner) ?? "", str(b.category) ?? "", (str(b.source) ?? "").trim().toLowerCase()].join("|");
const productKey = (p: Obj) =>
  [(str(p.provider) ?? "").trim().toLowerCase(), (str(p.type) ?? "").toLowerCase(), policyLast4(p.policyNumber as string | number | null) ?? ""].join("|");

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const dateVal = (v: unknown): number => parseLooseDate(str(v))?.getTime() ?? -Infinity;

// ── Merge ──────────────────────────────────────────────────────────

/**
 * Merge several bundles (one per PDF) into one, mirroring the import's upsert
 * keys so that what you review is what will be written:
 * - israel.people merge by key; products dedupe by provider+type+policy last-4
 *   (the later statement date wins); asOf keeps the latest date per person.
 * - accounts dedupe by owner+type+provider+policy last-4 (newer balanceAsOf wins).
 * - benefits dedupe by owner+category+source (later file wins, with a warning).
 * - profile.members merge by key, non-null values from later files winning.
 */
export function mergeBundles(inputs: unknown[]): { bundle: Obj; warnings: string[] } {
  const warnings: string[] = [];
  const bundles = inputs.map(toBundle).map((b) => clone(b));
  const out: Obj = {};

  // Israel
  const israels = bundles.map((b) => b.israel).filter(isObj);
  if (israels.length) {
    const asOf: Record<string, string> = {};
    const people = new Map<string, Obj>();
    const notes: unknown[] = [];
    let currency: string | null = null;
    for (const isr of israels) {
      const cur = str(isr.currency) ?? "ILS";
      if (currency && cur !== currency) warnings.push(`Israeli extracts disagree on currency (${currency} vs ${cur}); kept ${currency}.`);
      currency = currency ?? cur;
      const docAsOf = isObj(isr.asOf) ? (isr.asOf as Record<string, unknown>) : {};
      for (const [k, v] of Object.entries(docAsOf)) {
        if (typeof v === "string" && (!(k in asOf) || dateVal(v) >= dateVal(asOf[k]))) asOf[k] = v;
      }
      notes.push(...arr(isr.agentNotes));
      for (const raw of arr(isr.people)) {
        if (!isObj(raw) || typeof raw.key !== "string") continue;
        const personDate = dateVal(docAsOf[raw.key]);
        const existing = people.get(raw.key);
        const products = arr(raw.products).filter(isObj).map((p): Obj => ({ ...p, __date: personDate }));
        if (!existing) {
          people.set(raw.key, { ...raw, products });
          continue;
        }
        for (const [k, v] of Object.entries(raw)) if (k !== "products" && v != null && existing[k] == null) existing[k] = v;
        const list = existing.products as Obj[];
        for (const p of products) {
          const i = list.findIndex((q) => productKey(q) === productKey(p));
          if (i === -1) list.push(p);
          else if (!same({ ...list[i], __date: 0 }, { ...p, __date: 0 })) {
            warnings.push(`${raw.key}: ${str(p.provider)} ${str(p.type)} appears more than once with different values; kept the newer statement.`);
            if ((p.__date as number) >= (list[i].__date as number)) list[i] = p;
          }
        }
      }
    }
    const merged = [...people.values()].map((p) => ({
      ...p,
      products: (p.products as Obj[]).map((x) => {
        const copy = { ...x };
        delete copy.__date;
        return copy;
      }),
    }));
    out.israel = { asOf, currency: currency ?? "ILS", people: merged, ...(notes.length ? { agentNotes: notes } : {}) };
  }

  // Accounts
  const accounts: Obj[] = [];
  for (const b of bundles) {
    for (const a of arr(b.accounts).filter(isObj)) {
      const i = accounts.findIndex((x) => accountKey(x) === accountKey(a));
      if (i === -1) accounts.push(a);
      else if (!same(accounts[i], a)) {
        warnings.push(`Account ${str(a.owner)} ${str(a.type)} ${str(a.provider)} appears more than once with different values; kept the newer balance.`);
        if (dateVal(a.balanceAsOf) >= dateVal(accounts[i].balanceAsOf)) accounts[i] = a;
      }
    }
  }
  if (accounts.length) out.accounts = accounts;

  // Benefits
  const benefits: Obj[] = [];
  for (const b of bundles) {
    for (const x of arr(b.benefits).filter(isObj)) {
      const i = benefits.findIndex((y) => benefitKey(y) === benefitKey(x));
      if (i === -1) benefits.push(x);
      else if (!same(benefits[i], x)) {
        warnings.push(
          `Benefit ${str(x.owner)} / ${str(x.category)} / "${str(x.source)}" appears more than once with different values; the import keys benefits on owner+category+source, so only the later one is kept. Give each a distinct source if both are real.`
        );
        benefits[i] = x;
      }
    }
  }
  if (benefits.length) out.benefits = benefits;

  // Profile
  const profiles = bundles.map((b) => b.profile).filter(isObj);
  if (profiles.length) {
    const profile: Obj = {};
    const members: Obj[] = [];
    for (const p of profiles) {
      for (const [k, v] of Object.entries(p)) if (k !== "members" && v != null) profile[k] = v;
      for (const m of arr(p.members).filter(isObj)) {
        const i = members.findIndex((x) => x.key === m.key);
        if (i === -1) members.push({ ...m });
        else for (const [k, v] of Object.entries(m)) if (v != null) members[i][k] = v;
      }
    }
    if (members.length) profile.members = members;
    out.profile = profile;
  }

  return { bundle: out, warnings };
}

// ── Summary / lint ─────────────────────────────────────────────────

export interface BundleSummary {
  people: number;
  israeliProducts: number;
  accounts: number;
  benefits: number;
  members: number;
  totalsByOwner: Record<string, Record<string, number>>; // owner → currency → balance
  lines: string[];
  warnings: string[];
}

/** Human-readable summary plus soft checks (things the schema can't catch). */
export function summarizeBundle(doc: unknown, extraOwnerKeys: string[] = []): BundleSummary {
  const b = toBundle(doc);
  const lines: string[] = [];
  const warnings: string[] = [];
  const totals: Record<string, Record<string, number>> = {};
  const add = (owner: string, cur: string, v: unknown) => {
    if (typeof v !== "number") return;
    totals[owner] ??= {};
    totals[owner][cur] = (totals[owner][cur] ?? 0) + v;
  };
  const memberKeys = arr(isObj(b.profile) ? b.profile.members : []).filter(isObj).map((m) => String(m.key));
  const owners = new Set<string>([...KNOWN_OWNER_KEYS, ...memberKeys, ...extraOwnerKeys]);
  const checkOwner = (o: unknown, where: string) => {
    if (typeof o === "string" && !owners.has(o)) warnings.push(`${where}: owner "${o}" is not a known member key (${[...owners].join(", ")}).`);
  };

  let products = 0;
  const isr = isObj(b.israel) ? b.israel : null;
  if (isr) {
    const cur = str(isr.currency) ?? "ILS";
    const asOf = isObj(isr.asOf) ? isr.asOf : {};
    for (const p of arr(isr.people).filter(isObj)) {
      const key = String(p.key);
      checkOwner(key, "israel.people");
      if (typeof asOf[key] !== "string") warnings.push(`israel.asOf has no statement date for "${key}".`);
      lines.push(`IL ${key} (statement ${str(asOf[key]) ?? "?"})`);
      const seen = new Set<string>();
      for (const x of arr(p.products).filter(isObj)) {
        products++;
        const k = productKey(x);
        if (seen.has(k)) warnings.push(`${key}: duplicate product ${str(x.provider)} ${str(x.type)} (same provider/type/last-4); the import keeps only the last.`);
        seen.add(k);
        const bal = typeof x.balance === "number" ? x.balance : null;
        if (bal == null) warnings.push(`${key}: ${str(x.provider)} ${str(x.type)} has no balance (stored as 0).`);
        add(key, cur, bal);
        lines.push(`  - ${str(x.type)} · ${str(x.provider)}${x.policyNumber ? ` #${x.policyNumber}` : ""}: ${bal ?? "—"} ${cur}${arr(x.coverages).length ? ` · ${arr(x.coverages).length} coverages` : ""}`);
      }
    }
  }

  const accounts = arr(b.accounts).filter(isObj);
  const seenAcc = new Set<string>();
  for (const a of accounts) {
    checkOwner(a.owner, "accounts");
    const k = accountKey(a);
    if (seenAcc.has(k)) warnings.push(`accounts: duplicate ${str(a.owner)} ${str(a.type)} ${str(a.provider)}; the import updates the same row twice.`);
    seenAcc.add(k);
    if (!a.balanceAsOf) warnings.push(`accounts: ${str(a.provider)} ${str(a.type)} has no balanceAsOf (today's date will be used).`);
    add(String(a.owner), String(a.currency), a.balance);
    lines.push(`${str(a.country)} ${str(a.owner)} · ${str(a.type)} · ${str(a.provider)}: ${a.balance} ${str(a.currency)} (as of ${str(a.balanceAsOf) ?? "?"})`);
  }

  const benefits = arr(b.benefits).filter(isObj);
  const seenBen = new Set<string>();
  for (const x of benefits) {
    checkOwner(x.owner, "benefits");
    const k = benefitKey(x);
    if (seenBen.has(k))
      warnings.push(`benefits: "${str(x.source)}" ${str(x.category)} for ${str(x.owner)} appears twice; benefits upsert on owner+category+source, so give each a distinct source.`);
    seenBen.add(k);
    lines.push(`benefit ${str(x.owner)} · ${str(x.category)} · ${str(x.source)}: cover ${x.coverageAmount ?? "—"} · ${x.monthlyCost ?? "—"}/mo (${str(x.payer) ?? "?"})`);
  }

  for (const k of EXTRACTION_META_KEYS) if (k in b) warnings.push(`Top-level "${k}" is extraction metadata; it is ignored by the import.`);

  return {
    people: isr ? arr(isr.people).length : 0,
    israeliProducts: products,
    accounts: accounts.length,
    benefits: benefits.length,
    members: memberKeys.length,
    totalsByOwner: totals,
    lines,
    warnings,
  };
}
