import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };
    if (typeof password !== "string" || !password) {
      return NextResponse.json(
        { error: "Password required" },
        { status: 400 }
      );
    }

    const expected = await expectedAuthCookie();
    if (!expected) {
      return NextResponse.json(
        { error: "Auth not configured (APP_PASSWORD missing)" },
        { status: 503 }
      );
    }

    const ok = await verifyPassword(password);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
