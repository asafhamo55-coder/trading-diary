// Server-side data access for Hamo Home.
import { prisma } from "./db";
import { ensureHomeSchema } from "./home-schema";
import { cleanDescription } from "./home-import";
import {
  DEFAULT_CATEGORIES,
  type HomeAccountDTO,
  type HomeCategoryDTO,
  type HomeTransactionDTO,
  type HomeAccountType,
  type HomeCategoryKind,
  type HomeInsights,
} from "./home";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PROPERTY_COLOR = "#FFB547";
const UNCATEGORIZED_COLOR = "#64748B";
const OTHER_COLOR = "#475569";

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
    merchantKey: cleanDescription(t.rawDescription).toLowerCase(),
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

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Full analytics bundle for the Home insights dashboard. */
export async function getHomeInsights(year: number): Promise<HomeInsights> {
  const empty: HomeInsights = {
    monthly: MONTH_NAMES.map((name) => ({ name, income: 0, spend: 0, net: 0 })),
    totals: { income: 0, spend: 0, net: 0, savingsRate: 0, avgMonthlySpend: 0, activeMonths: 0 },
    categories: [],
    trend: { months: MONTH_NAMES, series: [] },
    recurring: [],
    topMerchants: [],
    largest: [],
    hasData: false,
  };
  return withHomeHeal(async () => {
    const accountId = await firstAccountId();
    if (!accountId) return empty;

    const [txs, categories, properties] = await Promise.all([
      prisma.homeTransaction.findMany({
        where: { accountId, year, isExcluded: false },
        select: {
          date: true, month: true, amount: true, description: true,
          rawDescription: true, categoryId: true, propertyId: true,
        },
      }),
      prisma.homeCategory.findMany({
        where: { accountId },
        select: { id: true, name: true, parentId: true, color: true },
      }),
      prisma.property.findMany({ where: { accountId }, select: { id: true, nickname: true, street: true, address: true } }),
    ]);

    if (txs.length === 0) return empty;

    // categoryId → top-level bucket {name, color}
    const catById = new Map(categories.map((c) => [c.id, c]));
    function bucketFor(categoryId: string | null, propertyId: string | null): { name: string; color: string } {
      if (propertyId) {
        const p = properties.find((x) => x.id === propertyId);
        const title = (p?.street || p?.nickname || p?.address || "Property").trim();
        return { name: title, color: PROPERTY_COLOR };
      }
      if (categoryId) {
        const c = catById.get(categoryId);
        if (c) {
          const top = c.parentId ? catById.get(c.parentId) ?? c : c;
          return { name: top.name, color: top.color ?? UNCATEGORIZED_COLOR };
        }
      }
      return { name: "Uncategorized", color: UNCATEGORIZED_COLOR };
    }

    const monthly = MONTH_NAMES.map((name) => ({ name, income: 0, spend: 0, net: 0 }));
    const buckets = new Map<string, { color: string; total: number; monthly: number[] }>();
    const merchantAgg = new Map<
      string,
      { display: string; total: number; count: number; months: Set<number>; amounts: number[]; category: string | null }
    >();
    const largest: { date: string; description: string; amount: number }[] = [];

    for (const t of txs) {
      const mi = t.month - 1;
      if (mi < 0 || mi > 11) continue;
      if (t.amount > 0) {
        monthly[mi].income += t.amount;
        continue;
      }
      const spend = -t.amount;
      monthly[mi].spend += spend;

      const b = bucketFor(t.categoryId, t.propertyId);
      const existing = buckets.get(b.name) ?? { color: b.color, total: 0, monthly: Array(12).fill(0) };
      existing.total += spend;
      existing.monthly[mi] += spend;
      buckets.set(b.name, existing);

      const key = cleanDescription(t.rawDescription).toLowerCase();
      const m = merchantAgg.get(key) ?? {
        display: cleanDescription(t.rawDescription) || t.description,
        total: 0, count: 0, months: new Set<number>(), amounts: [], category: b.name,
      };
      m.total += spend;
      m.count += 1;
      m.months.add(t.month);
      m.amounts.push(spend);
      merchantAgg.set(key, m);

      largest.push({ date: toDateStr(t.date), description: cleanDescription(t.rawDescription) || t.description, amount: spend });
    }

    for (const mo of monthly) mo.net = mo.income - mo.spend;
    const income = monthly.reduce((s, m) => s + m.income, 0);
    const spend = monthly.reduce((s, m) => s + m.spend, 0);
    const net = income - spend;
    const activeMonths = monthly.filter((m) => m.spend > 0 || m.income > 0).length;

    const categories2 = Array.from(buckets.entries())
      .map(([name, v]) => ({ name, color: v.color, total: v.total, share: spend > 0 ? v.total / spend : 0 }))
      .sort((a, b) => b.total - a.total);

    // Monthly trend: top 6 buckets + "Other".
    const top = categories2.slice(0, 6);
    const topNames = new Set(top.map((c) => c.name));
    const otherMonthly = Array(12).fill(0);
    for (const [name, v] of buckets) {
      if (!topNames.has(name)) v.monthly.forEach((x, i) => (otherMonthly[i] += x));
    }
    const series = top.map((c) => ({
      name: c.name,
      color: c.color,
      data: buckets.get(c.name)!.monthly,
    }));
    if (otherMonthly.some((x) => x > 0)) series.push({ name: "Other", color: OTHER_COLOR, data: otherMonthly });

    // Recurring: merchants present in ≥3 distinct months.
    const recurring = Array.from(merchantAgg.values())
      .filter((m) => m.months.size >= 3)
      .map((m) => ({
        merchant: m.display,
        monthlyAmount: median(m.amounts),
        months: m.months.size,
        count: m.count,
        total: m.total,
        category: m.category,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    const topMerchants = Array.from(merchantAgg.values())
      .map((m) => ({ merchant: m.display, total: m.total, count: m.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    largest.sort((a, b) => b.amount - a.amount);

    return {
      monthly,
      totals: {
        income, spend, net,
        savingsRate: income > 0 ? net / income : 0,
        avgMonthlySpend: activeMonths > 0 ? spend / activeMonths : 0,
        activeMonths,
      },
      categories: categories2,
      trend: { months: MONTH_NAMES, series },
      recurring,
      topMerchants,
      largest: largest.slice(0, 8),
      hasData: true,
    };
  }, empty);
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
