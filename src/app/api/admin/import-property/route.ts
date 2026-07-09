import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { importPropertyStatement } from "@/lib/property-import";
import { NORTH_PEAK_STATEMENT } from "@/lib/property-statements/260-north-peak";

// One-shot: load the 260 North Peak Drive payment statement into the DB for the
// current account. Idempotent (keyed on address) — safe to re-trigger. Exposed
// as GET + POST so it can be run straight from a browser, matching the
// migrate-properties admin route. Run migrate-properties first if the Property /
// PropertyTransaction / Tenant tables do not exist yet.
async function run() {
  const account = await getAccount();
  const result = await importPropertyStatement(account.id, NORTH_PEAK_STATEMENT);
  return jsonResponse({
    ok: true,
    message: `${result.created ? "Created" : "Updated"} "${NORTH_PEAK_STATEMENT.nickname}" with ${result.transactions} transactions and ${result.tenants} tenant(s).`,
    ...result,
  });
}

export async function POST() {
  try {
    return await run();
  } catch (error) {
    return errorResponse(
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}

export async function GET() {
  return POST();
}
