import { prisma } from "./db";

// DDL for the TradingGuideline table. Idempotent (IF NOT EXISTS) so it can
// run any number of times — used as a self-heal by guidelines-data.ts, so a
// fresh deploy needs no manual migration. Mirrors savings-schema.ts.
export async function ensureGuidelineSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TradingGuideline" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "config" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TradingGuideline_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "TradingGuideline_accountId_key" ON "TradingGuideline"("accountId")`
  );
}
