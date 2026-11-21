import type { NextRequest } from "next/server";
import { AUTH_COOKIE, expectedAuthCookie } from "./auth";

/**
 * Cookie check for the user-facing /api/assistant/questions routes. src/proxy.ts
 * already enforces the app-password cookie on them (they are not in
 * PUBLIC_PATHS); this re-checks in the route as defense in depth, the same
 * way /api/savings/import does.
 */
export async function hasAppCookie(req: NextRequest): Promise<boolean> {
  const expected = await expectedAuthCookie();
  return !!expected && req.cookies.get(AUTH_COOKIE)?.value === expected;
}
