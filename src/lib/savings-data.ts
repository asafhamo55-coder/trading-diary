// Server-side data access for Hamo Savings / Net Worth (Prisma). Pure logic
// lives in savings.ts / savings-import.ts; this file only reads and writes.
import { prisma } from "./db";
import { Prisma } from "@/generated/prisma/client";
import { getAccount } from "./api-helpers";
import { ensureSavingsSchema } from "./savings-schema";
import { getHomeInsights, getHomeYears } from "./home-data";
import { propertyTitle } from "./property";
import {
  buildNetWorth,
  findCoverageOverlaps,
  parseLooseDate,
  policyLast4,
  resolveUsdIlsRate,
  toDateStr,
  type BenefitLite,
  type CoverageReport,
  type FxRate,
  type HouseholdContact,
  type HouseholdGoals,
  type HouseholdMember,
  type NetWorthPayload,
  type PropertyLite,
  type SavingsAccountLite,
  type SnapshotLite,
  type TradeEquityLite,
} from "./savings";
import { mapSavingsImport } from "./savings-import";
import { getLiveUsdIls } from "./fx-server";
import { DISMISS_TASK, actionKey, decodeDismissal, dismissKey, encodeDismissal, type ActionStatusMap } from "./advisor-report";
import type {
  CreateSavingsAccountInput,
  HouseholdBundle,
  SavingsImportDoc,
  createBenefitSchema,
  updateBenefitSchema,
  updateProfileSchema,
  updateSavingsAccountSchema,
} from "./savings-validators";
import type { z } from "zod";

// ── Self-heal ──────────────────────────────────────────────────────

let schemaReady: Promise<void> | null = null;

/** Ensure the savings DDL once per server instance (idempotent). */
export async function ensureSavingsReady(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureSavingsSchema().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/** Run a Prisma op; if it fails (schema missing on a fresh deploy), heal and retry once. */
async function withHeal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    schemaReady = null;
    await ensureSavingsReady();
    return await run();
  }
}

async function accountId(): Promise<string> {
  const account = await getAccount();
  return account.id;
}

const json = (v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

const dateOrNull = (s: string | null | undefined): Date | null => parseLooseDate(s ?? null);

// ── Savings accounts ───────────────────────────────────────────────

type SavingsRow = Awaited<ReturnType<typeof prisma.savingsAccount.findFirstOrThrow>>;

export function serializeSavingsAccount(r: SavingsRow): SavingsAccountLite {
  return {
    id: r.id,
    owner: r.owner,
    country: r.country,
    type: r.type,
    provider: r.provider,
    planName: r.planName,
    policyLast4: r.policyLast4,
    policyNumber: r.policyNumber,
    loginUrl: r.loginUrl,
    status: r.status,
    currency: r.currency,
    balance: r.balance,
    balanceAsOf: toDateStr(r.balanceAsOf),
    track: r.track,
    feeDepositPct: r.feeDepositPct,
    feeAccumulationPct: r.feeAccumulationPct,
    monthlyDepositEmployee: r.monthlyDepositEmployee,
    monthlyDepositEmployer: r.monthlyDepositEmployer,
    monthlyDepositSeverance: r.monthlyDepositSeverance,
    monthlyDepositTotal: r.monthlyDepositTotal,
    insuredSalary: r.insuredSalary,
    liquidityDate: toDateStr(r.liquidityDate),
    projectedMonthlyPension: r.projectedMonthlyPension,
    details: (r.details as Record<string, unknown> | null) ?? null,
    source: r.source,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
  };
}

export async function listSavingsAccounts(includeArchived = false): Promise<SavingsAccountLite[]> {
  return withHeal(async () => {
    const id = await accountId();
    const rows = await prisma.savingsAccount.findMany({
      where: { accountId: id, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ owner: "asc" }, { country: "asc" }, { type: "asc" }, { provider: "asc" }],
    });
    return rows.map(serializeSavingsAccount);
  });
}

export async function getSavingsAccount(id: string) {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.savingsAccount.findFirst({
      where: { id, accountId: acct },
      include: { snapshots: { orderBy: { asOf: "asc" } } },
    });
    if (!row) return null;
    return {
      ...serializeSavingsAccount(row),
      snapshots: row.snapshots.map((s) => ({ asOf: toDateStr(s.asOf) as string, balance: s.balance })),
    };
  });
}

async function upsertSnapshot(savingsAccountId: string, asOf: Date | null, balance: number) {
  if (!asOf) return;
  await prisma.savingsSnapshot.upsert({
    where: { savingsAccountId_asOf: { savingsAccountId, asOf } },
    create: { savingsAccountId, asOf, balance },
    update: { balance },
  });
}

export async function createSavingsAccount(data: CreateSavingsAccountInput): Promise<SavingsAccountLite> {
  return withHeal(async () => {
    const acct = await accountId();
    const balanceAsOf = dateOrNull(data.balanceAsOf) ?? new Date(new Date().toISOString().slice(0, 10));
    const row = await prisma.savingsAccount.create({
      data: {
        accountId: acct,
        owner: data.owner,
        country: data.country,
        type: data.type,
        provider: data.provider.trim(),
        planName: data.planName ?? null,
        policyLast4: policyLast4(data.policyNumber ?? null),
        policyNumber: data.policyNumber?.trim() || null,
        loginUrl: data.loginUrl ?? null,
        status: data.status ?? null,
        currency: data.currency,
        balance: data.balance,
        balanceAsOf,
        track: data.track ?? null,
        feeDepositPct: data.feeDepositPct ?? null,
        feeAccumulationPct: data.feeAccumulationPct ?? null,
        monthlyDepositEmployee: data.monthlyDepositEmployee ?? null,
        monthlyDepositEmployer: data.monthlyDepositEmployer ?? null,
        monthlyDepositSeverance: data.monthlyDepositSeverance ?? null,
        monthlyDepositTotal: data.monthlyDepositTotal ?? null,
        insuredSalary: data.insuredSalary ?? null,
        liquidityDate: dateOrNull(data.liquidityDate),
        projectedMonthlyPension: data.projectedMonthlyPension ?? null,
        details: json(data.details),
        source: "manual",
      },
    });
    await upsertSnapshot(row.id, balanceAsOf, row.balance);
    return serializeSavingsAccount(row);
  });
}

export async function updateSavingsAccount(
  id: string,
  data: z.infer<typeof updateSavingsAccountSchema>
): Promise<SavingsAccountLite | null> {
  return withHeal(async () => {
    const acct = await accountId();
    const existing = await prisma.savingsAccount.findFirst({ where: { id, accountId: acct } });
    if (!existing) return null;
    const patch: Prisma.SavingsAccountUpdateInput = {};
    const simple = [
      "owner", "country", "type", "planName", "loginUrl", "status", "currency", "balance", "track",
      "feeDepositPct", "feeAccumulationPct", "monthlyDepositEmployee", "monthlyDepositEmployer",
      "monthlyDepositSeverance", "monthlyDepositTotal", "insuredSalary", "projectedMonthlyPension",
    ] as const;
    for (const k of simple) {
      if (data[k] !== undefined) (patch as Record<string, unknown>)[k] = data[k];
    }
    if (data.provider !== undefined) patch.provider = data.provider.trim();
    if (data.policyNumber !== undefined) {
      patch.policyLast4 = policyLast4(data.policyNumber);
      patch.policyNumber = data.policyNumber?.trim() || null;
    }
    if (data.balanceAsOf !== undefined) patch.balanceAsOf = dateOrNull(data.balanceAsOf);
    if (data.liquidityDate !== undefined) patch.liquidityDate = dateOrNull(data.liquidityDate);
    if (data.details !== undefined) patch.details = json(data.details);
    if (data.archived !== undefined) patch.archivedAt = data.archived ? new Date() : null;
    const row = await prisma.savingsAccount.update({ where: { id }, data: patch });
    if (data.balance !== undefined || data.balanceAsOf !== undefined) {
      await upsertSnapshot(row.id, row.balanceAsOf ?? new Date(new Date().toISOString().slice(0, 10)), row.balance);
    }
    return serializeSavingsAccount(row);
  });
}

export async function deleteSavingsAccount(id: string): Promise<boolean> {
  return withHeal(async () => {
    const acct = await accountId();
    const existing = await prisma.savingsAccount.findFirst({ where: { id, accountId: acct } });
    if (!existing) return false;
    // Unlink (not delete) benefits that lived inside this policy.
    await prisma.benefit.updateMany({ where: { linkedSavingsAccountId: id }, data: { linkedSavingsAccountId: null } });
    await prisma.savingsAccount.delete({ where: { id } });
    return true;
  });
}

async function listSnapshots(acct: string): Promise<SnapshotLite[]> {
  const rows = await prisma.savingsSnapshot.findMany({
    where: { savingsAccount: { accountId: acct } },
    select: { savingsAccountId: true, asOf: true, balance: true },
    orderBy: { asOf: "asc" },
  });
  return rows.map((r) => ({ savingsAccountId: r.savingsAccountId, asOf: toDateStr(r.asOf) as string, balance: r.balance }));
}

// ── Household profile ──────────────────────────────────────────────

export interface HouseholdProfileDTO {
  members: HouseholdMember[];
  goals: HouseholdGoals | null;
  goalsText: string | null;
  riskTolerance: string | null;
  usdIlsRate: number | null;
  contacts: HouseholdContact[];
  updatedAt: string | null;
}

const EMPTY_PROFILE: HouseholdProfileDTO = {
  members: [],
  goals: null,
  goalsText: null,
  riskTolerance: null,
  usdIlsRate: null,
  contacts: [],
  updatedAt: null,
};

export async function getProfile(): Promise<HouseholdProfileDTO> {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.householdProfile.findUnique({ where: { accountId: acct } });
    if (!row) return EMPTY_PROFILE;
    return {
      members: (row.members as HouseholdMember[] | null) ?? [],
      goals: (row.goals as HouseholdGoals | null) ?? null,
      goalsText: row.goalsText,
      riskTolerance: row.riskTolerance,
      usdIlsRate: row.usdIlsRate,
      contacts: (row.contacts as HouseholdContact[] | null) ?? [],
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function updateProfile(data: z.infer<typeof updateProfileSchema>): Promise<HouseholdProfileDTO> {
  await withHeal(async () => {
    const acct = await accountId();
    const patch: Prisma.HouseholdProfileUpdateInput = {};
    if (data.members !== undefined) patch.members = json(data.members);
    if (data.goals !== undefined) patch.goals = json(data.goals);
    if (data.goalsText !== undefined) patch.goalsText = data.goalsText;
    if (data.riskTolerance !== undefined) patch.riskTolerance = data.riskTolerance;
    if (data.usdIlsRate !== undefined) patch.usdIlsRate = data.usdIlsRate;
    if (data.contacts !== undefined) patch.contacts = json(data.contacts);
    await prisma.householdProfile.upsert({
      where: { accountId: acct },
      create: {
        accountId: acct,
        members: json(data.members),
        goals: json(data.goals),
        goalsText: data.goalsText ?? null,
        riskTolerance: data.riskTolerance ?? null,
        usdIlsRate: data.usdIlsRate ?? null,
        contacts: json(data.contacts),
      },
      update: patch,
    });
  });
  return getProfile();
}

/**
 * Profile override → live (Bank of Israel, then Frankfurter; cached ~6h) →
 * USD_ILS_RATE env → default. The live quote is only fetched when there's no
 * override, and a fetch failure just falls through.
 */
export async function getFxRate(profile?: HouseholdProfileDTO): Promise<FxRate> {
  const p = profile ?? (await getProfile());
  const live = p.usdIlsRate && p.usdIlsRate > 0 ? null : await getLiveUsdIls();
  return resolveUsdIlsRate({ profileOverride: p.usdIlsRate, live, envValue: process.env.USD_ILS_RATE ?? null });
}

/** Like getFxRate, but survives a DB outage (skips the profile override). */
export async function getFxRateSafe(): Promise<FxRate> {
  let profile: HouseholdProfileDTO | null = null;
  try {
    profile = await getProfile();
  } catch (e) {
    console.error("FX: profile unavailable, ignoring override", e instanceof Error ? e.message : e);
  }
  if (profile) return getFxRate(profile);
  return resolveUsdIlsRate({ live: await getLiveUsdIls(), envValue: process.env.USD_ILS_RATE ?? null });
}

// ── Benefits ───────────────────────────────────────────────────────

export interface BenefitDTO extends BenefitLite {
  payer: string | null;
  beneficiary: string | null;
  endsAt: string | null;
  details: Record<string, unknown> | null;
  origin: string;
}

type BenefitRow = Awaited<ReturnType<typeof prisma.benefit.findFirstOrThrow>>;

function serializeBenefit(r: BenefitRow): BenefitDTO {
  return {
    id: r.id,
    owner: r.owner,
    country: r.country,
    source: r.source,
    category: r.category,
    coverageAmount: r.coverageAmount,
    coverageCurrency: r.coverageCurrency,
    monthlyCost: r.monthlyCost,
    costCurrency: r.costCurrency,
    payer: r.payer,
    beneficiary: r.beneficiary,
    endsAt: toDateStr(r.endsAt),
    linkedSavingsAccountId: r.linkedSavingsAccountId,
    details: (r.details as Record<string, unknown> | null) ?? null,
    origin: r.origin,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
  };
}

export async function listBenefits(includeArchived = false): Promise<BenefitDTO[]> {
  return withHeal(async () => {
    const acct = await accountId();
    const rows = await prisma.benefit.findMany({
      where: { accountId: acct, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ owner: "asc" }, { category: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(serializeBenefit);
  });
}

export async function createBenefit(data: z.infer<typeof createBenefitSchema>): Promise<BenefitDTO> {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.benefit.create({
      data: {
        accountId: acct,
        owner: data.owner,
        country: data.country,
        source: data.source.trim(),
        category: data.category,
        coverageAmount: data.coverageAmount ?? null,
        coverageCurrency: data.coverageCurrency ?? null,
        monthlyCost: data.monthlyCost ?? null,
        costCurrency: data.costCurrency ?? null,
        payer: data.payer ?? null,
        beneficiary: data.beneficiary ?? null,
        endsAt: dateOrNull(data.endsAt),
        linkedSavingsAccountId: data.linkedSavingsAccountId ?? null,
        details: json(data.details),
        origin: "manual",
      },
    });
    return serializeBenefit(row);
  });
}

export async function updateBenefit(id: string, data: z.infer<typeof updateBenefitSchema>): Promise<BenefitDTO | null> {
  return withHeal(async () => {
    const acct = await accountId();
    const existing = await prisma.benefit.findFirst({ where: { id, accountId: acct } });
    if (!existing) return null;
    const patch: Prisma.BenefitUpdateInput = {};
    const simple = [
      "owner", "country", "category", "coverageAmount", "coverageCurrency", "monthlyCost",
      "costCurrency", "payer", "beneficiary", "linkedSavingsAccountId",
    ] as const;
    for (const k of simple) {
      if (data[k] !== undefined) (patch as Record<string, unknown>)[k] = data[k];
    }
    if (data.source !== undefined) patch.source = data.source.trim();
    if (data.endsAt !== undefined) patch.endsAt = dateOrNull(data.endsAt);
    if (data.details !== undefined) patch.details = json(data.details);
    if (data.archived !== undefined) patch.archivedAt = data.archived ? new Date() : null;
    const row = await prisma.benefit.update({ where: { id }, data: patch });
    return serializeBenefit(row);
  });
}

export async function deleteBenefit(id: string): Promise<boolean> {
  return withHeal(async () => {
    const acct = await accountId();
    const res = await prisma.benefit.deleteMany({ where: { id, accountId: acct } });
    return res.count > 0;
  });
}

// ── Other modules ──────────────────────────────────────────────────

/**
 * Trade account equity = starting balance + all-time realized P&L + net
 * deposits/withdrawals (FundTransaction). Realized follows data.ts
 * `hasRealizedPnL` (completed, or partially exited). Open-position
 * unrealized P&L is not tracked by the Trade module, so it's excluded.
 * Returns null when there is no account (never the demo data).
 */
export async function getTradeEquity(): Promise<TradeEquityLite | null> {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return null;
    const trades = await prisma.trade.findMany({
      where: { accountId: account.id },
      select: { totalPnL: true, isCompleted: true, totalShares: true, sharesInProcess: true },
    });
    const realizedPnL = trades
      .filter((t) => {
        if (t.totalPnL == null) return false;
        if (t.isCompleted) return true;
        const total = t.totalShares ?? 0;
        return total > 0 && (t.sharesInProcess ?? 0) < total;
      })
      .reduce((s, t) => s + (t.totalPnL ?? 0), 0);
    let netFunds = 0;
    try {
      const agg = await prisma.fundTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
      netFunds = agg._sum.amount ?? 0;
    } catch {
      // FundTransaction table may not exist pre-migration.
    }
    return { startingBalance: account.startingBalance, realizedPnL, netFunds };
  } catch {
    return null;
  }
}

async function getPropertiesLite(): Promise<PropertyLite[]> {
  return withHeal(async () => {
    const account = await prisma.account.findFirst();
    if (!account) return [];
    const rows = await prisma.property.findMany({
      where: { accountId: account.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((p) => ({
      id: p.id,
      title: propertyTitle(p),
      currentValue: p.currentValue,
      purchasePrice: p.purchasePrice,
      valueAsOf: toDateStr(p.valueAsOf),
      mortgageBalance: p.mortgageBalance,
      mortgageAsOf: toDateStr(p.mortgageAsOf),
    }));
  });
}

export interface HomeCashFlowSummary {
  year: number | null;
  income: number;
  spend: number;
  net: number;
  savingsRate: number;
  avgMonthlySpend: number;
  activeMonths: number;
  topCategories: { name: string; total: number }[];
}

export async function getHomeCashFlowSummary(): Promise<HomeCashFlowSummary> {
  const years = await getHomeYears();
  const year = years[0] ?? null;
  if (year == null) {
    return { year: null, income: 0, spend: 0, net: 0, savingsRate: 0, avgMonthlySpend: 0, activeMonths: 0, topCategories: [] };
  }
  const ins = await getHomeInsights(year);
  return {
    year,
    ...ins.totals,
    topCategories: ins.categories.slice(0, 8).map((c) => ({ name: c.name, total: c.total })),
  };
}

// ── Net worth ──────────────────────────────────────────────────────

export interface NetWorthResponse extends NetWorthPayload {
  coverage: CoverageReport;
}

export async function getNetWorth(asOf = new Date()): Promise<NetWorthResponse> {
  await ensureSavingsReady();
  const profile = await getProfile();
  const fx = await getFxRate(profile);
  const acct = await accountId();
  const [savings, snapshots, properties, trade, benefits] = await Promise.all([
    listSavingsAccounts(),
    withHeal(() => listSnapshots(acct)),
    getPropertiesLite(),
    getTradeEquity(),
    listBenefits(),
  ]);
  const payload = buildNetWorth({ asOf, fx, savings, properties, trade, snapshots });
  return { ...payload, coverage: findCoverageOverlaps(benefits, profile.members, fx) };
}

// ── Import ─────────────────────────────────────────────────────────

export interface ImportResult {
  accountsCreated: number;
  accountsUpdated: number;
  snapshotsWritten: number;
  benefitsCreated: number;
  benefitsUpdated: number;
  membersAdded: string[];
  warnings: string[];
}

/**
 * Import an Israeli PDF-extract doc. Accounts upsert by
 * owner + provider + type + policy last-4; a snapshot is written per
 * statement date (idempotent on account + asOf); coverages upsert as Benefit
 * rows by importKey. Profile members are added/filled only where empty.
 */
export async function importSavingsDoc(doc: SavingsImportDoc): Promise<ImportResult> {
  await ensureSavingsReady();
  const mapped = mapSavingsImport(doc);
  const acct = await accountId();
  const result: ImportResult = {
    accountsCreated: 0,
    accountsUpdated: 0,
    snapshotsWritten: 0,
    benefitsCreated: 0,
    benefitsUpdated: 0,
    membersAdded: [],
    warnings: mapped.warnings,
  };

  const idByMatchKey = new Map<string, string>();
  for (const a of mapped.accounts) {
    const existing = await prisma.savingsAccount.findFirst({
      where: { accountId: acct, owner: a.owner, provider: { equals: a.provider, mode: "insensitive" }, type: a.type, policyLast4: a.policyLast4 },
    });
    const data = {
      owner: a.owner,
      country: a.country,
      type: a.type,
      provider: a.provider,
      planName: a.planName,
      policyLast4: a.policyLast4,
      policyNumber: a.policyNumber,
      status: a.status,
      currency: a.currency,
      track: a.track,
      feeDepositPct: a.feeDepositPct,
      feeAccumulationPct: a.feeAccumulationPct,
      monthlyDepositEmployee: a.monthlyDepositEmployee,
      monthlyDepositEmployer: a.monthlyDepositEmployer,
      monthlyDepositSeverance: a.monthlyDepositSeverance,
      monthlyDepositTotal: a.monthlyDepositTotal,
      insuredSalary: a.insuredSalary,
      liquidityDate: a.liquidityDate,
      projectedMonthlyPension: a.projectedMonthlyPension,
      details: json(a.details),
      source: "pdf-import",
    };
    let id: string;
    if (existing) {
      // Only move the headline balance forward; an older statement just adds history.
      const isNewer = !existing.balanceAsOf || (a.balanceAsOf && a.balanceAsOf >= existing.balanceAsOf);
      await prisma.savingsAccount.update({
        where: { id: existing.id },
        data: isNewer ? { ...data, balance: a.balance, balanceAsOf: a.balanceAsOf, archivedAt: null } : {},
      });
      id = existing.id;
      result.accountsUpdated++;
    } else {
      const row = await prisma.savingsAccount.create({
        data: { ...data, accountId: acct, balance: a.balance, balanceAsOf: a.balanceAsOf },
      });
      id = row.id;
      result.accountsCreated++;
    }
    idByMatchKey.set(a.matchKey, id);
    if (a.balanceAsOf) {
      await upsertSnapshot(id, a.balanceAsOf, a.balance);
      result.snapshotsWritten++;
    }
  }

  for (const b of mapped.benefits) {
    const data = {
      owner: b.owner,
      country: b.country,
      source: b.source,
      category: b.category,
      coverageAmount: b.coverageAmount,
      coverageCurrency: b.coverageCurrency,
      monthlyCost: b.monthlyCost,
      costCurrency: b.costCurrency,
      linkedSavingsAccountId: b.accountMatchKey ? (idByMatchKey.get(b.accountMatchKey) ?? null) : null,
      details: json(b.details),
      origin: "pdf-import",
      archivedAt: null,
    };
    const existing = await prisma.benefit.findFirst({ where: { accountId: acct, importKey: b.importKey } });
    if (existing) {
      await prisma.benefit.update({ where: { id: existing.id }, data });
      result.benefitsUpdated++;
    } else {
      await prisma.benefit.create({ data: { ...data, accountId: acct, importKey: b.importKey } });
      result.benefitsCreated++;
    }
  }

  // Merge people into the profile without overwriting user-entered values.
  const profile = await getProfile();
  const members = [...profile.members];
  for (const m of mapped.members) {
    const cur = members.find((x) => x.key === m.key);
    if (!cur) {
      members.push({
        key: m.key,
        role: "adult",
        name: m.name,
        nameHe: m.nameHe,
        birthDate: m.birthDate,
        targetRetirementAge: m.targetRetirementAge,
      });
      result.membersAdded.push(m.key);
    } else {
      cur.name = cur.name || m.name;
      cur.nameHe = cur.nameHe || m.nameHe;
      cur.birthDate = cur.birthDate || m.birthDate;
      cur.targetRetirementAge = cur.targetRetirementAge || m.targetRetirementAge;
    }
  }
  await updateProfile({ members });
  return result;
}

/**
 * Import a household bundle (see householdBundleSchema). Accounts upsert by
 * owner + type + provider + policy last-4; benefits upsert by
 * owner + category + source. A 401k_match benefit with no link is attached to
 * the owner's 401(k). Profile members merge by key, bundle values winning.
 */
export async function importHouseholdBundle(bundle: HouseholdBundle): Promise<ImportResult> {
  const result: ImportResult = bundle.israel
    ? await importSavingsDoc(bundle.israel)
    : { accountsCreated: 0, accountsUpdated: 0, snapshotsWritten: 0, benefitsCreated: 0, benefitsUpdated: 0, membersAdded: [], warnings: [] };
  await ensureSavingsReady();
  const acct = await accountId();

  for (const a of bundle.accounts ?? []) {
    const existing = await prisma.savingsAccount.findFirst({
      where: {
        accountId: acct,
        owner: a.owner,
        type: a.type,
        provider: { equals: a.provider.trim(), mode: "insensitive" },
        policyLast4: policyLast4(a.policyNumber ?? null),
      },
    });
    if (existing) {
      await updateSavingsAccount(existing.id, { ...a, archived: false });
      result.accountsUpdated++;
    } else {
      await createSavingsAccount(a);
      result.accountsCreated++;
    }
    result.snapshotsWritten++;
  }

  for (const b of bundle.benefits ?? []) {
    let linked = b.linkedSavingsAccountId ?? null;
    if (!linked && b.category === "401k_match") {
      const k = await prisma.savingsAccount.findFirst({ where: { accountId: acct, owner: b.owner, type: "401k", archivedAt: null } });
      linked = k?.id ?? null;
    }
    const data = { ...b, linkedSavingsAccountId: linked };
    const existing = await prisma.benefit.findFirst({
      where: { accountId: acct, owner: b.owner, category: b.category, source: { equals: b.source.trim(), mode: "insensitive" }, importKey: null },
    });
    if (existing) {
      await updateBenefit(existing.id, { ...data, archived: false });
      result.benefitsUpdated++;
    } else {
      await createBenefit(data);
      result.benefitsCreated++;
    }
  }

  if (bundle.profile) {
    const profile = await getProfile();
    const patch = { ...bundle.profile };
    if (bundle.profile.members) {
      const members = [...profile.members];
      for (const m of bundle.profile.members) {
        const i = members.findIndex((x) => x.key === m.key);
        if (i === -1) {
          members.push(m);
          result.membersAdded.push(m.key);
        } else {
          const merged = { ...members[i] } as Record<string, unknown>;
          for (const [k, v] of Object.entries(m)) if (v !== null && v !== undefined) merged[k] = v;
          members[i] = merged as unknown as HouseholdMember;
        }
      }
      patch.members = members;
    }
    await updateProfile(patch);
  }
  return result;
}

// ── Advisor reports ────────────────────────────────────────────────

export interface AdvisorReportDTO {
  id: string;
  createdAt: string;
  model: string;
  inputHash: string;
  output: unknown;
  usage: unknown;
}

type ReportRow = Awaited<ReturnType<typeof prisma.advisorReport.findFirstOrThrow>>;
const serializeReport = (r: ReportRow): AdvisorReportDTO => ({
  id: r.id,
  createdAt: r.createdAt.toISOString(),
  model: r.model,
  inputHash: r.inputHash,
  output: r.output,
  usage: r.usage,
});

export async function getLatestAdvisorReport(inputHash?: string): Promise<AdvisorReportDTO | null> {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.advisorReport.findFirst({
      where: { accountId: acct, ...(inputHash ? { inputHash } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return row ? serializeReport(row) : null;
  });
}

export async function saveAdvisorReport(r: {
  model: string;
  inputHash: string;
  snapshot: unknown;
  output: unknown;
  usage: unknown;
}): Promise<AdvisorReportDTO> {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.advisorReport.create({
      data: {
        accountId: acct,
        model: r.model,
        inputHash: r.inputHash,
        snapshot: r.snapshot as Prisma.InputJsonValue,
        output: r.output as Prisma.InputJsonValue,
        usage: r.usage as Prisma.InputJsonValue,
      },
    });
    return serializeReport(row);
  });
}

// ── Advisor action items (persisted checkboxes) ────────────────────

/** All ticked/unticked action items for the account, keyed by actionKey. */
export async function getAdvisorActionStatuses(): Promise<ActionStatusMap> {
  return withHeal(async () => {
    const acct = await accountId();
    const rows = await prisma.advisorActionStatus.findMany({ where: { accountId: acct } });
    const out: ActionStatusMap = {};
    for (const r of rows) {
      const dismissal = decodeDismissal(r.task);
      out[r.key] = { done: r.done, doneAt: r.doneAt?.toISOString() ?? null, ...(dismissal ? { reason: dismissal.reason } : {}) };
    }
    return out;
  });
}

/**
 * Mark a recommendation "not relevant" (or restore it). The title and the
 * household's reason are kept in the task column (after the reserved marker)
 * so the advisor learns what was rejected and why, even once the
 * recommendation drops out of the latest report.
 */
export async function setAdvisorDismissal(input: { recId: string; title: string; reason: string | null; dismissed: boolean; reportId?: string | null }) {
  const key = dismissKey(input.recId);
  const task = encodeDismissal(input.title, input.reason);
  return withHeal(async () => {
    const acct = await accountId();
    const doneAt = input.dismissed ? new Date() : null;
    const row = await prisma.advisorActionStatus.upsert({
      where: { accountId_key: { accountId: acct, key } },
      create: { accountId: acct, key, recId: input.recId, task, done: input.dismissed, doneAt, reportId: input.reportId ?? null },
      update: { done: input.dismissed, doneAt, task, reportId: input.reportId ?? null },
    });
    return { key, done: row.done, doneAt: row.doneAt?.toISOString() ?? null, reason: input.reason };
  });
}

/** Recommendations the user marked "not relevant" and why, for the next advisor run. */
export async function getDismissedRecommendations(): Promise<{ id: string; title: string; reason: string | null; dismissedAt: string | null }[]> {
  return withHeal(async () => {
    const acct = await accountId();
    const rows = await prisma.advisorActionStatus.findMany({
      where: { accountId: acct, done: true, task: { startsWith: `${DISMISS_TASK}:` } },
      orderBy: { doneAt: "desc" },
    });
    return rows.map((r) => {
      const d = decodeDismissal(r.task);
      return { id: r.recId, title: d?.title ?? r.recId, reason: d?.reason ?? null, dismissedAt: r.doneAt?.toISOString() ?? null };
    });
  });
}

/** Tick or untick one action item. The key is derived server-side from recId + task. */
export async function setAdvisorActionStatus(input: {
  recId: string;
  task: string;
  done: boolean;
  reportId?: string | null;
}): Promise<{ key: string; done: boolean; doneAt: string | null }> {
  const key = actionKey(input.recId, input.task);
  return withHeal(async () => {
    const acct = await accountId();
    const doneAt = input.done ? new Date() : null;
    const row = await prisma.advisorActionStatus.upsert({
      where: { accountId_key: { accountId: acct, key } },
      create: { accountId: acct, key, recId: input.recId, task: input.task, done: input.done, doneAt, reportId: input.reportId ?? null },
      update: { done: input.done, doneAt, task: input.task, reportId: input.reportId ?? null },
    });
    return { key, done: row.done, doneAt: row.doneAt?.toISOString() ?? null };
  });
}
