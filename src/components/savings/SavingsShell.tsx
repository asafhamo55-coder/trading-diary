"use client";

import { usePathname } from "next/navigation";
import AppNavShell from "@/components/layout/AppNavShell";
import { Tabs } from "@/components/ui/tabs";
import { NAV_AREAS, resolveNav } from "@/lib/nav";

/** Section pages, from the shared nav config (src/lib/nav.ts). */
export const SAVINGS_SECTIONS = NAV_AREAS.find((a) => a.id === "savings")?.pages ?? [];

/** The shared app shell + the section tabs every /savings page has. */
export default function SavingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/savings";
  const current = resolveNav(pathname).page ?? SAVINGS_SECTIONS[0];
  return (
    <AppNavShell>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Tabs
          aria-label="Retirement & Savings sections"
          items={SAVINGS_SECTIONS.map((s) => ({ label: s.label, href: s.href, active: s.href === current?.href }))}
        />
        {children}
      </div>
    </AppNavShell>
  );
}
