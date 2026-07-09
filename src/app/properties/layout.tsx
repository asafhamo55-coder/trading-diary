import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function PropertiesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-30"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home Equity</span>
          </Link>
          <span className="text-[var(--border)]">/</span>
          <Logo accentWord="Properties" />
        </div>
        <ThemeToggle collapsed />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
