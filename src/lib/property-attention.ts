// Hamo Properties — the "Needs attention" list on the properties page.
// Pure: takes the list rows plus today's date (YYYY-MM-DD) and returns what
// to look at, most urgent first. Archived properties never appear; the
// primary residence only appears for missing data (it has no tenants or
// rental returns to watch).

import type { PropertyRow } from "./property-portfolio";
import type { KeyDate, KeyDateKind } from "./property-profile";

export type AttentionKind =
  | "vacant"
  | "lease-expired"
  | "lease-ending"
  | "negative-net"
  | "missing-value"
  | "stale-value"
  | "missing-mortgage"
  | "missing-down-payment"
  | KeyDateKind;

export type AttentionSeverity = "danger" | "warning" | "info";

export interface AttentionItem {
  /** Stable React key: `${kind}:${propertyId}`. */
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  propertyId: string;
  propertyTitle: string;
  /** Short headline, e.g. "Vacant 45 days". */
  title: string;
  /** One line of context. */
  detail: string;
}

export const LEASE_ENDING_DAYS = 60;
export const STALE_VALUE_MONTHS = 6;

const SEVERITY_RANK: Record<AttentionSeverity, number> = { danger: 0, warning: 1, info: 2 };
const KIND_RANK: Record<AttentionKind, number> = {
  "lease-expired": 0,
  vacant: 1,
  "negative-net": 2,
  "lease-ending": 3,
  "stale-value": 4,
  "missing-value": 5,
  "missing-mortgage": 6,
  "missing-down-payment": 7,
  "insurance-renewal": 3,
  "tax-due": 3,
  "arm-reset": 3,
  "appeal-deadline": 3,
  "pmi-removal": 4,
  "warranty-end": 4,
  "hoa-dues": 4,
};

const DAY_MS = 24 * 3600 * 1000;

function toUtc(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

/** Whole days from `a` to `b` (both YYYY-MM-DD); positive when b is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** `date` shifted back `months` calendar months (day clamped to the month's end). */
function monthsBefore(date: string, months: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 - months;
  const d = Number(date.slice(8, 10));
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mar 3, 2027" from YYYY-MM-DD, without touching the local time zone. */
export function formatShortDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function usd(n: number): string {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-US");
  return `${n < 0 ? "−" : ""}$${abs}`;
}

/**
 * Everything on the list that needs a look, most urgent first:
 *  - vacant units (and how long), including leases that ended with no renewal;
 *  - leases ending within `LEASE_ENDING_DAYS`;
 *  - rentals with a negative net for the year;
 *  - a missing or stale (> `STALE_VALUE_MONTHS`) value, a missing mortgage
 *    balance, and a building with no down payment on file (once per building).
 */
export function attentionItems(
  rows: PropertyRow[],
  today: string,
  /** Dated items from each property's record (see `keyDatesOf`), by property id. */
  keyDates?: ReadonlyMap<string, KeyDate[]>
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const staleBefore = monthsBefore(today, STALE_VALUE_MONTHS);
  const downPaymentFlagged = new Set<string>();

  const push = (r: PropertyRow, kind: AttentionKind, severity: AttentionSeverity, title: string, detail: string, key = "") =>
    items.push({ id: `${kind}:${r.id}${key}`, kind, severity, propertyId: r.id, propertyTitle: r.title, title, detail });

  for (const r of rows) {
    if (r.archived) continue;
    const rental = r.usage !== "residence";

    if (rental) {
      if (!r.currentTenantName) {
        if (r.lastLeaseEnd) {
          const days = Math.max(0, daysBetween(r.lastLeaseEnd, today));
          push(
            r,
            "lease-expired",
            "danger",
            days > 0 ? `Vacant ${plural(days, "day")}` : "Lease ended today",
            `Lease ended ${formatShortDate(r.lastLeaseEnd)} with no renewal on file`
          );
        } else {
          push(
            r,
            "vacant",
            r.hasTenants ? "danger" : "warning",
            "Vacant",
            r.purchaseDate && r.purchaseDate <= today
              ? `No lease on file since purchase (${plural(Math.max(0, daysBetween(r.purchaseDate, today)), "day")})`
              : "No lease on file. Add the current tenant if it is rented"
          );
        }
      } else if (r.leaseEnd) {
        const days = daysBetween(today, r.leaseEnd);
        if (days >= 0 && days <= LEASE_ENDING_DAYS) {
          push(
            r,
            "lease-ending",
            days <= 30 ? "danger" : "warning",
            days === 0 ? "Lease ends today" : `Lease ends in ${plural(days, "day")}`,
            `${r.currentTenantName}'s lease ends ${formatShortDate(r.leaseEnd)}`
          );
        }
      }

      if (r.txCount > 0 && r.net < 0) {
        push(r, "negative-net", "danger", "Losing money this year", `Net ${usd(r.net)} year to date`);
      }
    }

    if (r.currentValue == null) {
      push(r, "missing-value", "info", "No current value", "Add an estimate to track equity and appreciation");
    } else if (!r.valueAsOf || r.valueAsOf < staleBefore) {
      push(
        r,
        "stale-value",
        "warning",
        "Value is out of date",
        r.valueAsOf
          ? `Last updated ${formatShortDate(r.valueAsOf)} (over ${STALE_VALUE_MONTHS} months ago)`
          : "The value has no as-of date"
      );
    }

    if (r.mortgageBalance == null) {
      push(r, "missing-mortgage", "info", "No mortgage balance", "Add it (or $0 if paid off) so equity is accurate");
    }

    // Down payment is a building figure: flag a building once, not per unit.
    if (rental && r.needsDownPayment && !downPaymentFlagged.has(r.buildingKey)) {
      downPaymentFlagged.add(r.buildingKey);
      push(
        r,
        "missing-down-payment",
        "info",
        "No down payment",
        r.unitCount > 1
          ? `None recorded on any of the ${r.unitCount} units, so cash-on-cash can't be computed`
          : "Cash-on-cash can't be computed without it"
      );
    }

    for (const kd of keyDates?.get(r.id) ?? []) {
      const item = keyDateItem(kd, today);
      if (item) push(r, kd.kind, item.severity, item.title, item.detail, `:${kd.date}:${kd.label}`);
    }
  }

  return items.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      a.propertyTitle.localeCompare(b.propertyTitle)
  );
}

const inDays = (days: number) => (days === 0 ? "today" : `in ${plural(days, "day")}`);

/**
 * When a dated record item becomes worth a look. Most use the 60-day
 * lookahead (urgent inside 14 days); PMI removal stays up once eligible; an
 * insurance renewal date that has passed asks for the new policy; HOA dues
 * only show the week they're due.
 */
export function keyDateItem(
  kd: KeyDate,
  today: string
): { severity: AttentionSeverity; title: string; detail: string } | null {
  const days = daysBetween(today, kd.date);
  const when = formatShortDate(kd.date);
  const soon = days >= 0 && days <= LEASE_ENDING_DAYS;
  const sev: AttentionSeverity = days <= 14 ? "danger" : "warning";
  switch (kd.kind) {
    case "insurance-renewal":
      if (soon) return { severity: sev, title: `Insurance renews ${inDays(days)}`, detail: `${kd.label} policy renews ${when}` };
      if (days < 0 && days >= -365)
        return { severity: "warning", title: "Insurance renewal date passed", detail: `${kd.label} renewed ${when}. Update the policy details` };
      return null;
    case "tax-due":
      return soon ? { severity: sev, title: `Property tax due ${inDays(days)}`, detail: `${kd.label} installment due ${when}` } : null;
    case "appeal-deadline":
      return soon ? { severity: sev, title: `Appeal deadline ${inDays(days)}`, detail: `${kd.label} deadline ${when}` } : null;
    case "arm-reset":
      return soon ? { severity: sev, title: `Rate resets ${inDays(days)}`, detail: `${kd.label} adjustable rate resets ${when}` } : null;
    case "pmi-removal":
      return days <= LEASE_ENDING_DAYS
        ? {
            severity: "info",
            title: days <= 0 ? "PMI can be removed" : `PMI removable ${inDays(days)}`,
            detail: `${kd.label}: ask the servicer to drop PMI (eligible ${when})`,
          }
        : null;
    case "warranty-end":
      return soon ? { severity: "info", title: `Warranty ends ${inDays(days)}`, detail: `${kd.label} warranty ends ${when}` } : null;
    case "hoa-dues":
      return days >= 0 && days <= 7 ? { severity: "info", title: `HOA dues ${inDays(days)}`, detail: `${kd.label} due ${when}` } : null;
  }
}
