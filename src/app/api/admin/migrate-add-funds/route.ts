import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot: create FundTransaction table. Idempotent.
export async function POST() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FundTransaction" (
        "id" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "comment" TEXT,
        "occurredAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FundTransaction_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "FundTransaction_accountId_occurredAt_idx"
      ON "FundTransaction"("accountId", "occurredAt")
    `);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FundTransaction_accountId_fkey'
        ) THEN
          ALTER TABLE "FundTransaction"
          ADD CONSTRAINT "FundTransaction_accountId_fkey"
          FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
        END IF;
      END $$
    `);
    return jsonResponse({ ok: true, message: "FundTransaction table ensured" });
  } catch (error) {
    return errorResponse(
      `Migration failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}
