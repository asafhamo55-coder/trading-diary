// Derives the household dashboard's view model from the net-worth payload
// and the household profile. Pure — no React, no Prisma.

import type { NetWorthResponse, HouseholdProfileDTO } from "@/lib/savings-data";
import { TYPE_LABELS, capitalize, fmtDate } from "./format";

export type NetWorth = NetWorthResponse;
export type Profile = HouseholdProfileDTO;

// ── People ─────────────────────────────────────────────────────────

export interface Person {
  key: string;
  name: string;
  nameHe?: string | null;
  role: "adult" | "child" | "joint";
}

export function peopleDirectory(profile: Profile | null, nw: NetWorth | null): Map<string, Person> {
  const map = new Map<string, Person>();
  for (const m of profile?.members ?? []) {
    map.set(m.key, { key: m.key, name: m.name || capitalize(m.key), nameHe: m.nameHe, role: m.role });
  }
  const seen = [
    ...(nw?.savings.accounts.map((a) => a.owner) ?? []),
    ...(nw?.coverage.groups.map((g) => g.owner) ?? []),
  ];
  for (const k of seen) {
    if (map.has(k)) continue;
    map.set(k, { key: k, name: k === "joint" ? "Joint" : capitalize(k), role: k === "joint" ? "joint" : "adult" });
  }
  return map;
}

export function personName(people: Map<string, Person>, key: string): string {
  if (key === "household") return "Household";
  if (key === "joint") return "Joint";
  return people.get(key)?.name ?? capitalize(key);
}

// ── Asset groups (fixed categorical order — colour follows the group) ──

export interface AssetGroup {
  key: string;
  label: string;
  color: string; // CSS var
  valueUsd: number;
}

const IL_RETIREMENT = new Set(["pension", "managers_insurance", "gemel", "gemel_investment", "savings_policy"]);
const US_RETIREMENT = new Set(["401k", "ira"]);

export const GROUP_DEFS: { key: string; label: string; color: string }[] = [
  { key: "il_retirement", label: "IL pensions", color: "var(--chart-1)" },
  { key: "hishtalmut", label: "Study funds", color: "var(--chart-2)" },
  { key: "us_retirement", label: "US 401(k) / IRA", color: "var(--chart-3)" },
  { key: "rsu", label: "RSUs", color: "var(--chart-4)" },
  { key: "real_estate", label: "Real estate", color: "var(--chart-5)" },
  { key: "trade", label: "Trading", color: "var(--chart-6)" },
  { key: "liquid", label: "Brokerage & cash", color: "var(--chart-7)" },
  { key: "other", label: "Kids & other", color: "var(--muted-foreground)" },
];

export function groupOfType(type: string): string {
  if (IL_RETIREMENT.has(type)) return "il_retirement";
  if (type === "hishtalmut") return "hishtalmut";
  if (US_RETIREMENT.has(type)) return "us_retirement";
  if (type === "rsu") return "rsu";
  if (type === "brokerage" || type === "cash") return "liquid";
  return "other";
}

export function assetGroups(nw: NetWorth): AssetGroup[] {
  const sums: Record<string, number> = {};
  for (const [type, v] of Object.entries(nw.byType)) {
    const g = groupOfType(type);
    sums[g] = (sums[g] ?? 0) + v;
  }
  sums.real_estate = nw.byModule.propertiesEquityUsd;
  sums.trade = nw.trade ? nw.byModule.tradeUsd : 0;
  return GROUP_DEFS.map((d) => ({ ...d, valueUsd: sums[d.key] ?? 0 }));
}

// ── KPI figures ────────────────────────────────────────────────────

export interface Kpis {
  ilRetirementUsd: number;
  ilRetirementIls: number;
  ilRetirementCount: number;
  usRetirementUsd: number;
  usRetirementCount: number;
  rsuUsd: number;
  rsuCount: number;
  realEstateEquityUsd: number;
  realEstateValueUsd: number;
  mortgagesUsd: number;
  propertyCount: number;
  tradeUsd: number | null;
  annualFeesUsd: number;
  feeDrag10yUsd: number;
  accountsWithFees: number;
}

const IL_SAVINGS = new Set([...IL_RETIREMENT, "hishtalmut"]);

export function kpis(nw: NetWorth): Kpis {
  const accts = nw.savings.accounts;
  const il = accts.filter((a) => IL_SAVINGS.has(a.type));
  const us = accts.filter((a) => US_RETIREMENT.has(a.type));
  const rsu = accts.filter((a) => a.type === "rsu");
  // feeDrag10y is in the account's own currency.
  const feeDrag10yUsd = accts.reduce((s, a) => {
    if (!a.feeDrag10y) return s;
    const c = a.feeDrag10y.costVsBenchmark;
    return s + (a.currency.toUpperCase() === "USD" ? c : c / nw.fx.usdIls);
  }, 0);
  return {
    ilRetirementUsd: sum(il.map((a) => a.balanceUsd)),
    ilRetirementIls: sum(il.map((a) => a.balanceIls)),
    ilRetirementCount: il.length,
    usRetirementUsd: sum(us.map((a) => a.balanceUsd)),
    usRetirementCount: us.length,
    rsuUsd: sum(rsu.map((a) => a.balanceUsd)),
    rsuCount: rsu.length,
    realEstateEquityUsd: nw.byModule.propertiesEquityUsd,
    realEstateValueUsd: nw.byModule.propertiesValueUsd,
    mortgagesUsd: nw.byModule.mortgagesUsd,
    propertyCount: nw.properties.length,
    tradeUsd: nw.trade ? nw.byModule.tradeUsd : null,
    annualFeesUsd: nw.savings.annualFeesUsd,
    feeDrag10yUsd: Math.max(0, feeDrag10yUsd),
    accountsWithFees: accts.filter((a) => a.feeDepositPct != null || a.feeAccumulationPct != null).length,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ── By person / by country ─────────────────────────────────────────

export interface BarRow {
  key: string;
  label: string;
  labelHe?: string | null;
  valueUsd: number;
  note?: string;
}

/**
 * Net worth by person. Savings are owned per person; real estate and the
 * trading account are household-level, so they're counted under Joint.
 * Children are rolled up into one "Kids" bar.
 */
export function byPerson(nw: NetWorth, people: Map<string, Person>): BarRow[] {
  const rows = new Map<string, BarRow>();
  const add = (key: string, label: string, v: number, labelHe?: string | null) => {
    const r = rows.get(key) ?? { key, label, labelHe, valueUsd: 0 };
    r.valueUsd += v;
    rows.set(key, r);
  };
  for (const [owner, v] of Object.entries(nw.byOwner)) {
    const p = people.get(owner);
    if (owner === "joint") add("joint", "Joint", v);
    else if (p?.role === "child") add("kids", "Kids", v);
    else add(owner, personName(people, owner), v, p?.nameHe);
  }
  const household = nw.byModule.propertiesEquityUsd + (nw.trade ? nw.byModule.tradeUsd : 0);
  if (household !== 0) add("joint", "Joint", household);
  const joint = rows.get("joint");
  if (joint && household !== 0) joint.note = "incl. real estate & trading";
  const kids = rows.get("kids");
  if (kids) {
    const n = [...people.values()].filter((p) => p.role === "child").length;
    kids.note = n ? `${n} child${n === 1 ? "" : "ren"}` : undefined;
  }
  const order = (r: BarRow) => (r.key === "joint" ? 2 : r.key === "kids" ? 3 : people.get(r.key)?.role === "adult" ? 0 : 1);
  return [...rows.values()].sort((a, b) => order(a) - order(b) || b.valueUsd - a.valueUsd);
}

/** Savings by IL/US; US rentals and the (US) trading account count as US. */
export function byCountry(nw: NetWorth): BarRow[] {
  const il = nw.byCountry.IL ?? 0;
  const usSavings = nw.byCountry.US ?? 0;
  const usOther = nw.byModule.propertiesEquityUsd + (nw.trade ? nw.byModule.tradeUsd : 0);
  const rows: BarRow[] = [
    { key: "IL", label: "Israel", labelHe: "ישראל", valueUsd: il },
    { key: "US", label: "United States", valueUsd: usSavings + usOther, note: usOther ? "incl. rentals & trading" : undefined },
  ];
  for (const [k, v] of Object.entries(nw.byCountry)) {
    if (k !== "IL" && k !== "US") rows.push({ key: k, label: k, valueUsd: v });
  }
  return rows;
}

// ── Header figures ─────────────────────────────────────────────────

export interface HeaderInfo {
  oldestBalanceAsOf: string | null;
  newestBalanceAsOf: string | null;
  savingsChange: { fromMonth: string; deltaUsd: number; pct: number | null } | null;
}

export function headerInfo(nw: NetWorth): HeaderInfo {
  const dates = nw.savings.accounts.map((a) => a.balanceAsOf).filter((d): d is string => !!d).sort();
  const h = nw.history;
  let savingsChange: HeaderInfo["savingsChange"] = null;
  if (h.length >= 2) {
    const first = h[0];
    const last = h[h.length - 1];
    const delta = last.savingsUsd - first.savingsUsd;
    savingsChange = { fromMonth: first.month, deltaUsd: delta, pct: first.savingsUsd > 0 ? (delta / first.savingsUsd) * 100 : null };
  }
  return {
    oldestBalanceAsOf: dates[0] ?? null,
    newestBalanceAsOf: dates[dates.length - 1] ?? null,
    savingsChange,
  };
}

// ── Data gaps ──────────────────────────────────────────────────────

export interface GapItem {
  text: string;
  href: string;
  where: string;
  kind: "property" | "savings" | "profile" | "trade" | "coverage";
}

/** Backend gap strings use raw keys ("managers_insurance (einat)"); make them readable. */
export function humanizeGap(text: string, people: Map<string, Person>): string {
  let out = text;
  for (const [type, l] of Object.entries(TYPE_LABELS)) {
    if (!/[_\d]/.test(type) && type !== "rsu") continue;
    out = out.replace(new RegExp(`\\b${type}\\b`, "g"), type === "rsu" ? "RSUs" : l.en.toLowerCase());
  }
  for (const p of people.values()) {
    if (p.key.length < 2 || p.key === p.name) continue;
    out = out.replace(new RegExp(`\\(${p.key}\\)`, "g"), `(${p.name})`).replace(new RegExp(`\\bfor ${p.key}\\.`, "g"), `for ${p.name}.`);
  }
  return out;
}

export function dataGaps(nw: NetWorth | null, profile: Profile | null, people: Map<string, Person> = new Map()): GapItem[] {
  const out: GapItem[] = [];
  for (const raw of nw?.dataGaps ?? []) {
    const g = humanizeGap(raw, people);
    const lower = g.toLowerCase();
    if (lower.startsWith("trade account")) out.push({ text: g, href: "/trade/dashboard", where: "Trade", kind: "trade" });
    else if (lower.includes("mortgage") || lower.startsWith("no value") || lower.startsWith("no current value"))
      out.push({ text: g, href: "/properties", where: "Properties", kind: "property" });
    else out.push({ text: g, href: "/savings", where: "Savings", kind: "savings" });
  }
  if (profile) {
    const goals = profile.goals;
    const hasGoals =
      !!profile.goalsText ||
      !!(goals && (goals.retirementTargetMonthlyIncome || goals.plannedPurchases?.length || goals.relocation?.plan || goals.childrenEducation || goals.other));
    if (!hasGoals) {
      out.push({ text: "Household goals not set (retirement income target, planned purchases, kids’ education).", href: "/savings", where: "Profile", kind: "profile" });
    }
    if (!profile.riskTolerance) {
      out.push({ text: "Risk tolerance not set — the advisor assumes a balanced profile.", href: "/savings", where: "Profile", kind: "profile" });
    }
    for (const m of profile.members) {
      if (!m.birthDate) {
        out.push({ text: `Birth date missing for ${m.name || capitalize(m.key)} (needed for retirement timing).`, href: "/savings", where: "Profile", kind: "profile" });
      }
    }
    if (profile.members.length === 0) {
      out.push({ text: "No household members recorded yet.", href: "/savings", where: "Profile", kind: "profile" });
    }
  }
  if (nw && nw.coverage.groups.length === 0 && nw.savings.accounts.length > 0) {
    out.push({ text: "No insurance or benefits recorded — coverage can’t be checked for gaps or duplicates.", href: "/savings", where: "Benefits", kind: "coverage" });
  }
  return out;
}

export function asOfLabel(nw: NetWorth): string {
  return fmtDate(nw.asOf);
}
