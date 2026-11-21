import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Bearer-token auth for machine callers of the savings module (the daily
// Claude Code advisor routine, the import-statements skill). These routes are
// listed in PUBLIC_PATHS in src/proxy.ts, so each one must call this itself.

export const SAVINGS_TOKEN_ENV = "SAVINGS_INGEST_TOKEN";

/** "ok" when the request carries `Authorization: Bearer $SAVINGS_INGEST_TOKEN`. */
export function checkSavingsToken(req: NextRequest): "ok" | "unconfigured" | "denied" {
  const expected = process.env[SAVINGS_TOKEN_ENV];
  if (!expected) return "unconfigured";
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}
