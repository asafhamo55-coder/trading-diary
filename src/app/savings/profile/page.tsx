import type { Metadata } from "next";
import ProfileEditor from "@/components/savings/ProfileEditor";

export const metadata: Metadata = { title: "Household profile & goals · Hamo" };

export default function SavingsProfilePage() {
  return <ProfileEditor />;
}
