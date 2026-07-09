import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot: create the Hamo Properties tables (Property, PropertyTransaction)
// plus the PropertyTxType enum, indexes and FKs. Fully idempotent — safe to
// call repeatedly. Exposed as GET + POST so it can be triggered from a browser.
async function migrate() {
  // Enum (guarded — CREATE TYPE has no IF NOT EXISTS).
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

  // Foreign keys (guarded — ADD CONSTRAINT has no IF NOT EXISTS).
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
}

export async function POST() {
  try {
    await migrate();
    return jsonResponse({ ok: true, message: "Property tables ensured" });
  } catch (error) {
    return errorResponse(
      `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}

export async function GET() {
  return POST();
}
