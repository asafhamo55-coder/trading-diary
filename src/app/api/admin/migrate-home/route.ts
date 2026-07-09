import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { ensureHomeSchema } from "@/lib/home-schema";
import { seedDefaultCategories } from "@/lib/home-data";

// One-shot: ensure Hamo Home tables exist and seed default categories.
// Idempotent; also self-heals from the data layer, so calling this is optional.
export async function POST() {
  try {
    await ensureHomeSchema();
    const account = await getAccount();
    await seedDefaultCategories(account.id);
    return jsonResponse({ ok: true, message: "Home schema ensured & categories seeded" });
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
