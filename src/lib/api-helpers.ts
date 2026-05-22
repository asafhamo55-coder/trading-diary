import { NextResponse } from "next/server";
import { prisma } from "./db";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Get or create a default account for the current user
// In production this would use Supabase auth; for now uses a demo user
export async function getAccount(userId = "asaf") {
  let account = await prisma.account.findUnique({ where: { userId } });
  if (!account) {
    account = await prisma.account.create({
      data: {
        userId,
        startingBalance: 178600,
        accountOpenBalance: 178600,
        calendarYear: new Date().getFullYear(),
        commissionPerShare: 0.01,
        minimumCommission: 2.5,
      },
    });
  }
  return account;
}

export const tradeInclude = {
  entries: { orderBy: { legOrder: "asc" as const } },
  tradeErrors: {
    include: { errorDefinition: true },
  },
  account: {
    include: { assetLeverages: true },
  },
};
