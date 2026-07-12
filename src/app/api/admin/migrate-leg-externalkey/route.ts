import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot: add TradeLeg.externalKey (idempotency key for email-ingested legs)
// and its lookup index. Idempotent — safe to re-run. Exposed as GET + POST so
// it can be triggered straight from a browser, matching the other admin
// migration routes.
async function run() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TradeLeg" ADD COLUMN IF NOT EXISTS "externalKey" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "TradeLeg_externalKey_idx" ON "TradeLeg"("externalKey")`
  );
  return jsonResponse({ ok: true, message: "TradeLeg.externalKey ensured" });
}

export async function POST() {
  try {
    return await run();
  } catch (error) {
    return errorResponse(
      `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}

export function GET() {
  return POST();
}
