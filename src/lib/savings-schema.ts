import { prisma } from "./db";
import { ensurePropertySchema } from "./property-schema";

// Single source of truth for the Hamo Savings / Net Worth schema DDL. Fully
// idempotent (IF NOT EXISTS / guarded DO blocks) so it can run any number of
// times — used as a self-heal by savings-data.ts, so a fresh deploy never
// needs a manual migration. Mirrors home-schema.ts / property-schema.ts.
export async function ensureSavingsSchema(): Promise<void> {
  // Property liabilities (mortgageBalance / mortgageAsOf) live in the
  // property DDL; run it too so net worth can read them.
  await ensurePropertySchema();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SavingsAccount" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "owner" TEXT NOT NULL,
      "country" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "planName" TEXT,
      "policyLast4" TEXT,
      "status" TEXT,
      "currency" TEXT NOT NULL DEFAULT 'ILS',
      "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "balanceAsOf" TIMESTAMP(3),
      "track" TEXT,
      "feeDepositPct" DOUBLE PRECISION,
      "feeAccumulationPct" DOUBLE PRECISION,
      "monthlyDepositEmployee" DOUBLE PRECISION,
      "monthlyDepositEmployer" DOUBLE PRECISION,
      "monthlyDepositSeverance" DOUBLE PRECISION,
      "monthlyDepositTotal" DOUBLE PRECISION,
      "insuredSalary" DOUBLE PRECISION,
      "liquidityDate" TIMESTAMP(3),
      "projectedMonthlyPension" DOUBLE PRECISION,
      "details" JSONB,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SavingsAccount_accountId_idx" ON "SavingsAccount"("accountId")`
  );
  // Full policy / account number (the user opted in; policyLast4 stays the match key).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SavingsAccount" ADD COLUMN IF NOT EXISTS "policyNumber" TEXT`
  );
  // Provider sign-in page (falls back to provider-links.ts defaults when null).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "SavingsAccount" ADD COLUMN IF NOT EXISTS "loginUrl" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "SavingsAccount_accountId_owner_provider_type_idx" ON "SavingsAccount"("accountId", "owner", "provider", "type")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SavingsSnapshot" (
      "id" TEXT NOT NULL,
      "savingsAccountId" TEXT NOT NULL,
      "asOf" TIMESTAMP(3) NOT NULL,
      "balance" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SavingsSnapshot_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "SavingsSnapshot_savingsAccountId_asOf_key" ON "SavingsSnapshot"("savingsAccountId", "asOf")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HouseholdProfile" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "members" JSONB,
      "goals" JSONB,
      "goalsText" TEXT,
      "riskTolerance" TEXT,
      "usdIlsRate" DOUBLE PRECISION,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HouseholdProfile_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdProfile_accountId_key" ON "HouseholdProfile"("accountId")`
  );
  // Agents / CPA / HR contacts (HouseholdContact[]) — the advisor's email recipients.
  await prisma.$executeRawUnsafe(`ALTER TABLE "HouseholdProfile" ADD COLUMN IF NOT EXISTS "contacts" JSONB`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdvisorReport" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "model" TEXT NOT NULL,
      "inputHash" TEXT NOT NULL,
      "snapshot" JSONB NOT NULL,
      "output" JSONB NOT NULL,
      "usage" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdvisorReport_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AdvisorReport_accountId_createdAt_idx" ON "AdvisorReport"("accountId", "createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AdvisorReport_inputHash_idx" ON "AdvisorReport"("inputHash")`
  );

  // Ticked advisor action items, keyed by actionKey(recId, task) so a tick
  // survives the daily report regeneration (see advisor-report.ts).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdvisorActionStatus" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "recId" TEXT NOT NULL,
      "task" TEXT NOT NULL,
      "done" BOOLEAN NOT NULL DEFAULT false,
      "doneAt" TIMESTAMP(3),
      "reportId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdvisorActionStatus_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorActionStatus_accountId_key_key" ON "AdvisorActionStatus"("accountId", "key")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Benefit" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "owner" TEXT NOT NULL,
      "country" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "coverageAmount" DOUBLE PRECISION,
      "coverageCurrency" TEXT,
      "monthlyCost" DOUBLE PRECISION,
      "costCurrency" TEXT,
      "payer" TEXT,
      "beneficiary" TEXT,
      "endsAt" TIMESTAMP(3),
      "linkedSavingsAccountId" TEXT,
      "details" JSONB,
      "origin" TEXT NOT NULL DEFAULT 'manual',
      "importKey" TEXT,
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Benefit_accountId_owner_idx" ON "Benefit"("accountId", "owner")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Benefit_linkedSavingsAccountId_idx" ON "Benefit"("linkedSavingsAccountId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Benefit_importKey_idx" ON "Benefit"("importKey")`
  );

  // Foreign keys (guarded — ADD CONSTRAINT has no IF NOT EXISTS). The
  // statement must end with a semicolon: it runs inside a PL/pgSQL DO block.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavingsSnapshot_savingsAccountId_fkey') THEN
        ALTER TABLE "SavingsSnapshot" ADD CONSTRAINT "SavingsSnapshot_savingsAccountId_fkey"
        FOREIGN KEY ("savingsAccountId") REFERENCES "SavingsAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE;
      END IF;
    END $$
  `);
}
