// Seed script to load real trade data into the database
// Run with: npx tsx src/scripts/seed.ts

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log("Clearing existing data...");
  await prisma.tradeError.deleteMany();
  await prisma.tradeLeg.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.errorDefinition.deleteMany();
  await prisma.assetLeverage.deleteMany();
  await prisma.monthlyReview.deleteMany();
  await prisma.account.deleteMany();

  console.log("Creating account...");
  const account = await prisma.account.create({
    data: {
      userId: "asaf",
      calendarYear: 2026,
      startingBalance: 178600,
      accountOpenBalance: 178600,
      commissionPerShare: 0.01,
      minimumCommission: 2.5,
    },
  });

  console.log("Creating January monthly review...");
  await prisma.monthlyReview.create({
    data: {
      accountId: account.id,
      month: 1,
      year: 2026,
      portfolioStartValue: 178600,
      portfolioEndValue: 180103,
      useFixedRiskUnit: false,
      includeOpenTrades: true,
    },
  });

  console.log("Creating January trades...");

  // January 26 — PG LONG (Retest Long)
  await prisma.trade.create({
    data: {
      accountId: account.id,
      tradeDate: new Date("2026-01-26"),
      month: 1,
      symbol: "PG",
      direction: "LONG",
      tradeType: "Retest Long",
      isSwingContinuation: false,
      totalPositionValue: 20991,
      totalShares: 141,
      sharesInProcess: 0,
      avgBuyPrice: 148.87,
      avgSellPrice: 159.58, // weighted avg: (164.23*70 + 155.00*71) / 141
      totalPnL: 1502.58,
      riskReward: null,
      returnOnPosition: 0.0716,
      riskAmount: null,
      totalCommissions: 7.50,
      isCompleted: true,
      entryReason: "Retest scenario",
      exitReason: "Sold 50%, securing part of the return (up to 10.5%)",
      conclusions: "Trade is currently working according to plan",
      chartUrl: "https://www.tradingview.com/x/FDdojBmh/",
      dailyHigh: 150.88,
      dailyClose: 149.49,
      entries: {
        create: [
          { legType: "BUY", price: 148.87, quantity: 141, commission: 2.5, legOrder: 1 },
          { legType: "SELL", price: 164.23, quantity: 70, commission: 2.5, legOrder: 1 },
          { legType: "SELL", price: 155.00, quantity: 71, commission: 2.5, legOrder: 2 },
        ],
      },
    },
  });

  console.log("Done! Seeded 1 trade for January.");
  console.log(`Account ID: ${account.id}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
