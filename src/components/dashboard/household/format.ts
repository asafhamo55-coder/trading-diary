// Formatting + label helpers for the household net-worth dashboard.
// Pure functions — no React, safe on server and client.

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const ils0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** $1,234,567 */
export function fmtUsd(v: number): string {
  return usd0.format(Math.round(v)).replace("-", "−");
}

/** $1.23M / $412K / $950 */
export function fmtUsdCompact(v: number): string {
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}$${trim(a / 1_000_000, a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}K`;
  if (a >= 1_000) return `${sign}$${trim(a / 1000, 1)}K`;
  return `${sign}$${Math.round(a)}`;
}

/** ₪1,234,567 */
export function fmtIls(v: number): string {
  return `${v < 0 ? "−" : ""}₪${ils0.format(Math.abs(Math.round(v)))}`;
}

/** ₪3.6M / ₪412K */
export function fmtIlsCompact(v: number): string {
  return fmtUsdCompact(v).replace("$", "₪");
}

export function fmtSignedUsdCompact(v: number): string {
  return `${v >= 0 ? "+" : ""}${fmtUsdCompact(v)}`;
}

/** Amount in its own currency. */
export function fmtMoney(v: number, currency: string): string {
  return currency.toUpperCase() === "USD" ? fmtUsd(v) : fmtIls(v);
}

export function fmtPct(v: number, digits = 1): string {
  return `${trim(v, digits)}%`;
}

function trim(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03-31" → "Mar 31, 2026"; "2026-03" → "Mar 2026". */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return s;
  const mon = MONTHS[Number(m[2]) - 1] ?? m[2];
  return m[3] ? `${mon} ${Number(m[3])}, ${m[1]}` : `${mon} ${m[1]}`;
}

/** "2026-03" → "Mar ’26" for chart axes. */
export function fmtMonthShort(s: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${MONTHS[Number(m[2]) - 1]} ’${m[1].slice(2)}`;
}

/** "3 hours ago" style relative time. */
export function fmtRelative(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return fmtDate(iso.slice(0, 10));
}

/** "Nov 27, 2026, 6:04 PM" in the viewer's time zone. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A report older than this is flagged as stale (the routine re-runs weekly). */
export const ADVISOR_STALE_DAYS = 7;
export const isAdvisorStale = (iso: string, now = Date.now()) => now - new Date(iso).getTime() > ADVISOR_STALE_DAYS * 86_400_000;

// ── Account types ──────────────────────────────────────────────────

export const TYPE_LABELS: Record<string, { en: string; he?: string }> = {
  pension: { en: "Pension fund", he: "קרן פנסיה" },
  managers_insurance: { en: "Manager’s insurance", he: "ביטוח מנהלים" },
  hishtalmut: { en: "Study fund", he: "קרן השתלמות" },
  gemel: { en: "Provident fund", he: "קופת גמל" },
  gemel_investment: { en: "Investment provident fund", he: "קופת גמל להשקעה" },
  savings_policy: { en: "Savings policy", he: "פוליסת חיסכון" },
  savings_child: { en: "Child savings", he: "חיסכון לכל ילד" },
  "401k": { en: "401(k)" },
  ira: { en: "IRA" },
  brokerage: { en: "Brokerage" },
  rsu: { en: "RSUs (equity comp)" },
  cash: { en: "Cash" },
  other: { en: "Other" },
};

export function typeLabel(type: string): { en: string; he?: string } {
  return TYPE_LABELS[type] ?? { en: type.replace(/_/g, " ") };
}

// ── Coverage risks ─────────────────────────────────────────────────

export const RISK_LABELS: Record<string, { en: string; he?: string }> = {
  death: { en: "Life", he: "ביטוח חיים" },
  accidental_death: { en: "Accidental death" },
  disability: { en: "Disability / work capacity", he: "אובדן כושר עבודה" },
  short_term_disability: { en: "Short-term disability" },
  health: { en: "Health", he: "ביטוח בריאות" },
  dental: { en: "Dental" },
  vision: { en: "Vision" },
  critical_illness: { en: "Critical illness", he: "מחלות קשות" },
  long_term_care: { en: "Long-term care", he: "סיעודי" },
  hsa: { en: "HSA" },
  fsa: { en: "FSA" },
  espp: { en: "ESPP" },
  "401k_match": { en: "401(k) match" },
  other: { en: "Other" },
};

export function riskLabel(risk: string): { en: string; he?: string } {
  return RISK_LABELS[risk] ?? { en: risk.replace(/_/g, " ") };
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
