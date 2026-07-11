import {
  getHomeAccounts,
  getHomeCategories,
  getHomeTransactions,
  autoExcludeSmall,
} from "@/lib/home-data";
import { getPropertyOptions } from "@/lib/property-data";
import { cleanDescription } from "@/lib/home-import";
import HomeReviewClient from "@/components/home/HomeReviewClient";

export const dynamic = "force-dynamic";

export interface MerchantGroup {
  merchant: string; // display label
  matcher: string; // lowercased key used to match & learn
  count: number;
  total: number; // signed sum
  ids: string[];
  sampleRaw: string;
}

export default async function HomeReviewPage() {
  await autoExcludeSmall();
  const [accounts, categories, transactions, properties] = await Promise.all([
    getHomeAccounts(),
    getHomeCategories(),
    getHomeTransactions({ needsReview: true }),
    getPropertyOptions(),
  ]);

  // Group by cleaned merchant so each unique place is decided once.
  const byMerchant = new Map<string, MerchantGroup>();
  for (const t of transactions) {
    const merchant = cleanDescription(t.rawDescription) || t.description;
    const matcher = merchant.toLowerCase();
    const g = byMerchant.get(matcher);
    if (g) {
      g.count++;
      g.total += t.amount;
      g.ids.push(t.id);
    } else {
      byMerchant.set(matcher, {
        merchant,
        matcher,
        count: 1,
        total: t.amount,
        ids: [t.id],
        sampleRaw: t.rawDescription,
      });
    }
  }
  const groups = Array.from(byMerchant.values()).sort((a, b) => b.count - a.count);

  return (
    <HomeReviewClient
      accounts={accounts}
      categories={categories}
      groups={groups}
      totalRows={transactions.length}
      properties={properties}
    />
  );
}
