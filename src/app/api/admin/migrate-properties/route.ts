import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { ensurePropertySchema } from "@/lib/property-schema";

// One-shot: ensure the Hamo Properties tables/columns exist. Idempotent and
// also run automatically as a self-heal in the data layer, so calling this is
// optional. Exposed as GET + POST so it can be triggered from a browser.
export async function POST() {
  try {
    await ensurePropertySchema();
    return jsonResponse({ ok: true, message: "Property schema ensured" });
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
