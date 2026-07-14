import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot: add TradeLeg.filledAt (the date each buy/sell was filled/logged) and
// backfill existing legs to their trade's tradeDate so no historical leg shows a
// blank date. Idempotent — safe to re-run. Exposed as GET + POST so it can be
// triggered straight from a browser, matching the other admin migration routes.
async function run() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "TradeLeg" ADD COLUMN IF NOT EXISTS "filledAt" TIMESTAMP(3)`
  );
  const backfilled = await prisma.$executeRawUnsafe(
    `UPDATE "TradeLeg" l SET "filledAt" = t."tradeDate"
       FROM "Trade" t
      WHERE l."tradeId" = t."id" AND l."filledAt" IS NULL`
  );
  return jsonResponse({
    ok: true,
    message: `TradeLeg.filledAt ensured; backfilled ${backfilled} leg(s)`,
  });
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
