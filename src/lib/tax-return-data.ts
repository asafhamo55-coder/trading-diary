// Read/write filed tax returns (TaxReturn table). Shape and PII rules live in
// tax-return-schema.ts; the Schedule E → property books backfill in
// tax-return-backfill.ts.
import { prisma } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { getAccount } from "./api-helpers";
import { ensureSavingsReady } from "./savings-data";
import { shouldReplace, taxReturnInputSchema, type TaxReturnInput } from "./tax-return-schema";
import { backfillDeleteWhere, excludeBookedProperties, fillTaxBasis, matchRentals, scheduleEToTransactions } from "./tax-return-backfill";
import { parseProfile } from "./property-profile";
import { ensurePropertySchema } from "./property-schema";

export type TaxReturnDTO = TaxReturnInput & { id: string; updatedAt: string };

async function healed<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    await ensureSavingsReady();
    return await run();
  }
}

function serialize(r: {
  id: string;
  taxYear: number;
  jurisdiction: string;
  filingStatus: string | null;
  preparer: string | null;
  source: string | null;
  partial: boolean;
  amended: boolean;
  data: Prisma.JsonValue;
  updatedAt: Date;
}): TaxReturnDTO {
  // Re-parse so stored rows always come back in the current shape.
  const parsed = taxReturnInputSchema.parse({
    taxYear: r.taxYear,
    jurisdiction: r.jurisdiction,
    filingStatus: r.filingStatus,
    preparer: r.preparer,
    source: r.source,
    partial: r.partial,
    amended: r.amended,
    data: r.data ?? {},
  });
  return { ...parsed, id: r.id, updatedAt: r.updatedAt.toISOString() };
}

export async function upsertTaxReturn(
  input: TaxReturnInput
): Promise<{ row: TaxReturnDTO; replaced: boolean; skipped: boolean }> {
  return healed(async () => {
    const accountId = (await getAccount()).id;
    const where = { accountId_taxYear_jurisdiction: { accountId, taxYear: input.taxYear, jurisdiction: input.jurisdiction } };
    const existing = await prisma.taxReturn.findUnique({ where });
    if (!shouldReplace(existing, input)) return { row: serialize(existing!), replaced: false, skipped: true };
    const fields = {
      filingStatus: input.filingStatus,
      preparer: input.preparer,
      source: input.source,
      partial: input.partial,
      amended: input.amended,
      data: input.data as Prisma.InputJsonValue,
    };
    const row = await prisma.taxReturn.upsert({
      where,
      create: { accountId, taxYear: input.taxYear, jurisdiction: input.jurisdiction, ...fields },
      update: fields,
    });
    return { row: serialize(row), replaced: !!existing, skipped: false };
  });
}

/** Newest year first; federal before state within a year. */
export async function listTaxReturns(): Promise<TaxReturnDTO[]> {
  return healed(async () => {
    const accountId = (await getAccount()).id;
    const rows = await prisma.taxReturn.findMany({ where: { accountId }, orderBy: [{ taxYear: "desc" }, { jurisdiction: "asc" }] });
    return rows.map(serialize);
  });
}

/**
 * Rewrite a federal return's Schedule E figures into the property books: in
 * one transaction, delete this year's `taxReturn:<year>` rows for the matched
 * properties, insert the new ones, and fill empty tax-basis fields. Statement
 * imports and hand-entered rows are never touched.
 */
export async function backfillPropertyBooks(ret: TaxReturnInput): Promise<{
  created: number;
  deleted: number;
  unmatched: string[];
  booksExist: string[];
  basisFilled: string[];
}> {
  await ensurePropertySchema(); // adds the `source` column on a fresh deploy
  const accountId = (await getAccount()).id;
  const properties = await prisma.property.findMany({
    where: { accountId },
    select: { id: true, address: true, street: true, unit: true, profile: true },
  });
  const known = new Set(properties.map((p) => p.id));
  const first = matchRentals(ret.data.rentals, properties);
  // Ids supplied by the extractor must belong to this account.
  const unmatched = [...first.unmatched];
  const valid = first.matched.flatMap((m) => {
    const ids = m.propertyIds.filter((id) => known.has(id));
    if (!ids.length) unmatched.push(m.rental.address);
    return ids.length ? [{ ...m, propertyIds: ids }] : [];
  });
  // Years the app already has statement books for are left alone.
  const booked = await prisma.propertyTransaction.findMany({
    where: { year: ret.taxYear, source: null, propertyId: { in: [...known] } },
    select: { propertyId: true },
    distinct: ["propertyId"],
  });
  const { matched, booked: booksExist } = excludeBookedProperties(valid, new Set(booked.map((b) => b.propertyId)));
  const rows = matched.flatMap((m) => scheduleEToTransactions(m.rental, ret.taxYear, m.propertyIds));
  const basisUpdates = matched.flatMap((m) =>
    m.propertyIds.flatMap((id) => {
      const p = properties.find((x) => x.id === id);
      const taxBasis = fillTaxBasis(parseProfile(p?.profile).taxBasis, m.rental.depreciation, 1 / m.propertyIds.length);
      return taxBasis ? [{ id, profile: { ...((p?.profile as object) ?? {}), taxBasis } }] : [];
    })
  );
  const [deleted] = await prisma.$transaction([
    prisma.propertyTransaction.deleteMany({ where: backfillDeleteWhere(accountId, ret.taxYear) }),
    prisma.propertyTransaction.createMany({ data: rows }),
    ...basisUpdates.map((u) =>
      prisma.property.update({ where: { id: u.id }, data: { profile: u.profile as Prisma.InputJsonValue } })
    ),
  ]);
  return { created: rows.length, deleted: deleted.count, unmatched, booksExist, basisFilled: basisUpdates.map((u) => u.id) };
}
