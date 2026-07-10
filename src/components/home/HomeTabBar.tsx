"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, BarChart3, ClipboardCheck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Ledger", icon: List, href: "/home", exact: true },
  { label: "Insights", icon: BarChart3, href: "/home/insights" },
  { label: "Review", icon: ClipboardCheck, href: "/home/review" },
  { label: "Categories", icon: Tag, href: "/home/categories" },
];

export default function HomeTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-[var(--border)] bg-[var(--card)]/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="pressable relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem]"
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#00D68F]" />}
            <tab.icon
              className={cn(
                "w-[22px] h-[22px] transition-colors",
                active ? "text-[#00D68F]" : "text-[var(--muted-foreground)]"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium leading-none",
                active ? "text-[#00D68F]" : "text-[var(--muted-foreground)]"
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
