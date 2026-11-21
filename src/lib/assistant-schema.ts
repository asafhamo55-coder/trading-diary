import { prisma } from "./db";

// Self-heal DDL for the in-app "Ask" assistant (AssistantQuestion). Fully
// idempotent so it can run on every cold start; mirrors savings-schema.ts and
// the AssistantQuestion model in prisma/schema.prisma.
export async function ensureAssistantSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AssistantQuestion" (
      "id" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "language" TEXT NOT NULL DEFAULT 'en',
      "pagePath" TEXT NOT NULL,
      "pageTitle" TEXT,
      "contextKeys" JSONB,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "answer" TEXT,
      "answeredAt" TIMESTAMP(3),
      "answeredBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "readAt" TIMESTAMP(3),
      CONSTRAINT "AssistantQuestion_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AssistantQuestion_accountId_createdAt_idx" ON "AssistantQuestion"("accountId", "createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AssistantQuestion_status_createdAt_idx" ON "AssistantQuestion"("status", "createdAt")`
  );
}
