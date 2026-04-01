import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { monthlyReviewSchema } from "@/lib/validators";

// GET /api/monthly/[month]/review
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month: monthStr } = await params;
    const month = parseInt(monthStr);
    const account = await getAccount();

    const review = await prisma.monthlyReview.findUnique({
      where: {
        accountId_month_year: {
          accountId: account.id,
          month,
          year: account.calendarYear,
        },
      },
    });

    return jsonResponse(review || { month, year: account.calendarYear });
  } catch (error) {
    return errorResponse("Failed to fetch review", 500);
  }
}

// PUT /api/monthly/[month]/review
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month: monthStr } = await params;
    const month = parseInt(monthStr);
    const account = await getAccount();
    const body = await req.json();
    const parsed = monthlyReviewSchema.safeParse({ ...body, month });

    if (!parsed.success) {
      return errorResponse(parsed.error.message);
    }

    const data = parsed.data;

    const review = await prisma.monthlyReview.upsert({
      where: {
        accountId_month_year: {
          accountId: account.id,
          month,
          year: data.year,
        },
      },
      update: data,
      create: {
        ...data,
        accountId: account.id,
      },
    });

    return jsonResponse(review);
  } catch (error) {
    return errorResponse("Failed to save review", 500);
  }
}
