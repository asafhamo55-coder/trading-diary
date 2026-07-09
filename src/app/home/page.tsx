import {
  getHomeAccounts,
  getHomeCategories,
  getHomeTransactions,
  getHomeYears,
  getReviewCount,
} from "@/lib/home-data";
import { parseYear, resolveSelectedYear } from "@/lib/year";
import HomeClient from "@/components/home/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;

  const [accounts, categories, years, reviewCount] = await Promise.all([
    getHomeAccounts(),
    getHomeCategories(),
    getHomeYears(),
    getReviewCount(),
  ]);

  const currentYear = new Date().getFullYear();
  const availableYears = years.length ? years : [currentYear];
  const year = resolveSelectedYear(parseYear(sp.year), availableYears);

  const transactions = await getHomeTransactions({ year });

  return (
    <HomeClient
      accounts={accounts}
      categories={categories}
      transactions={transactions}
      year={year}
      availableYears={availableYears}
      reviewCount={reviewCount}
    />
  );
}
