// Server-side data access for Hamo Home.
import { prisma } from "./db";
import { ensureHomeSchema } from "./home-schema";
import {
  DEFAULT_CATEGORIES,
  type HomeAccountDTO,
  type HomeCategoryDTO,
  type HomeTransactionDTO,
  type HomeAccountType,
  type HomeCategoryKind,
} from "./home";

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

// Run a read; on failure (schema missing) ensure schema + seed, then retry once.
async function withHomeHeal<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    try {
      await ensureHomeSchema();
      const accountId = await firstAccountId();
      if (accountId) await seedDefaultCategories(accountId);
      return await run();
    } catch {
      return fallback;
    }
  }
}

/** Seed the default two-level taxonomy for an account, once (no-op if present). */
export async function seedDefaultCategories(accountId: string): Promise<void> {
  const existing = await prisma.homeCategory.count({ where: { accountId } });
  if (existing > 0) return;
  let sort = 0;
  for (const parent of DEFAULT_CATEGORIES) {
    const p = await prisma.homeCategory.create({
      data: {
        accountId,
        name: parent.name,
        kind: parent.kind as HomeCategoryKind,
        color: parent.color,
        sortOrder: sort++,
        isSystem: true,
      },
    });
    let childSort = 0;
    for (const child of parent.children) {
      await prisma.homeCategory.create({
        data: {
          accountId,
          name: child,
          parentId: p.id,
          kind: parent.kind as HomeCategoryKind,
          color: parent.color,
          sortOrder: childSort++,
          isSystem: true,
        },
      });
    }
  }
}

function serializeAccount(a: {
  id: string;
  name: string;
  type: HomeAccountType;
  last4: string | null;
  archivedAt: Date | null;
}): HomeAccountDTO {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    last4: a.last4,
    archivedAt: a.archivedAt ? a.archivedAt.toISOString() : null,
  };
}

function serializeCategory(c: {
  id: string;
  name: string;
  parentId: string | null;
  kind: HomeCategoryKind;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
}): HomeCategoryDTO {
  return {
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    kind: c.kind,
    color: c.color,
    sortOrder: c.sortOrder,
    isSystem: c.isSystem,
  };
}

function serializeTx(t: {
  id: string;
  homeAccountId: string;
  date: Date;
  year: number;
  month: number;
  amount: number;
  description: string;
  rawDescription: string;
  categoryId: string | null;
  propertyId: string | null;
  notes: string | null;
  isExcluded: boolean;
  excludeReason: string | null;
  needsReview: boolean;
  isManual: boolean;
}): HomeTransactionDTO {
  return {
    id: t.id,
    homeAccountId: t.homeAccountId,
    date: toDateStr(t.date),
    year: t.year,
    month: t.month,
    amount: t.amount,
    description: t.description,
    rawDescription: t.rawDescription,
    categoryId: t.categoryId,
    propertyId: t.propertyId,
    notes: t.notes,
    isExcluded: t.isExcluded,
    excludeReason: t.excludeReason,
    needsReview: t.needsReview,
    isManual: t.isManual,
  };
}

export async function getHomeAccounts(): Promise<HomeAccountDTO[]> {
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const rows = await prisma.homeAccount.findMany({
      where: { accountId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeAccount);
  }, []);
}

export async function getHomeCategories(): Promise<HomeCategoryDTO[]> {
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const rows = await prisma.homeCategory.findMany({
      where: { accountId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(serializeCategory);
  }, []);
}

export interface HomeTxFilter {
  year?: number;
  month?: number;
  homeAccountId?: string;
  needsReview?: boolean;
}

export async function getHomeTransactions(
  filter: HomeTxFilter = {}
): Promise<HomeTransactionDTO[]> {
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const where: Record<string, unknown> = { accountId };
    if (filter.year !== undefined) where.year = filter.year;
    if (filter.month !== undefined) where.month = filter.month;
    if (filter.homeAccountId) where.homeAccountId = filter.homeAccountId;
    if (filter.needsReview !== undefined) where.needsReview = filter.needsReview;
    const rows = await prisma.homeTransaction.findMany({
      where,
      orderBy: { date: "desc" },
    });
    return rows.map(serializeTx);
  }, []);
}

/** Distinct years that have transactions, for the year picker. */
export async function getHomeYears(): Promise<number[]> {
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return [];
    const rows = await prisma.homeTransaction.findMany({
      where: { accountId },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });
    return rows.map((r) => r.year);
  }, []);
}

/**
 * Income (money in) and expense (money out) per calendar month for the year,
 * excluding rows marked as excluded (transfers / card payments). Feeds the hub.
 */
export async function getHomeMonthlyRevExp(
  year: number
): Promise<{ revenue: number; expense: number }[]> {
  const rows = Array.from({ length: 12 }, () => ({ revenue: 0, expense: 0 }));
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return rows;
    const txs = await prisma.homeTransaction.findMany({
      where: { accountId, year, isExcluded: false },
      select: { month: true, amount: true },
    });
    for (const t of txs) {
      const idx = t.month - 1;
      if (idx < 0 || idx > 11) continue;
      if (t.amount > 0) rows[idx].revenue += t.amount;
      else rows[idx].expense += -t.amount;
    }
    return rows;
  }, rows);
}

export async function getReviewCount(): Promise<number> {
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return 0;
    return prisma.homeTransaction.count({
      where: { accountId, needsReview: true },
    });
  }, 0);
}
