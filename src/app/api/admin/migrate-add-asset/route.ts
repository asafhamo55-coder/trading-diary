import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";

// One-shot: add the isAsset column. Safe to call repeatedly (IF NOT EXISTS).
export async function POST() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "isAsset" BOOLEAN NOT NULL DEFAULT false`
    );
    return jsonResponse({ ok: true, message: "isAsset column ensured" });
  } catch (error) {
    return errorResponse(
      `Migration failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}
