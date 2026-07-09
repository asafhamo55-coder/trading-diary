import { getAccount } from "@/lib/data";
import { prisma } from "@/lib/db";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const account = await getAccount();

  // Asset leverages
  const leverages = await prisma.assetLeverage
    .findMany({
      where: { accountId: account.id },
      orderBy: { symbol: "asc" },
    })
    .catch(() => []);

  // Fund transactions (may not exist if migration hasn't run)
  let funds: {
    id: string;
    amount: number;
    comment: string | null;
    occurredAt: string;
  }[] = [];
  let fundsMigrationNeeded = false;
  try {
    const txs = await prisma.fundTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { occurredAt: "desc" },
    });
    funds = txs.map((t) => ({
      id: t.id,
      amount: t.amount,
      comment: t.comment,
      occurredAt: t.occurredAt.toISOString().slice(0, 10),
    }));
  } catch {
    fundsMigrationNeeded = true;
  }

  return (
    <SettingsClient
      account={{
        calendarYear: account.calendarYear,
        startingBalance: account.startingBalance,
        accountOpenBalance: account.accountOpenBalance,
        commissionPerShare: account.commissionPerShare,
        minimumCommission: account.minimumCommission,
      }}
      leverages={leverages.map((l) => ({
        id: l.id,
        symbol: l.symbol,
        leverage: l.leverage,
      }))}
      funds={funds}
      fundsMigrationNeeded={fundsMigrationNeeded}
    />
  );
}
