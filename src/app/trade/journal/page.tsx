import { getMonthlyReviews } from "@/lib/data";
import JournalClient from "@/components/journal/JournalClient";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const reviews = await getMonthlyReviews();
  return <JournalClient reviews={reviews} />;
}
