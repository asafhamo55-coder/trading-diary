import { getMonthlyPnL } from "@/lib/data";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";
import HubClient from "@/components/home/HubClient";

export const dynamic = "force-dynamic";

export default async function HomeEquityPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const account = await prisma.account.findFirst();
  const availableYears = account
    ? await getAvailableYears(account.id)
    : [new Date().getFullYear()];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);

  const tradeMonthly = await getMonthlyPnL(year);

  // Per-source monthly net. Trade is live today; Properties & Home come online
  // as those sub-apps are built, and simply add more series here.
  const monthly = tradeMonthly.map((m) => ({
    month: m.month,
    name: m.name,
    trade: m.pnl,
    properties: 0,
    home: 0,
  }));

  const tradeTotal = tradeMonthly.reduce((sum, m) => sum + m.pnl, 0);

  const sources = [
    {
      key: "trade" as const,
      label: "Hamo Trade",
      href: "/trade/dashboard",
      total: tradeTotal,
      ready: true,
      blurb: "Trading diary, per-symbol P&L, monthly reviews & analytics.",
    },
    {
      key: "properties" as const,
      label: "Hamo Properties",
      href: "/properties",
      total: 0,
      ready: false,
      blurb: "Rental income, expenses & mortgage — tax-form ready.",
    },
    {
      key: "home" as const,
      label: "Hamo Home",
      href: "/home",
      total: 0,
      ready: false,
      blurb: "Household finances rolled into the family equity picture.",
    },
  ];

  return (
    <HubClient
      monthly={monthly}
      sources={sources}
      year={year}
      availableYears={availableYears}
    />
  );
}
