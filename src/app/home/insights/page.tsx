import { getHomeInsights, getHomeYears, autoExcludeSmall } from "@/lib/home-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import HomeInsightsClient from "@/components/home/HomeInsightsClient";

export const dynamic = "force-dynamic";

export default async function HomeInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  await autoExcludeSmall();
  const years = await getHomeYears();
  const currentYear = new Date().getFullYear();
  const availableYears = years.length ? years : [currentYear];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);

  const insights = await getHomeInsights(year);

  return (
    <HomeInsightsClient
      insights={insights}
      year={year}
      availableYears={availableYears}
    />
  );
}
