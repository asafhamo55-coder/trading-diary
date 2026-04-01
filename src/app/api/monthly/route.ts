import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";

// GET /api/monthly — get all monthly reviews
export async function GET() {
  try {
    const account = await getAccount();
    const reviews = await prisma.monthlyReview.findMany({
      where: { accountId: account.id },
      orderBy: { month: "asc" },
    });
    return jsonResponse(reviews);
  } catch (error) {
    return errorResponse("Failed to fetch monthly reviews", 500);
  }
}
