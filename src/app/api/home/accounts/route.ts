import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { createHomeAccountSchema } from "@/lib/home-validators";
import { ensureHomeSchema } from "@/lib/home-schema";
import { seedDefaultCategories } from "@/lib/home-data";

export async function GET() {
  try {
    const account = await getAccount();
    const rows = await prisma.homeAccount.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "asc" },
    });
    return jsonResponse(rows);
  } catch (error) {
    console.error("Fetch home accounts error:", error);
    return errorResponse("Failed to fetch accounts", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = createHomeAccountSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    // First account added is a good moment to ensure schema + seed categories.
    await ensureHomeSchema();
    await seedDefaultCategories(account.id);

    const created = await prisma.homeAccount.create({
      data: {
        accountId: account.id,
        name: data.name,
        type: data.type,
        last4: data.last4 || null,
      },
    });
    return jsonResponse(created, 201);
  } catch (error) {
    console.error("Create home account error:", error);
    return errorResponse("Failed to create account", 500);
  }
}
