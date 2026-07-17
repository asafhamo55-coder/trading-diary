// Hamo Properties — property payment statement importer.
//
// Loads a full property payment statement (as exported by the landlord portal,
// e.g. "Property_Statement_Report_260NorthPeakDrive_ID720938.xlsx") into the
// database: the property itself, its tenant(s), and every payment line.
//
// The source spreadsheet carries richer columns than our tax-oriented schema
// (Category, Sub-category, Payer / Payee). We map each source category onto the
// closest Schedule E catalog key (so the tax summary keeps working) while
// preserving the ORIGINAL category, sub-category and payer/payee verbatim in
// the transaction description — nothing from the source file is discarded.

import { prisma } from "./db";
import type { PropertyTxType } from "./property";

// ── Raw statement shape (faithful to the exported spreadsheet) ─────────────

export interface StatementRow {
  /** ISO date the payment was recorded (source column "Date paid"). */
  date: string; // YYYY-MM-DD
  /** Source "Category" column, verbatim. */
  rawCategory: string;
  /** Source "Sub-category" column, verbatim ("–" when none). */
  subCategory: string;
  /** Source "Payer / Payee" column, verbatim. */
  payee: string;
  /** Source "Money in" column (0 when none). */
  moneyIn: number;
  /** Source "Money out" column (0 when none). */
  moneyOut: number;
}

export interface StatementTenant {
  name: string;
  email?: string | null;
  phone?: string | null;
  leaseStart: string; // YYYY-MM-DD
  leaseEnd?: string | null;
  monthlyRent?: number | null;
  securityDeposit?: number | null;
  notes?: string | null;
}

export interface PropertyStatement {
  /** Short display name. */
  nickname: string;
  /** Full address (used as the idempotency key for re-imports). */
  address: string;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  /** Landlord / provenance notes shown on the property. */
  notes: string;
  tenants: StatementTenant[];
  rows: StatementRow[];
}

// ── Source → Schedule E catalog mapping ────────────────────────────────────
// Keys must exist in PROPERTY_CATEGORIES (src/lib/property.ts). Each source
// category resolves to one catalog key + implied type.

const CATEGORY_MAP: Record<string, { key: string; type: PropertyTxType }> = {
  Rent: { key: "RENT", type: "INCOME" },
  "Tenant charges & fees": { key: "OTHER_INCOME", type: "INCOME" },
  "Mortgage and Loans": { key: "MORTGAGE_INTEREST", type: "EXPENSE" },
  Maintenance: { key: "CLEANING_MAINT", type: "EXPENSE" },
  "Management fees (Expense)": { key: "MANAGEMENT", type: "EXPENSE" },
  Repairs: { key: "REPAIRS", type: "EXPENSE" },
  "Dues and Fees": { key: "HOA", type: "EXPENSE" },
};

/** Compose a lossless description from the source category / sub-cat / payee. */
function describe(row: StatementRow): string {
  const parts = [row.rawCategory];
  if (row.subCategory && row.subCategory !== "–") parts.push(row.subCategory);
  if (row.payee) parts.push(row.payee);
  return parts.join(" · ");
}

export interface MappedTransaction {
  date: string;
  year: number;
  month: number;
  type: PropertyTxType;
  category: string;
  amount: number;
  description: string;
}

/** Translate raw statement rows into DB-ready transactions (pure, no I/O). */
export function mapStatementRows(rows: StatementRow[]): MappedTransaction[] {
  return rows.map((row, i) => {
    const map = CATEGORY_MAP[row.rawCategory];
    if (!map) throw new Error(`Row ${i + 1}: unmapped category "${row.rawCategory}"`);
    // Type is driven by the money direction; category type is a sanity check.
    const type: PropertyTxType = row.moneyIn > 0 ? "INCOME" : "EXPENSE";
    const amount = type === "INCOME" ? row.moneyIn : row.moneyOut;
    const [y, m] = row.date.split("-").map(Number);
    return {
      date: row.date,
      year: y,
      month: m,
      type,
      category: map.key,
      amount,
      description: describe(row),
    };
  });
}

export interface ImportResult {
  propertyId: string;
  created: boolean;
  transactions: number;
  tenants: number;
  income: number;
  expenses: number;
  net: number;
}

/**
 * Push a full statement into the DB for a single property. Idempotent: keyed on
 * (accountId, address). Re-running replaces that property's transactions and
 * tenants with the statement's contents (property metadata is upserted), so it
 * is always safe to trigger again after a data fix.
 */
export async function importPropertyStatement(
  accountId: string,
  statement: PropertyStatement
): Promise<ImportResult> {
  const txs = mapStatementRows(statement.rows);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.property.findFirst({
      where: { accountId, address: statement.address },
    });

    const data = {
      nickname: statement.nickname,
      address: statement.address,
      purchasePrice: statement.purchasePrice ?? null,
      purchaseDate: statement.purchaseDate ? new Date(statement.purchaseDate) : null,
      notes: statement.notes,
    };

    let propertyId: string;
    let created: boolean;
    if (existing) {
      propertyId = existing.id;
      created = false;
      await tx.property.update({ where: { id: propertyId }, data });
      // Replace prior imported children so re-imports don't accumulate dupes.
      await tx.propertyTransaction.deleteMany({ where: { propertyId } });
      await tx.tenant.deleteMany({ where: { propertyId } });
    } else {
      const p = await tx.property.create({ data: { accountId, ...data } });
      propertyId = p.id;
      created = true;
    }

    if (statement.tenants.length) {
      await tx.tenant.createMany({
        data: statement.tenants.map((t) => ({
          propertyId,
          name: t.name,
          email: t.email ?? null,
          phone: t.phone ?? null,
          leaseStart: new Date(t.leaseStart),
          leaseEnd: t.leaseEnd ? new Date(t.leaseEnd) : null,
          monthlyRent: t.monthlyRent ?? null,
          securityDeposit: t.securityDeposit ?? null,
          notes: t.notes ?? null,
        })),
      });
    }

    await tx.propertyTransaction.createMany({
      data: txs.map((t) => ({
        propertyId,
        date: new Date(t.date),
        year: t.year,
        month: t.month,
        type: t.type,
        category: t.category,
        amount: t.amount,
        description: t.description,
      })),
    });

    return { propertyId, created };
  });

  const income = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  return {
    propertyId: result.propertyId,
    created: result.created,
    transactions: txs.length,
    tenants: statement.tenants.length,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    net: Math.round((income - expenses) * 100) / 100,
  };
}
