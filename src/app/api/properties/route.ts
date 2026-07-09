import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { createPropertySchema } from "@/lib/validators";

// GET /api/properties — list all properties for the account
export async function GET() {
  try {
    const account = await getAccount();
    const properties = await prisma.property.findMany({
      where: { accountId: account.id },
      include: { transactions: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "asc" },
    });
    return jsonResponse(properties);
  } catch (error) {
    console.error("Fetch properties error:", error);
    return errorResponse("Failed to fetch properties", 500);
  }
}

// POST /api/properties — create a property
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = createPropertySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);

    const data = parsed.data;
    const property = await prisma.property.create({
      data: {
        accountId: account.id,
        nickname: data.nickname,
        address: data.address,
        purchasePrice: data.purchasePrice ?? null,
        purchaseDate: data.purchaseDate ?? null,
        notes: data.notes ?? null,
      },
      include: { transactions: true },
    });
    return jsonResponse(property, 201);
  } catch (error) {
    console.error("Create property error:", error);
    return errorResponse("Failed to create property", 500);
  }
}
