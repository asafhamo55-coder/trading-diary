import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { AUTH_COOKIE, expectedAuthCookie } from "@/lib/auth";
import { getAdvisorActionStatuses, setAdvisorActionStatus } from "@/lib/savings-data";

// Ticked advisor action items. Cookie-authenticated: this path is not in
// PUBLIC_PATHS, so src/proxy.ts already rejects requests without the app
// cookie; the route re-checks so it stays safe if the proxy list changes.
//
// GET  /api/savings/advisor/actions → { statuses: { [actionKey]: { done, doneAt } } }
// PUT  /api/savings/advisor/actions   { recId, task, done, reportId? } → { key, done, doneAt }
// The key is derived on the server from recId + task (actionKey in
// src/lib/advisor-report.ts), so it survives daily report regeneration.

async function authorized(req: NextRequest): Promise<boolean> {
  const expected = await expectedAuthCookie();
  return !!expected && req.cookies.get(AUTH_COOKIE)?.value === expected;
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return errorResponse("Unauthorized", 401);
  try {
    return jsonResponse({ statuses: await getAdvisorActionStatuses() });
  } catch (error) {
    console.error("Advisor actions GET error:", error);
    return errorResponse("Failed to load action items", 500);
  }
}

export async function PUT(req: NextRequest) {
  if (!(await authorized(req))) return errorResponse("Unauthorized", 401);
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const recId = typeof body?.recId === "string" ? body.recId.trim() : "";
    const task = typeof body?.task === "string" ? body.task.trim() : "";
    if (!recId || !task || typeof body?.done !== "boolean") return errorResponse("Body needs recId, task and done (boolean)");
    if (recId.length > 200 || task.length > 2000) return errorResponse("recId or task too long");
    const reportId = typeof body.reportId === "string" ? body.reportId.slice(0, 64) : null;
    return jsonResponse(await setAdvisorActionStatus({ recId, task, done: body.done, reportId }));
  } catch (error) {
    console.error("Advisor actions PUT error:", error);
    return errorResponse("Failed to save action item", 500);
  }
}
