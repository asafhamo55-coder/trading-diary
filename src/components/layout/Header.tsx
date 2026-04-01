"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { getDemoStats } from "@/lib/demo-data";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const stats = getDemoStats();

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-[#2A3040] bg-[#151921]">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-[#8892A6] hover:text-[#E8ECF4] hover:bg-[#1C2130] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-[#E8ECF4]">{title}</h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Portfolio value */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-xs text-[#8892A6]">Portfolio</span>
          <span className="text-sm font-semibold text-[#E8ECF4] font-data">
            {formatCurrency(stats.currentPortfolio)}
          </span>
        </div>

        {/* New Trade button */}
        <Link
          href="/trades/new"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            "bg-[#3B82F6] text-white hover:bg-[#3B82F6]/90"
          )}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Trade</span>
        </Link>
      </div>
    </header>
  );
}
