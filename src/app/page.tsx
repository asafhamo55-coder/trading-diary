import { getMonthlyTradeRevExp } from "@/lib/data";
import { getPropertyMonthlyRevExp } from "@/lib/property-data";
import { getHomeMonthlyRevExp } from "@/lib/home-data";
import { prisma } from "@/lib/db";
import { getAvailableYears, parseYear, resolveSelectedYear } from "@/lib/year";
import { agg, equitySummary, buildEquityRecommendations, type EquityData } from "@/lib/equity-coach";
import { hasLLMKey } from "@/lib/llm";
import { todayInEastern } from "@/lib/utils";
import HubClient from "@/components/home/HubClient";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const zeroRevExp = { revenue: 0, expense: 0 };

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

  // Consolidated equity analysis across all three modules.
  const equityData: EquityData = {
    trade: agg(tradeMonthly),
    properties: agg(propertyMonthly),
    home: agg(homeMonthly),
    monthly: monthly.map((m) => ({
      name: m.name,
      net:
        m.trade.revenue - m.trade.expense +
        (m.properties.revenue - m.properties.expense) +
        (m.home.revenue - m.home.expense),
    })),
    year,
  };
  const summary = equitySummary(equityData);
  const recommendations = buildEquityRecommendations(equityData);
  const aiConfigured = hasLLMKey();
  const hasData = summary.totalIncome !== 0 || summary.totalExpense !== 0;

  // Month-to-date widget — always the real current calendar month (Eastern),
  // independent of the year picker. Reuse the fetched data when the selected
  // year is the current year; otherwise fetch the current year's figures.
  const todayET = todayInEastern();
  const nowYear = Number(todayET.slice(0, 4));
  const nowMonth = Number(todayET.slice(5, 7)); // 1–12
  const nowDay = Number(todayET.slice(8, 10));

  let mtdSource = monthly;
  if (year !== nowYear) {
    const [t, p, h] = await Promise.all([
      getMonthlyTradeRevExp(nowYear),
      getPropertyMonthlyRevExp(nowYear),
      getHomeMonthlyRevExp(nowYear),
    ]);
    mtdSource = t.map((m, i) => ({
      month: m.month,
      name: m.name,
      trade: { revenue: m.revenue, expense: m.expense },
      properties: p[i] ?? zeroRevExp,
      home: h[i] ?? zeroRevExp,
    }));
  }
  const mtdRow = mtdSource[nowMonth - 1];
  const mtd = {
    monthName: MONTH_NAMES[nowMonth - 1],
    year: nowYear,
    asOf: `${mtdRow.name} ${nowDay}`,
    trade: mtdRow.trade,
    properties: mtdRow.properties,
    home: mtdRow.home,
  };

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
      summary={summary}
      recommendations={recommendations}
      aiConfigured={aiConfigured}
      hasData={hasData}
      mtd={mtd}
    />
  );
}
