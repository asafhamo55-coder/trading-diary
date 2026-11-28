// Read/write filed tax returns (TaxReturn table). Shape and PII rules live in
// tax-return-schema.ts; the Schedule E → property books backfill in
// tax-return-backfill.ts.
import { prisma } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { getAccount } from "./api-helpers";
import { ensureSavingsReady } from "./savings-data";
import { shouldReplace, taxReturnInputSchema, type TaxReturnInput } from "./tax-return-schema";

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
