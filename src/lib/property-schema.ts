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
}
