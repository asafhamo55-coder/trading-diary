// Pure mapper: Israeli PDF-extract JSON → SavingsAccount / SavingsSnapshot /
// Benefit inputs. No Prisma here (see savings-data.ts → importSavingsDoc), so
// it's unit-tested directly in tests/lib/savings-import.test.ts.
import {
  IL_SAVINGS_TYPES,
  normalizeCurrency,
  parseLooseDate,
  policyLast4,
  savingsMatchKey,
  type BenefitCategory,
  type Currency,
  type SavingsType,
} from "./savings";
import type { SavingsImportDoc, SavingsImportProduct } from "./savings-validators";

export interface ImportedAccount {
  matchKey: string;
  owner: string;
  country: "IL";
  type: SavingsType;
  provider: string;
  planName: string | null;
  policyLast4: string | null;
  policyNumber: string | null;
  status: string | null;
  currency: Currency;
  balance: number;
  balanceAsOf: Date | null;
  track: string | null;
  feeDepositPct: number | null;
  feeAccumulationPct: number | null;
  monthlyDepositEmployee: number | null;
  monthlyDepositEmployer: number | null;
  monthlyDepositSeverance: number | null;
  monthlyDepositTotal: number | null;
  insuredSalary: number | null;
  liquidityDate: Date | null;
  projectedMonthlyPension: number | null;
  details: Record<string, unknown>;
}

export interface ImportedBenefit {
  importKey: string;
  owner: string;
  country: "IL";
  source: string; // provider
  category: BenefitCategory;
  coverageAmount: number | null;
  coverageCurrency: Currency;
  monthlyCost: number | null;
  costCurrency: Currency;
  /** matchKey of the SavingsAccount this cover lives inside (null = standalone policy). */
  accountMatchKey: string | null;
  details: Record<string, unknown>;
}

export interface ImportedMember {
  key: string;
  name: string | null;
  nameHe: string | null;
  birthDate: string | null;
  targetRetirementAge: number | null;
}

export interface MappedImport {
  accounts: ImportedAccount[];
  benefits: ImportedBenefit[];
  members: ImportedMember[];
  warnings: string[];
}

const IL_TYPE_SET = new Set<string>(IL_SAVINGS_TYPES);

/** Map an extractor product type to a SavingsType ("other" for unknowns). */
export function normalizeImportType(type: string): SavingsType {
  const t = type.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (IL_TYPE_SET.has(t)) return t as SavingsType;
  if (t === "managers" || t === "bituach_menahalim") return "managers_insurance";
  if (t === "study_fund" || t === "keren_hishtalmut") return "hishtalmut";
  return "other";
}

/** Map a coverage's free-text type (EN or HE) to a Benefit category. */
export function coverageCategory(type?: string | null, typeHe?: string | null): BenefitCategory {
  const s = `${type ?? ""} ${typeHe ?? ""}`.toLowerCase();
  if (/accident|תאונ/.test(s)) return "add";
  if (/work.?capacity|loss.?of.?work|disab|אובדן כושר|אכ"ע|נכות/.test(s)) return "work_capacity";
  if (/critical|מחלות קשות/.test(s)) return "critical_illness";
  if (/long.?term.?care|\bltc\b|סיעוד/.test(s)) return "long_term_care";
  if (/death|life|survivor|widow|orphan|term|risk|מוות|שארים|אלמנ|יתומ|ריסק|חיים/.test(s)) return "life";
  if (/health|בריאות/.test(s)) return "health";
  return "other";
}

/** A pure-risk term-life policy (no savings component) → Benefit only, no SavingsAccount. */
export function isStandaloneTermLife(p: SavingsImportProduct): boolean {
  const text = `${p.type} ${p.typeHe ?? ""} ${p.planName ?? ""}`.toLowerCase();
  const looksRisk = /term_life|term life|ריסק|risk|ביטוח חיים/.test(text);
  return looksRisk && !(p.balance && p.balance > 0);
}

// Fields mapped to columns (or deliberately dropped, like the full policy
// number) — everything else lands in `details`.
const MAPPED_KEYS = new Set([
  "type",
  "provider",
  "planName",
  "policyNumber",
  "status",
  "balance",
  "track",
  "feeDepositPct",
  "feeAccumulationPct",
  "monthlyDeposit",
  "insuredSalary",
  "liquidityDate",
  "projectedMonthlyPension",
]);

const n = (v: number | null | undefined): number | null => (v == null ? null : v);

export function mapSavingsImport(doc: SavingsImportDoc): MappedImport {
  const warnings: string[] = [];
  const accounts: ImportedAccount[] = [];
  const benefits: ImportedBenefit[] = [];
  const members: ImportedMember[] = [];
  const currency = normalizeCurrency(doc.currency ?? "ILS");
  const fallbackAsOf = Object.values(doc.asOf)[0];
  const seen = new Set<string>();

  for (const person of doc.people) {
    members.push({
      key: person.key,
      name: person.nameEn ?? null,
      nameHe: person.nameHe ?? null,
      birthDate: person.birthDate ? (parseLooseDate(person.birthDate)?.toISOString().slice(0, 10) ?? null) : null,
      targetRetirementAge: person.retirementAge ? Math.round(person.retirementAge) : null,
    });
    const asOfStr = doc.asOf[person.key] ?? fallbackAsOf;
    const asOf = parseLooseDate(asOfStr);
    if (!asOf) warnings.push(`No valid asOf date for ${person.key}; balances imported without a snapshot.`);

    person.products.forEach((p, idx) => {
      const last4 = policyLast4(p.policyNumber ?? null);
      const provider = p.provider.trim();

      if (isStandaloneTermLife(p)) {
        const covers = p.coverages && p.coverages.length > 0 ? p.coverages : [{ type: "life", typeHe: p.typeHe ?? null, amount: null, monthlyCost: null }];
        covers.forEach((c, ci) => {
          benefits.push({
            importKey: ["import", person.key, provider.toLowerCase(), "termlife", last4 ?? `p${idx}`, ci].join("|"),
            owner: person.key,
            country: "IL",
            source: provider,
            category: coverageCategory(c.type, c.typeHe) === "other" ? "life" : coverageCategory(c.type, c.typeHe),
            coverageAmount: n(c.amount),
            coverageCurrency: currency,
            monthlyCost: n(c.monthlyCost),
            costCurrency: currency,
            accountMatchKey: null,
            details: { coverageType: c.type ?? null, coverageTypeHe: c.typeHe ?? null, planName: p.planName ?? null, policyLast4: last4, status: p.status ?? null, sourcePage: p.sourcePage ?? null },
          });
        });
        return;
      }

      const type = normalizeImportType(p.type);
      if (type === "other" && p.type.toLowerCase() !== "other") {
        warnings.push(`Unknown product type "${p.type}" from ${provider} (${person.key}) imported as "other".`);
      }
      const matchKey = savingsMatchKey({ owner: person.key, provider, type, policyLast4: last4 });
      if (seen.has(matchKey)) {
        warnings.push(`Duplicate product ${provider} ${type} (${person.key}) in the same file — later entry wins.`);
        const i = accounts.findIndex((a) => a.matchKey === matchKey);
        if (i >= 0) accounts.splice(i, 1);
      }
      seen.add(matchKey);

      const details: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(p)) {
        if (!MAPPED_KEYS.has(k) && v !== undefined && v !== null) details[k] = v;
      }
      const dep = p.monthlyDeposit ?? {};
      if (p.balance == null) warnings.push(`No balance for ${provider} ${type} (${person.key}); stored as 0.`);

      accounts.push({
        matchKey,
        owner: person.key,
        country: "IL",
        type,
        provider,
        planName: p.planName ?? null,
        policyLast4: last4,
        policyNumber: p.policyNumber != null ? String(p.policyNumber).trim() || null : null,
        status: p.status ?? null,
        currency,
        balance: p.balance ?? 0,
        balanceAsOf: asOf,
        track: p.track ?? null,
        feeDepositPct: n(p.feeDepositPct),
        feeAccumulationPct: n(p.feeAccumulationPct),
        monthlyDepositEmployee: n(dep.employee),
        monthlyDepositEmployer: n(dep.employer),
        monthlyDepositSeverance: n(dep.severance),
        monthlyDepositTotal: n(dep.total),
        insuredSalary: n(p.insuredSalary),
        liquidityDate: parseLooseDate(p.liquidityDate ?? null),
        projectedMonthlyPension: n(p.projectedMonthlyPension),
        details,
      });

      (p.coverages ?? []).forEach((c, ci) => {
        benefits.push({
          importKey: ["import", matchKey, ci].join("|"),
          owner: person.key,
          country: "IL",
          source: provider,
          category: coverageCategory(c.type, c.typeHe),
          coverageAmount: n(c.amount),
          coverageCurrency: currency,
          monthlyCost: n(c.monthlyCost),
          costCurrency: currency,
          accountMatchKey: matchKey,
          details: { coverageType: c.type ?? null, coverageTypeHe: c.typeHe ?? null, productType: type },
        });
      });
    });
  }
  return { accounts, benefits, members, warnings };
}
