"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, BarChart3, Sparkles, ClipboardCheck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Ledger", icon: List, href: "/home", exact: true },
  { label: "Insights", icon: BarChart3, href: "/home/insights" },
  { label: "Coach", icon: Sparkles, href: "/home/coach" },
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
            aria-current={active ? "page" : undefined}
            className="pressable relative flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[3.25rem]"
          >
            {active && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#00D68F] shadow-[0_0_8px_#00D68F]" />
            )}
            <span
              className={cn(
                "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
                active ? "bg-[#00D68F]/12" : "bg-transparent"
              )}
            >
              <tab.icon
                className={cn(
                  "w-[22px] h-[22px] transition-colors",
                  active ? "text-[#00D68F]" : "text-[var(--muted-foreground)]"
                )}
              />
            </span>
            <span
              className={cn(
                "text-[10px] leading-none transition-colors",
                active
                  ? "text-[#00D68F] font-semibold"
                  : "text-[var(--muted-foreground)] font-medium"
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
