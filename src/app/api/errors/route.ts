import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { errorDefinitionSchema } from "@/lib/validators";

// GET /api/errors — list all error definitions
export async function GET() {
  try {
    const account = await getAccount();
    const errors = await prisma.errorDefinition.findMany({
      where: { accountId: account.id },
      include: {
        tradeErrors: {
          include: {
            trade: {
              select: { totalPnL: true },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    const result = errors.map((e) => ({
      id: e.id,
      name: e.name,
      sortOrder: e.sortOrder,
      tradeCount: e.tradeErrors.length,
      totalPnLImpact: e.tradeErrors.reduce(
        (sum, te) => sum + (te.trade.totalPnL ?? 0),
        0
      ),
    }));

    return jsonResponse(result);
  } catch (error) {
    return errorResponse("Failed to fetch errors", 500);
  }
}

// POST /api/errors — create new error definition
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const parsed = errorDefinitionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.message);
    }

    const errorDef = await prisma.errorDefinition.create({
      data: {
        accountId: account.id,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
      },
    });

    return jsonResponse(errorDef, 201);
  } catch (error) {
    return errorResponse("Failed to create error definition", 500);
  }
}
