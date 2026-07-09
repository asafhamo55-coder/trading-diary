import { prisma } from "./db";

// Single source of truth for the Hamo Home schema DDL. Idempotent (IF NOT
// EXISTS / guarded blocks) so it can run any number of times — used by the
// admin migration route and as a self-heal in the data layer.
export async function ensureHomeSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HomeAccountType') THEN
        CREATE TYPE "HomeAccountType" AS ENUM ('BOFA_CHECKING', 'BOFA_CARD', 'AMEX', 'OTHER');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HomeCategoryKind') THEN
        CREATE TYPE "HomeCategoryKind" AS ENUM ('SPENDING', 'INCOME', 'TRANSFER');
      END IF;
    END $$
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeAccount" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" "HomeAccountType" NOT NULL,
      "last4" TEXT,
      "archivedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomeAccount_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeAccount_accountId_idx" ON "HomeAccount"("accountId")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeCategory" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "parentId" TEXT,
      "kind" "HomeCategoryKind" NOT NULL DEFAULT 'SPENDING',
      "color" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isSystem" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomeCategory_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeCategory_accountId_idx" ON "HomeCategory"("accountId")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeImport" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "homeAccountId" TEXT NOT NULL,
      "filename" TEXT NOT NULL,
      "source" "HomeAccountType" NOT NULL,
      "rowCount" INTEGER NOT NULL DEFAULT 0,
      "addedCount" INTEGER NOT NULL DEFAULT 0,
      "duplicateCount" INTEGER NOT NULL DEFAULT 0,
      "periodStart" TIMESTAMP(3),
      "periodEnd" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomeImport_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeImport_accountId_idx" ON "HomeImport"("accountId")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeTransaction" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "homeAccountId" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "description" TEXT NOT NULL,
      "rawDescription" TEXT NOT NULL,
      "categoryId" TEXT,
      "notes" TEXT,
      "isExcluded" BOOLEAN NOT NULL DEFAULT false,
      "excludeReason" TEXT,
      "dedupeGroupId" TEXT,
      "needsReview" BOOLEAN NOT NULL DEFAULT false,
      "isManual" BOOLEAN NOT NULL DEFAULT false,
      "importId" TEXT,
      "externalKey" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomeTransaction_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeTransaction_accountId_date_idx" ON "HomeTransaction"("accountId", "date")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeTransaction_accountId_year_month_idx" ON "HomeTransaction"("accountId", "year", "month")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeTransaction_homeAccountId_idx" ON "HomeTransaction"("homeAccountId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeTransaction_externalKey_idx" ON "HomeTransaction"("externalKey")`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomeCategoryRule" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "matcher" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomeCategoryRule_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HomeCategoryRule_accountId_idx" ON "HomeCategoryRule"("accountId")`
  );

  // Foreign keys (guarded — ADD CONSTRAINT has no IF NOT EXISTS).
  const fk = async (name: string, sql: string) => {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
          ${sql}
        END IF;
      END $$
    `);
  };
  await fk(
    "HomeCategory_parentId_fkey",
    `ALTER TABLE "HomeCategory" ADD CONSTRAINT "HomeCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HomeCategory"("id") ON UPDATE CASCADE ON DELETE CASCADE`
  );
  await fk(
    "HomeTransaction_homeAccountId_fkey",
    `ALTER TABLE "HomeTransaction" ADD CONSTRAINT "HomeTransaction_homeAccountId_fkey" FOREIGN KEY ("homeAccountId") REFERENCES "HomeAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE`
  );
  await fk(
    "HomeTransaction_categoryId_fkey",
    `ALTER TABLE "HomeTransaction" ADD CONSTRAINT "HomeTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HomeCategory"("id") ON UPDATE CASCADE ON DELETE SET NULL`
  );
  await fk(
    "HomeTransaction_importId_fkey",
    `ALTER TABLE "HomeTransaction" ADD CONSTRAINT "HomeTransaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HomeImport"("id") ON UPDATE CASCADE ON DELETE SET NULL`
  );
  await fk(
    "HomeImport_homeAccountId_fkey",
    `ALTER TABLE "HomeImport" ADD CONSTRAINT "HomeImport_homeAccountId_fkey" FOREIGN KEY ("homeAccountId") REFERENCES "HomeAccount"("id") ON UPDATE CASCADE ON DELETE CASCADE`
  );
  await fk(
    "HomeCategoryRule_categoryId_fkey",
    `ALTER TABLE "HomeCategoryRule" ADD CONSTRAINT "HomeCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HomeCategory"("id") ON UPDATE CASCADE ON DELETE CASCADE`
  );
}
