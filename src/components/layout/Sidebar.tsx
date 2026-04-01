"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  LineChart,
  Calendar,
  Briefcase,
  BookOpen,
  BarChart3,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Trades", icon: LineChart, href: "/trades" },
  { label: "Monthly", icon: Calendar, href: "/monthly" },
  { label: "Portfolio", icon: Briefcase, href: "/portfolio" },
  { label: "Journal", icon: BookOpen, href: "/journal" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Errors", icon: AlertTriangle, href: "/errors" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 border-r border-[#2A3040] bg-[#151921] transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#2A3040]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3B82F6]/10 shrink-0">
          <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
        </div>
        {!collapsed && (
          <span className="text-[#E8ECF4] font-semibold text-sm whitespace-nowrap">
            Trading Journal Pro
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "text-[#8892A6] hover:text-[#E8ECF4] hover:bg-[#1C2130]"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-4 border-t border-[#2A3040]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-[#8892A6] hover:text-[#E8ECF4] hover:bg-[#1C2130] transition-colors text-sm"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
