import { getMonthlyTradeRevExp } from "@/lib/data";
import { getPropertyMonthlyRevExp } from "@/lib/property-data";
import { getHomeMonthlyRevExp } from "@/lib/home-data";
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

  const [tradeMonthly, propertyMonthly, homeMonthly] = await Promise.all([
    getMonthlyTradeRevExp(year),
    getPropertyMonthlyRevExp(year),
    getHomeMonthlyRevExp(year),
  ]);

  // Per-source monthly revenue & expense. All three modules are live and fill
  // in their own figures as data arrives.
  const zero = { revenue: 0, expense: 0 };
  const monthly = tradeMonthly.map((m, i) => ({
    month: m.month,
    name: m.name,
    trade: { revenue: m.revenue, expense: m.expense },
    properties: propertyMonthly[i] ?? zero,
    home: homeMonthly[i] ?? zero,
  }));

  const sumNet = (rows: { revenue: number; expense: number }[]) =>
    rows.reduce((sum, r) => sum + r.revenue - r.expense, 0);
  const tradeTotal = sumNet(tradeMonthly);
  const propertyTotal = sumNet(propertyMonthly);
  const homeTotal = sumNet(homeMonthly);

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
      total: propertyTotal,
      ready: true,
      blurb: "Rental income, expenses & mortgage — tax-form ready.",
    },
    {
      key: "home" as const,
      label: "Hamo Home",
      href: "/home",
      total: homeTotal,
      ready: true,
      blurb: "Bank & card statements, categorized spending & cash flow.",
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
