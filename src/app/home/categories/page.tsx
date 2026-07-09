import { getHomeCategories } from "@/lib/home-data";
import HomeCategoriesClient from "@/components/home/HomeCategoriesClient";

export const dynamic = "force-dynamic";

export default async function HomeCategoriesPage() {
  const categories = await getHomeCategories();
  return <HomeCategoriesClient categories={categories} />;
}
