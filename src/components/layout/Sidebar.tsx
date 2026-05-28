"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  LineChart,
  Calendar,
  Briefcase,
  BookOpen,
  BarChart3,
  AlertTriangle,
  Settings,
  Wallet,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  LogOut,
  GripVertical,
  RotateCcw,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Trades", icon: LineChart, href: "/trades" },
  { label: "Monthly", icon: Calendar, href: "/monthly" },
  { label: "Portfolio", icon: Briefcase, href: "/portfolio" },
  { label: "Journal", icon: BookOpen, href: "/journal" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Assets", icon: Wallet, href: "/assets" },
  { label: "Stocks", icon: LineChart, href: "/stocks" },
  { label: "Errors", icon: AlertTriangle, href: "/errors" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

const STORAGE_KEY = "sidebar-nav-order-v1";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(NAV_ITEMS.map((i) => i.href));
  const [draggingHref, setDraggingHref] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Close mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        const known = new Set(NAV_ITEMS.map((i) => i.href));
        // Keep saved entries that still exist + append any new items
        const filtered = saved.filter((h) => known.has(h));
        const missing = NAV_ITEMS.map((i) => i.href).filter(
          (h) => !filtered.includes(h)
        );
        setOrder([...filtered, ...missing]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persistOrder(next: string[]) {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function resetOrder() {
    const def = NAV_ITEMS.map((i) => i.href);
    setOrder(def);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function handleDragStart(href: string) {
    setDraggingHref(href);
  }

  function handleDragOver(e: React.DragEvent, targetHref: string) {
    e.preventDefault();
    if (!draggingHref || draggingHref === targetHref) return;
    const next = [...order];
    const from = next.indexOf(draggingHref);
    const to = next.indexOf(targetHref);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, draggingHref);
    setOrder(next);
  }

  function handleDragEnd() {
    setDraggingHref(null);
    persistOrder(order);
  }

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const itemsByHref = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]));
  const orderedItems = order
    .map((h) => itemsByHref[h])
    .filter((i): i is typeof NAV_ITEMS[number] => Boolean(i));

  const navList = (
    <nav className="flex-1 flex flex-col gap-1 px-3 py-3 overflow-y-auto">
      {orderedItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger — fixed top-left */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className="md:hidden fixed top-3 left-3 z-40 flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] shadow-md"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] flex flex-col bg-[var(--card)] border-r border-[var(--border)] shadow-2xl"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingLeft: "env(safe-area-inset-left)",
            }}
          >
            <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3B82F6]/10">
                  <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <span className="text-[var(--foreground)] font-semibold text-sm">
                  Trading Journal Pro
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navList}
            <div className="px-3 py-4 border-t border-[var(--border)] space-y-2">
              <ThemeToggle collapsed={false} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-colors text-sm"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 border-r border-[var(--border)] bg-[var(--card)] transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--border)]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3B82F6]/10 shrink-0">
          <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
        </div>
        {!collapsed && (
          <span className="text-[var(--foreground)] font-semibold text-sm whitespace-nowrap">
            Trading Journal Pro
          </span>
        )}
      </div>

      {/* Reorder toggle */}
      {!collapsed && (
        <div className="px-3 pt-3 flex items-center justify-between">
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider transition-colors",
              editMode
                ? "text-[#3B82F6]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {editMode ? "Done reordering" : "Reorder"}
          </button>
          {editMode && (
            <button
              onClick={resetOrder}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title="Reset to default order"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3 py-3 overflow-y-auto">
        {orderedItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const isDragging = draggingHref === item.href;

          if (editMode) {
            return (
              <div
                key={item.href}
                draggable
                onDragStart={() => handleDragStart(item.href)}
                onDragOver={(e) => handleDragOver(e, item.href)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-move select-none border",
                  isDragging
                    ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6] opacity-50"
                    : "border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] hover:border-[#3B82F6]/40"
                )}
              >
                <GripVertical className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Theme + Logout + Collapse toggle */}
      <div className="px-3 py-4 border-t border-[var(--border)] space-y-2">
        <ThemeToggle collapsed={collapsed} />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[var(--muted-foreground)] hover:text-[#FF4D6A] hover:bg-[#FF4D6A]/10 transition-colors text-sm"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-sm"
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
    </>
  );
}
