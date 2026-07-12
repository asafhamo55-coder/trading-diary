import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthCookie } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  // Token-authenticated (INGEST_TOKEN bearer) — used by the Gmail add-on, which
  // can't carry the app password cookie. The route enforces its own auth.
  "/api/trades/ingest-email",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const expected = await expectedAuthCookie();
  if (!expected) {
    // APP_PASSWORD not configured — block everything except login
    if (pathname !== "/login") {
      const url = new URL("/login", req.url);
      url.searchParams.set("error", "unconfigured");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie !== expected) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except Next internals and static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
