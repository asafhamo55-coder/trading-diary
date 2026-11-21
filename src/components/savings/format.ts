// Labels and number formatting for the Retirement & Savings UI. Pure (no
// React), so both server and client components can import it.
import {
  IL_SAVINGS_TYPES,
  JOINT_OWNER,
  SAVINGS_TYPES,
  US_SAVINGS_TYPES,
  type HouseholdMember,
} from "@/lib/savings";
import type { StatusTone } from "@/components/ui/badge";

// ── Account types ──────────────────────────────────────────────────

export const TYPE_LABELS: Record<string, { en: string; he?: string; short?: string }> = {
  pension: { en: "Pension fund", he: "קרן פנסיה" },
  managers_insurance: { en: "Manager's insurance", he: "ביטוח מנהלים" },
  hishtalmut: { en: "Study fund", he: "קרן השתלמות" },
  gemel: { en: "Provident fund", he: "קופת גמל" },
  gemel_investment: { en: "Investment provident fund", he: "קופת גמל להשקעה" },
  savings_policy: { en: "Savings policy", he: "פוליסת חיסכון" },
  savings_child: { en: "Child savings", he: "חיסכון לכל ילד" },
  "401k": { en: "401(k)" },
  ira: { en: "IRA" },
  brokerage: { en: "Brokerage", he: "תיק השקעות" },
  rsu: { en: "RSUs / stock plan", he: "מניות חברה (RSU)" },
  cash: { en: "Cash & deposits", he: "מזומן ופיקדונות" },
  other: { en: "Other", he: "אחר" },
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type]?.en ?? humanize(type);
}
export function typeLabelHe(type: string): string | undefined {
  return TYPE_LABELS[type]?.he;
}

const IL_SET = new Set<string>(IL_SAVINGS_TYPES);
const US_SET = new Set<string>(US_SAVINGS_TYPES);

/** Type picker groups — built from the domain enums so new types appear automatically. */
export const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Israel", types: SAVINGS_TYPES.filter((t) => IL_SET.has(t)) },
  { label: "United States", types: SAVINGS_TYPES.filter((t) => US_SET.has(t)) },
  { label: "Other", types: SAVINGS_TYPES.filter((t) => !IL_SET.has(t) && !US_SET.has(t)) },
];

export function defaultCountryFor(type: string): "IL" | "US" {
  return US_SET.has(type) ? "US" : "IL";
}

/** Display order for type groups on the overview. */
export function typeOrder(type: string): number {
  const i = (SAVINGS_TYPES as readonly string[]).indexOf(type);
  return i < 0 ? 999 : i;
}

// ── Benefits ───────────────────────────────────────────────────────

export const BENEFIT_LABELS: Record<string, { en: string; he?: string }> = {
  life: { en: "Life", he: "ביטוח חיים" },
  add: { en: "Accidental death (AD&D)", he: "מוות מתאונה" },
  ltd: { en: "Long-term disability", he: "אובדן כושר עבודה" },
  std: { en: "Short-term disability", he: "נכות זמנית" },
  work_capacity: { en: "Loss of work capacity", he: "אובדן כושר עבודה" },
  health: { en: "Health", he: "ביטוח בריאות" },
  dental: { en: "Dental", he: "שיניים" },
  vision: { en: "Vision", he: "ראייה" },
  critical_illness: { en: "Critical illness", he: "מחלות קשות" },
  long_term_care: { en: "Long-term care", he: "ביטוח סיעודי" },
  hsa: { en: "HSA" },
  fsa: { en: "FSA" },
  espp: { en: "ESPP" },
  "401k_match": { en: "401(k) match" },
  other: { en: "Other", he: "אחר" },
};
export function benefitLabel(cat: string): string {
  return BENEFIT_LABELS[cat]?.en ?? humanize(cat);
}

export const RISK_LABELS: Record<string, string> = {
  death: "Death",
  accidental_death: "Accidental death",
  disability: "Disability / work capacity",
  short_term_disability: "Short-term disability",
  critical_illness: "Critical illness",
  long_term_care: "Long-term care",
  health: "Health",
};
export function riskLabel(risk: string): string {
  return RISK_LABELS[risk] ?? benefitLabel(risk);
}

export const PAYER_LABELS: Record<string, string> = {
  employee: "Employee",
  employer: "Employer",
  split: "Split",
};

// ── People ─────────────────────────────────────────────────────────

export function memberName(key: string, members: HouseholdMember[]): string {
  if (key === JOINT_OWNER) return "Joint";
  const m = members.find((x) => x.key === key);
  return m?.name || m?.nameHe || humanize(key);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ── Status ─────────────────────────────────────────────────────────

export function statusTone(status: string | null | undefined): StatusTone {
  const s = (status ?? "").toLowerCase();
  if (!s) return "neutral";
  if (/closed|cancel|סגור|מבוטל/.test(s)) return "danger";
  if (/paid.?up|frozen|מוקפא|מסולק|inactive|לא פעיל|dormant/.test(s)) return "warning";
  if (/active|פעיל/.test(s)) return "success";
  return "neutral";
}

// ── Numbers ────────────────────────────────────────────────────────

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, digits: number, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${digits}|${compact}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "ILS",
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
      ...(compact ? { notation: "compact" } : {}),
    });
    fmtCache.set(key, f);
  }
  return f;
}

/** "$12,340" / "₪45,000". `compact` → "$1.2M". */
export function money(
  amount: number | null | undefined,
  currency: string = "USD",
  opts: { compact?: boolean; digits?: number } = {}
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const compact = opts.compact ?? false;
  const digits = opts.digits ?? (compact ? 1 : 0);
  return nf(currency, digits, compact).format(amount);
}

export function pct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Number(v.toFixed(digits))}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function humanize(s: string): string {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : s;
}

/** Parse a form field: "" → null, "1,234.5" → 1234.5, junk → NaN. */
export function parseNum(v: string): number | null {
  const s = v.replace(/[,\s₪$%]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function numToField(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}
