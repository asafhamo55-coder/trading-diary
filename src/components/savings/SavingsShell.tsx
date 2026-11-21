"use client";

import { usePathname } from "next/navigation";
import HubShell from "@/components/home/HubShell";
import { Tabs } from "@/components/ui/tabs";

export const SAVINGS_SECTIONS = [
  { label: "Accounts", href: "/savings", title: "Retirement & Savings" },
  { label: "Profile & goals", href: "/savings/profile", title: "Household profile & goals" },
  { label: "Benefits & insurance", href: "/savings/benefits", title: "Benefits & insurance" },
  { label: "Import", href: "/savings/import", title: "Import statements" },
] as const;

/** HubShell + the section tabs shared by every /savings page. */
export default function SavingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/savings";
  const current =
    [...SAVINGS_SECTIONS].reverse().find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`)) ??
    SAVINGS_SECTIONS[0];
  return (
    <HubShell title={current.title}>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Tabs
          aria-label="Retirement & Savings sections"
          items={SAVINGS_SECTIONS.map((s) => ({ label: s.label, href: s.href, active: s.href === current.href }))}
        />
        {children}
      </div>
    </HubShell>
  );
}
