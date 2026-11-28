// Server-side data fetching for Hamo Properties.
import { prisma } from "./db";
import type {
  PropertyDTO,
  PropertyTransactionDTO,
  PropertyTxType,
  TenantDTO,
} from "./property";
import { signedAmount, propertyTitle } from "./property";
import { ensurePropertySchema } from "./property-schema";
import {
  EMPTY_RECORD,
  RECORD_DATE_FIELDS,
  parseProfile,
  summarizeRecord,
  type PropertyRecord,
  type PropertyRecordSummary,
  type RecordList,
} from "./property-profile";
import { todayInEastern } from "./utils";

// Run a Prisma read; if it fails because the schema isn't present yet (fresh
// deploy, pre-migration), ensure the schema idempotently and retry once.
async function withSchemaHeal<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    try {
      await ensurePropertySchema();
      return await run();
    } catch {
      return fallback;
    }
  }
}

async function firstAccountId(): Promise<string | null> {
  try {
    const account = await prisma.account.findFirst();
    return account?.id ?? null;
  } catch {
    return null;
  }
}

function toDateStr(d: Date | string): string {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

function serializeTx(t: {
  id: string;
  propertyId: string;
  date: Date;
  year: number;
  month: number;
  type: PropertyTxType;
  category: string;
  amount: number;
  description: string | null;
  taxOnly: boolean;
  source?: string | null;
}): PropertyTransactionDTO {
  return {
    id: t.id,
    propertyId: t.propertyId,
    date: toDateStr(t.date),
    year: t.year,
    month: t.month,
    type: t.type,
    category: t.category,
    amount: t.amount,
    description: t.description,
    taxOnly: t.taxOnly,
    source: t.source ?? null,
  };
}

function serializeProperty(p: {
  id: string;
  nickname: string;
  address: string;
  street: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchasePrice: number | null;
  downPayment: number | null;
  purchaseDate: Date | null;
  currentValue: number | null;
  valueAsOf: Date | null;
  mortgageBalance: number | null;
  mortgageAsOf: Date | null;
  usage: string;
  notes: string | null;
  archivedAt: Date | null;
}): PropertyDTO {
  return {
    id: p.id,
    nickname: p.nickname,
    address: p.address,
    street: p.street,
    unit: p.unit,
    city: p.city,
    state: p.state,
    zip: p.zip,
    purchasePrice: p.purchasePrice,
    downPayment: p.downPayment,
    purchaseDate: p.purchaseDate ? toDateStr(p.purchaseDate) : null,
    currentValue: p.currentValue,
    valueAsOf: p.valueAsOf ? toDateStr(p.valueAsOf) : null,
    mortgageBalance: p.mortgageBalance,
    mortgageAsOf: p.mortgageAsOf ? toDateStr(p.mortgageAsOf) : null,
    usage: p.usage,
    notes: p.notes,
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
  };
}

function serializeTenant(t: {
  id: string;
  propertyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  leaseStart: Date;
  leaseEnd: Date | null;
  monthlyRent: number | null;
  securityDeposit: number | null;
  notes: string | null;
}): TenantDTO {
  return {
    id: t.id,
    propertyId: t.propertyId,
    name: t.name,
    email: t.email,
    phone: t.phone,
    leaseStart: toDateStr(t.leaseStart),
    leaseEnd: t.leaseEnd ? toDateStr(t.leaseEnd) : null,
    monthlyRent: t.monthlyRent,
    securityDeposit: t.securityDeposit,
    notes: t.notes,
  };
}

export interface PropertyWithTx extends PropertyDTO {
  transactions: PropertyTransactionDTO[];
  tenants: TenantDTO[];
}

// Fetch tenants for a set of properties. Isolated + guarded so a missing
// Tenant table (e.g. before its migration is run) can never hide properties.
async function tenantsByProperty(
  propertyIds: string[]
): Promise<Map<string, TenantDTO[]>> {
  const byProp = new Map<string, TenantDTO[]>();
  if (propertyIds.length === 0) return byProp;
  try {
    const tenants = await prisma.tenant.findMany({
      where: { propertyId: { in: propertyIds } },
      orderBy: { leaseStart: "desc" },
    });
    for (const t of tenants) {
      const arr = byProp.get(t.propertyId) ?? [];
      arr.push(serializeTenant(t));
      byProp.set(t.propertyId, arr);
    }
  } catch {
    // Tenant table not present yet — properties still load, just without tenants.
  }
  return byProp;
}

/** Lightweight list of active properties for attribution dropdowns. */
export async function getPropertyOptions(): Promise<{ id: string; title: string }[]> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const rows = await prisma.property.findMany({
      where: { accountId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((p) => ({ id: p.id, title: propertyTitle(p) }));
  }, []);
}

export async function getProperties(): Promise<PropertyWithTx[]> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const properties = await prisma.property.findMany({
      where: { accountId },
      include: { transactions: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "asc" },
    });
    const tenants = await tenantsByProperty(properties.map((p) => p.id));
    return properties.map((p) => ({
      ...serializeProperty(p),
      transactions: p.transactions.map(serializeTx),
      tenants: tenants.get(p.id) ?? [],
    }));
  }, []);
}

export async function getPropertyById(id: string): Promise<PropertyWithTx | null> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return null;
    const p = await prisma.property.findFirst({
      where: { id, accountId },
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    if (!p) return null;
    const tenants = await tenantsByProperty([p.id]);
    return {
      ...serializeProperty(p),
      transactions: p.transactions.map(serializeTx),
      tenants: tenants.get(p.id) ?? [],
    };
  }, null);
}

/** Net (income − expenses) per calendar month for the given year, across all properties. */
export async function getPropertyMonthlyNet(year: number): Promise<number[]> {
  const zeros = Array.from({ length: 12 }, () => 0);
  // Heals the schema on the first call after a deploy that adds a column,
  // rather than silently reporting a flat zero year.
  return withSchemaHeal(async () => {
    const net = Array.from({ length: 12 }, () => 0);
    const accountId = await firstAccountId();
    if (!accountId) return net;
    const txs = await prisma.propertyTransaction.findMany({
      // Exclude archived properties so the hub total matches the /properties
      // page, which sums active properties only.
      // taxOnly entries belong on the tax report only, never in performance.
      where: { year, taxOnly: false, property: { accountId, archivedAt: null } },
      select: { month: true, type: true, amount: true },
    });
    for (const t of txs) {
      net[t.month - 1] += signedAmount({ type: t.type, amount: t.amount });
    }
    return net;
  }, zeros);
}

/** Income (revenue) and expenses per calendar month for the year, across all properties. */
export async function getPropertyMonthlyRevExp(
  year: number
): Promise<{ revenue: number; expense: number }[]> {
  const zeros = Array.from({ length: 12 }, () => ({ revenue: 0, expense: 0 }));
  return withSchemaHeal(async () => {
    const rows = Array.from({ length: 12 }, () => ({ revenue: 0, expense: 0 }));
    const accountId = await firstAccountId();
    if (!accountId) return rows;
    const txs = await prisma.propertyTransaction.findMany({
      // Exclude archived properties so the hub total matches the /properties
      // page, which sums active properties only.
      // taxOnly entries belong on the tax report only, never in performance.
      where: { year, taxOnly: false, property: { accountId, archivedAt: null } },
      select: { month: true, type: true, amount: true },
    });
    for (const t of txs) {
      const idx = t.month - 1;
      if (idx < 0 || idx > 11) continue;
      if (t.type === "INCOME") rows[idx].revenue += t.amount;
      else rows[idx].expense += t.amount;
    }
    return rows;
  }, zeros);
}

export async function getPropertyYearNet(year: number): Promise<number> {
  const monthly = await getPropertyMonthlyNet(year);
  return monthly.reduce((sum, n) => sum + n, 0);
}

/**
 * Distinct years that have property transactions, for the year picker.
 * Archived properties are excluded so the picker can't offer a year whose only
 * data belongs to them — every figure on the page is active-only, so such a
 * year would render an empty page.
 */
export async function getPropertyYears(): Promise<number[]> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const rows = await prisma.propertyTransaction.findMany({
      where: { property: { accountId, archivedAt: null } },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });
    return rows.map((r) => r.year);
  }, []);
}

/* ── The property record (loans, insurance, tax, …) ─────────────────── */

const RECORD_META = new Set(["propertyId", "createdAt", "updatedAt"]);

/** A list row from Prisma → its DTO: dates as YYYY-MM-DD, bookkeeping columns dropped. */
export function serializeRecordRow<T>(list: RecordList, row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (RECORD_META.has(k)) continue;
    out[k] = RECORD_DATE_FIELDS[list].includes(k) ? (v ? toDateStr(v as Date) : null) : v;
  }
  return out as T;
}

async function recordsFor(propertyIds: string[]): Promise<Map<string, PropertyRecord>> {
  const out = new Map<string, PropertyRecord>();
  if (propertyIds.length === 0) return out;
  const where = { propertyId: { in: propertyIds } };
  const [props, loans, improvements, maintenance, documents, utilities] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, profile: true } }),
    prisma.propertyLoan.findMany({ where, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    prisma.propertyImprovement.findMany({ where, orderBy: { date: "desc" } }),
    prisma.propertyMaintenance.findMany({ where, orderBy: { date: "desc" } }),
    prisma.propertyDocument.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.propertyUtility.findMany({ where, orderBy: { createdAt: "asc" } }),
  ]);
  for (const p of props) {
    out.set(p.id, { ...EMPTY_RECORD, profile: parseProfile(p.profile), loans: [], improvements: [], maintenance: [], documents: [], utilities: [] });
  }
  const add = (list: RecordList, rows: { propertyId: string }[]) => {
    for (const r of rows) {
      const rec = out.get(r.propertyId);
      if (rec) (rec[list] as unknown[]).push(serializeRecordRow(list, r as unknown as Record<string, unknown>));
    }
  };
  add("loans", loans);
  add("improvements", improvements);
  add("maintenance", maintenance);
  add("documents", documents);
  add("utilities", utilities);
  return out;
}

/**
 * One property's full record: profile sections (facts, HOA, insurance,
 * property tax, management, tax basis, systems) and the lists (loans,
 * improvements, maintenance, documents, utilities). Never throws: a missing
 * table heals the schema, and failing that an empty record comes back.
 */
export async function getPropertyRecord(id: string): Promise<PropertyRecord> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return EMPTY_RECORD;
    const owned = await prisma.property.findFirst({ where: { id, accountId }, select: { id: true } });
    if (!owned) return EMPTY_RECORD;
    return (await recordsFor([id])).get(id) ?? EMPTY_RECORD;
  }, EMPTY_RECORD);
}

/** Every property's record, keyed by property id (archived ones included). */
export async function getPropertyRecords(): Promise<Map<string, PropertyRecord>> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return new Map<string, PropertyRecord>();
    const props = await prisma.property.findMany({ where: { accountId }, select: { id: true } });
    return recordsFor(props.map((p) => p.id));
  }, new Map<string, PropertyRecord>());
}

export interface PropertyRecordListItem extends PropertyRecordSummary {
  id: string;
  title: string;
  usage: string;
  archived: boolean;
}

/**
 * List-level record summary for the advisor: per property, loan totals and
 * rates, insurance, property tax, management, HOA, depreciation basis and the
 * key dates. Active and archived properties alike (filter on `archived`).
 */
export async function getPropertyRecordSummaries(today: string = todayInEastern()): Promise<PropertyRecordListItem[]> {
  return withSchemaHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const props = await prisma.property.findMany({
      where: { accountId },
      select: { id: true, nickname: true, address: true, street: true, usage: true, archivedAt: true },
      orderBy: { createdAt: "asc" },
    });
    const records = await recordsFor(props.map((p) => p.id));
    return props.map((p) => ({
      id: p.id,
      title: propertyTitle(p),
      usage: p.usage,
      archived: p.archivedAt !== null,
      ...summarizeRecord(records.get(p.id) ?? EMPTY_RECORD, today),
    }));
  }, []);
}
