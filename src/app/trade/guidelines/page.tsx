import type { Metadata } from "next";
import GuidelinesClient from "@/components/guidelines/GuidelinesClient";
import { getGuidelineStatus, type GuidelineStatusPayload } from "@/lib/guidelines-data";

export const metadata: Metadata = { title: "Guidelines · Trade · Hamo" };
export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  let status: GuidelineStatusPayload | null = null;
  let error: string | null = null;
  try {
    status = await getGuidelineStatus();
  } catch (e) {
    console.error("Guidelines page:", e);
    error = "The trade database is unavailable right now.";
  }
  return <GuidelinesClient initial={status} error={error} />;
}
