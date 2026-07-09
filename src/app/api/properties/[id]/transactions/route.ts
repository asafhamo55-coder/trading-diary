import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { createPropertyTransactionSchema } from "@/lib/validators";
import { getCategory } from "@/lib/property";

// POST /api/properties/[id]/transactions — add a transaction to a property
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    const property = await prisma.property.findFirst({
      where: { id, accountId: account.id },
    });
    if (!property) return errorResponse("Property not found", 404);

    const body = await req.json();
    const parsed = createPropertyTransactionSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    // Validate the category exists and matches the declared type.
    const cat = getCategory(data.category);
    if (!cat) return errorResponse("Unknown category");
    if (cat.type !== data.type)
      return errorResponse(`Category "${cat.label}" is not a valid ${data.type.toLowerCase()} category`);

    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) return errorResponse("Invalid date");

    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyId: id,
        date,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        type: data.type,
        category: data.category,
        amount: data.amount,
        description: data.description ?? null,
      },
    });
    return jsonResponse(tx, 201);
  } catch (error) {
    console.error("Create property transaction error:", error);
    return errorResponse("Failed to create transaction", 500);
  }
}
