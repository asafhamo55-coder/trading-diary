// Server-side data fetching for Hamo Properties.
import { prisma } from "./db";
import type {
  PropertyDTO,
  PropertyTransactionDTO,
  PropertyTxType,
  TenantDTO,
} from "./property";
import { signedAmount } from "./property";
import { ensurePropertySchema } from "./property-schema";

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
  purchaseDate: Date | null;
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
    purchaseDate: p.purchaseDate ? toDateStr(p.purchaseDate) : null,
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
  const net = Array.from({ length: 12 }, () => 0);
  try {
    const accountId = await firstAccountId();
    if (!accountId) return net;
    const txs = await prisma.propertyTransaction.findMany({
      where: { year, property: { accountId } },
      select: { month: true, type: true, amount: true },
    });
    for (const t of txs) {
      net[t.month - 1] += signedAmount({ type: t.type, amount: t.amount });
    }
    return net;
  } catch {
    return net;
  }
}

/** Income (revenue) and expenses per calendar month for the year, across all properties. */
export async function getPropertyMonthlyRevExp(
  year: number
): Promise<{ revenue: number; expense: number }[]> {
  const rows = Array.from({ length: 12 }, () => ({ revenue: 0, expense: 0 }));
  try {
    const accountId = await firstAccountId();
    if (!accountId) return rows;
    const txs = await prisma.propertyTransaction.findMany({
      where: { year, property: { accountId } },
      select: { month: true, type: true, amount: true },
    });
    for (const t of txs) {
      const idx = t.month - 1;
      if (idx < 0 || idx > 11) continue;
      if (t.type === "INCOME") rows[idx].revenue += t.amount;
      else rows[idx].expense += t.amount;
    }
    return rows;
  } catch {
    return rows;
  }
}

export async function getPropertyYearNet(year: number): Promise<number> {
  const monthly = await getPropertyMonthlyNet(year);
  return monthly.reduce((sum, n) => sum + n, 0);
}

/** Distinct years that have property transactions, for the year picker. */
export async function getPropertyYears(): Promise<number[]> {
  try {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const rows = await prisma.propertyTransaction.findMany({
      where: { property: { accountId } },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });
    return rows.map((r) => r.year);
  } catch {
    return [];
  }
}
