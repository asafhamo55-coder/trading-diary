import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSavingsReady } from "@/lib/savings-data";

// Daily Vercel Cron ping (see vercel.json). Supabase pauses free-tier projects
// after a stretch of inactivity; one real query a day keeps the database awake.
// Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  // Also applies the idempotent savings/property DDL, so a fresh deploy's new
  // columns exist before anyone opens a page.
  await ensureSavingsReady();
  const accounts = await prisma.account.count();
  return NextResponse.json({ ok: true, accounts, ms: Date.now() - started, at: new Date().toISOString() });
}
