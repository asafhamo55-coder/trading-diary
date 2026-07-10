import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";

/**
 * Shared sub-app top bar (Hamo Properties, Hamo Home, …). A clean, native
 * app-bar: a subtle back-to-hub control, a module-accent icon chip, the module
 * title with the product name beneath it, and right-aligned actions + theme.
 */
export default function AppBar({
  title,
  subtitle = "Hamo Home Equity",
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 h-16 px-3 md:px-6 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/70"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <Link
          href="/"
          aria-label="Back to Home Equity"
          className="pressable flex items-center justify-center w-9 h-9 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors shrink-0"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </Link>
        <span
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 shadow-sm"
          style={{ background: `${accent}1F`, color: accent }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] truncate">
            {title}
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)] truncate">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <ThemeToggle collapsed />
      </div>
    </header>
  );
}
