import { prisma } from "./db";

// Single source of truth for the Hamo Properties schema DDL. Fully idempotent
// (IF NOT EXISTS / guarded DO blocks) so it can run safely any number of times.
// Used both by the admin migration route and as a self-heal in the data layer,
// so a fresh deploy never requires a manual migration step.
export async function ensurePropertySchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyTxType') THEN
        CREATE TYPE "PropertyTxType" AS ENUM ('INCOME', 'EXPENSE');
      END IF;
    END $$
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Property" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "nickname" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "purchasePrice" DOUBLE PRECISION,
      "purchaseDate" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Property_accountId_idx" ON "Property"("accountId")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`
  );
  // Structured address parts (added after the original single `address` field).
  for (const col of ["street", "unit", "city", "state", "zip"]) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "${col}" TEXT`
    );
  }
  // Value / appreciation tracking.
  for (const col of ["downPayment", "currentValue"]) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "${col}" DOUBLE PRECISION`
    );
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "valueAsOf" TIMESTAMP(3)`
  );
  // Liability tracking (outstanding mortgage) so equity = value − mortgage.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mortgageBalance" DOUBLE PRECISION`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "mortgageAsOf" TIMESTAMP(3)`
  );
  // Rental vs the family's primary residence (counted in net worth, not in rental returns).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "usage" TEXT NOT NULL DEFAULT 'rental'`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PropertyTransaction" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "type" "PropertyTxType" NOT NULL,
      "category" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PropertyTransaction_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyTransaction_propertyId_date_idx" ON "PropertyTransaction"("propertyId", "date")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyTransaction_propertyId_year_idx" ON "PropertyTransaction"("propertyId", "year")`
  );
  // Entries kept for the tax report but ignored by every performance figure.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "taxOnly" BOOLEAN NOT NULL DEFAULT false`
  );
  // Provenance of generated rows, e.g. "taxReturn:2025" (Schedule E backfill).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "source" TEXT`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Tenant" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "leaseStart" TIMESTAMP(3) NOT NULL,
      "leaseEnd" TIMESTAMP(3),
      "monthlyRent" DOUBLE PRECISION,
      "securityDeposit" DOUBLE PRECISION,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Tenant_propertyId_leaseStart_idx" ON "Tenant"("propertyId", "leaseStart")`
  );

  // The property record: single-value sections in one JSON column, lists in
  // their own tables (see prisma/schema.prisma).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "profile" JSONB`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PropertyLoan" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "kind" TEXT NOT NULL DEFAULT 'first',
      "lender" TEXT,
      "servicer" TEXT,
      "loanNumber" TEXT,
      "portalUrl" TEXT,
      "servicerPhone" TEXT,
      "originalAmount" DOUBLE PRECISION,
      "startDate" TIMESTAMP(3),
      "termMonths" INTEGER,
      "interestRate" DOUBLE PRECISION,
      "rateType" TEXT NOT NULL DEFAULT 'fixed',
      "armResetDate" TIMESTAMP(3),
      "armIndex" TEXT,
      "armMargin" DOUBLE PRECISION,
      "monthlyPI" DOUBLE PRECISION,
      "escrowMonthly" DOUBLE PRECISION,
      "pmiMonthly" DOUBLE PRECISION,
      "pmiRemovalDate" TIMESTAMP(3),
      "maturityDate" TIMESTAMP(3),
      "balance" DOUBLE PRECISION,
      "balanceAsOf" TIMESTAMP(3),
      "active" BOOLEAN NOT NULL DEFAULT true,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PropertyLoan_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyLoan_propertyId_idx" ON "PropertyLoan"("propertyId")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PropertyImprovement" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "description" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'improvement',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PropertyImprovement_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyImprovement_propertyId_date_idx" ON "PropertyImprovement"("propertyId", "date")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PropertyMaintenance" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "vendor" TEXT,
      "system" TEXT,
      "cost" DOUBLE PRECISION,
      "notes" TEXT,
      "transactionId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PropertyMaintenance_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyMaintenance_propertyId_date_idx" ON "PropertyMaintenance"("propertyId", "date")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PropertyDocument" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "date" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyDocument_propertyId_idx" ON "PropertyDocument"("propertyId")`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PropertyUtility" (
      "id" TEXT NOT NULL,
      "propertyId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "provider" TEXT,
      "accountNumber" TEXT,
      "paidBy" TEXT NOT NULL DEFAULT 'tenant',
      "portalUrl" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PropertyUtility_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PropertyUtility_propertyId_idx" ON "PropertyUtility"("propertyId")`
  );

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Property_accountId_fkey') THEN
        ALTER TABLE "Property" ADD CONSTRAINT "Property_accountId_fkey"
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyTransaction_propertyId_fkey') THEN
        ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_propertyId_fkey') THEN
        ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyLoan_propertyId_fkey') THEN
        ALTER TABLE "PropertyLoan" ADD CONSTRAINT "PropertyLoan_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyImprovement_propertyId_fkey') THEN
        ALTER TABLE "PropertyImprovement" ADD CONSTRAINT "PropertyImprovement_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyMaintenance_propertyId_fkey') THEN
        ALTER TABLE "PropertyMaintenance" ADD CONSTRAINT "PropertyMaintenance_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyDocument_propertyId_fkey') THEN
        ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyUtility_propertyId_fkey') THEN
        ALTER TABLE "PropertyUtility" ADD CONSTRAINT "PropertyUtility_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
}
