import { getAllTrades, getAccount, getMonthlyReviews } from "@/lib/data";
import PortfolioClient from "@/components/portfolio/PortfolioClient";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const [trades, account, reviews] = await Promise.all([
    getAllTrades(),
    getAccount(),
    getMonthlyReviews(),
  ]);
  return <PortfolioClient trades={trades} account={account} reviews={reviews} />;
}
