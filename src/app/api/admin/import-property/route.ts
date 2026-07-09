import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { importPropertyStatement, type PropertyStatement } from "@/lib/property-import";
import { NORTH_PEAK_STATEMENT } from "@/lib/property-statements/260-north-peak";
import { LAUREL_CT_STATEMENT } from "@/lib/property-statements/1053-laurel-ct";

// One-shot: load every parsed property payment statement into the DB for the
// current account. Idempotent (keyed on address) — safe to re-trigger; each run
// replaces that property's transactions/tenants with the statement's contents.
// Exposed as GET + POST so it can be run straight from a browser, matching the
// migrate-properties admin route. Run migrate-properties first if the Property /
// PropertyTransaction / Tenant tables do not exist yet.
//
// Trigger one property with ?address=<full address>, or all when omitted.
const STATEMENTS: PropertyStatement[] = [NORTH_PEAK_STATEMENT, LAUREL_CT_STATEMENT];

async function run(addressFilter: string | null) {
  const account = await getAccount();
  const targets = addressFilter
    ? STATEMENTS.filter((s) => s.address === addressFilter)
    : STATEMENTS;
  if (!targets.length) {
    return errorResponse(`No statement matches address "${addressFilter}"`, 404);
  }
  const results = [];
  for (const statement of targets) {
    const result = await importPropertyStatement(account.id, statement);
    results.push({ nickname: statement.nickname, ...result });
  }
  return jsonResponse({
    ok: true,
    message: results
      .map((r) => `${r.created ? "Created" : "Updated"} "${r.nickname}" — ${r.transactions} tx, ${r.tenants} tenant(s), net ${r.net}`)
      .join(" | "),
    properties: results,
  });
}

export async function POST(req: Request) {
  try {
    const address = new URL(req.url).searchParams.get("address");
    return await run(address);
  } catch (error) {
    return errorResponse(
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}

export function GET(req: Request) {
  return POST(req);
}
