// Server helpers for the property-record API routes: ownership check, the
// Prisma delegate per list, date coercion and the mortgage mirror.
import { prisma } from "./db";
import { getAccount } from "./api-helpers";
import { ensurePropertySchema } from "./property-schema";
import { serializeRecordRow } from "./property-data";
import {
  RECORD_DATE_FIELDS,
  RECORD_LISTS,
  syncedMortgage,
  type PropertyLoanDTO,
  type RecordList,
} from "./property-profile";

/** The minimal slice of a Prisma model delegate the routes use. */
interface ListDelegate {
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  delete(args: { where: { id: string } }): Promise<unknown>;
  findFirst(args: { where: { id: string; propertyId: string } }): Promise<Record<string, unknown> | null>;
}

export function delegateFor(list: RecordList): ListDelegate {
  const map: Record<RecordList, unknown> = {
    loans: prisma.propertyLoan,
    improvements: prisma.propertyImprovement,
    maintenance: prisma.propertyMaintenance,
    documents: prisma.propertyDocument,
    utilities: prisma.propertyUtility,
  };
  return map[list] as ListDelegate;
}

export function isRecordList(v: string): v is RecordList {
  return Object.prototype.hasOwnProperty.call(RECORD_LISTS, v);
}

/** The property, if it belongs to this account. Heals the schema once on failure. */
export async function ownedProperty(id: string) {
  const find = async () => {
    const account = await getAccount();
    return prisma.property.findFirst({ where: { id, accountId: account.id } });
  };
  try {
    return await find();
  } catch {
    await ensurePropertySchema();
    return find();
  }
}

/** YYYY-MM-DD strings → Date for the list's date columns. */
export function toDbData(list: RecordList, data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const f of RECORD_DATE_FIELDS[list]) {
    if (f in out) out[f] = out[f] ? new Date(`${out[f]}T00:00:00.000Z`) : null;
  }
  return out;
}

export function toDto<T>(list: RecordList, row: Record<string, unknown>): T {
  return serializeRecordRow<T>(list, row);
}

/**
 * Mirror the active loans onto Property.mortgageBalance / mortgageAsOf, which
 * net worth and the advisor read. With no active balance on file the manual
 * figure is left as it is.
 */
export async function syncMortgageFromLoans(propertyId: string): Promise<void> {
  const rows = await prisma.propertyLoan.findMany({ where: { propertyId } });
  const loans = rows.map((r) => toDto<PropertyLoanDTO>("loans", r as unknown as Record<string, unknown>));
  const synced = syncedMortgage(loans);
  if (!synced) return;
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      mortgageBalance: synced.balance,
      mortgageAsOf: synced.asOf ? new Date(`${synced.asOf}T00:00:00.000Z`) : new Date(),
    },
  });
}
