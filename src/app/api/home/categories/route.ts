import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { createHomeCategorySchema } from "@/lib/home-validators";

export async function GET() {
  try {
    const account = await getAccount();
    const rows = await prisma.homeCategory.findMany({
      where: { accountId: account.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return jsonResponse(rows);
  } catch (error) {
    console.error("Fetch home categories error:", error);
    return errorResponse("Failed to fetch categories", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = createHomeCategorySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    // A child inherits its parent's kind; a new parent defaults to SPENDING.
    let kind = data.kind ?? "SPENDING";
    let color = data.color ?? null;
    if (data.parentId) {
      const parent = await prisma.homeCategory.findFirst({
        where: { id: data.parentId, accountId: account.id },
      });
      if (!parent) return errorResponse("Parent category not found");
      if (parent.parentId) return errorResponse("Categories are only two levels deep");
      kind = parent.kind;
      color = color ?? parent.color;
    }

    const maxSort = await prisma.homeCategory.aggregate({
      where: { accountId: account.id, parentId: data.parentId ?? null },
      _max: { sortOrder: true },
    });

    const created = await prisma.homeCategory.create({
      data: {
        accountId: account.id,
        name: data.name,
        parentId: data.parentId ?? null,
        kind,
        color,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        isSystem: false,
      },
    });
    return jsonResponse(created, 201);
  } catch (error) {
    console.error("Create home category error:", error);
    return errorResponse("Failed to create category", 500);
  }
}
