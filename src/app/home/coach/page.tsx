import { getHomeInsights, getHomeYears, autoExcludeSmall } from "@/lib/home-data";
import { getPropertyYearNet } from "@/lib/property-data";
import { buildRecommendations, coachSummary } from "@/lib/home-coach";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import HomeCoachClient from "@/components/home/HomeCoachClient";

export const dynamic = "force-dynamic";

export default async function HomeCoachPage({
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

  const [insights, propertyNet] = await Promise.all([
    getHomeInsights(year),
    getPropertyYearNet(year),
  ]);

  const summary = coachSummary(insights);
  const recommendations = buildRecommendations(insights, propertyNet);
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

  return (
    <HomeCoachClient
      summary={summary}
      recommendations={recommendations}
      hasData={insights.hasData}
      year={year}
      availableYears={availableYears}
      aiConfigured={aiConfigured}
    />
  );
}
