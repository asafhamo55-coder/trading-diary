import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";

// GET /api/funds — list fund transactions
export async function GET() {
  try {
    const account = await getAccount();
    const txs = await prisma.fundTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { occurredAt: "desc" },
    });
    return jsonResponse({
      transactions: txs.map((t) => ({
        ...t,
        occurredAt: t.occurredAt.toISOString().slice(0, 10),
        createdAt: t.createdAt.toISOString(),
      })),
      netAdjustment: txs.reduce((s, t) => s + t.amount, 0),
    });
  } catch (error) {
    return errorResponse(
      `Failed to list funds: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}

// POST /api/funds — add a deposit or withdrawal
// body: { amount: number (positive=deposit, negative=withdrawal), occurredAt: "YYYY-MM-DD", comment?: string }
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = (await req.json()) as {
      amount?: number;
      occurredAt?: string;
      comment?: string;
    };
    if (typeof body.amount !== "number" || body.amount === 0) {
      return errorResponse("amount must be a non-zero number");
    }
    if (!body.occurredAt) {
      return errorResponse("occurredAt is required (YYYY-MM-DD)");
    }
    const tx = await prisma.fundTransaction.create({
      data: {
        accountId: account.id,
        amount: body.amount,
        comment: body.comment?.trim() || null,
        occurredAt: new Date(body.occurredAt + "T00:00:00Z"),
      },
    });
    return jsonResponse(
      {
        ...tx,
        occurredAt: tx.occurredAt.toISOString().slice(0, 10),
        createdAt: tx.createdAt.toISOString(),
      },
      201
    );
  } catch (error) {
    return errorResponse(
      `Failed to create fund transaction: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}
