import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getAccount } from "@/lib/api-helpers";
import { toPropertyNavItems } from "@/lib/property-nav";

export const dynamic = "force-dynamic";

// GET /api/properties/nav — the active properties for the sidebar tree.
// Cookie-authenticated by the proxy like every other non-public route.
// Small and private: the browser may reuse it for a minute.
export async function GET() {
  try {
    const account = await getAccount();
    const properties = await prisma.property.findMany({
      where: { accountId: account.id, archivedAt: null },
      select: {
        id: true,
        nickname: true,
        address: true,
        street: true,
        unit: true,
        city: true,
        state: true,
        zip: true,
        usage: true,
        archivedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(toPropertyNavItems(properties), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("Property nav error:", error);
    return errorResponse("Failed to load properties", 500);
  }
}
