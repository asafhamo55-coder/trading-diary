import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot: add Trade.brokerAccount (broker account number from the fill, part
// of a trade's symbol+account identity) and its lookup index. Idempotent — safe
// to re-run. Exposed as GET + POST so it can be triggered straight from a
// browser, matching the other admin migration routes.
async function run() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "brokerAccount" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Trade_accountId_symbol_brokerAccount_isCompleted_idx"
       ON "Trade"("accountId", "symbol", "brokerAccount", "isCompleted")`
  );
  return jsonResponse({ ok: true, message: "Trade.brokerAccount ensured" });
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
