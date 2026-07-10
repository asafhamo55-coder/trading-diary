import {
  getHomeAccounts,
  getHomeCategories,
  getHomeTransactions,
} from "@/lib/home-data";
import HomeReviewClient from "@/components/home/HomeReviewClient";

export const dynamic = "force-dynamic";

export default async function HomeReviewPage() {
  const [accounts, categories, transactions] = await Promise.all([
    getHomeAccounts(),
    getHomeCategories(),
    getHomeTransactions({ needsReview: true }),
  ]);

  return (
    <HomeReviewClient
      accounts={accounts}
      categories={categories}
      transactions={transactions}
    />
  );
}
