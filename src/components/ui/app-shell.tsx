"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipProvider } from "./tooltip";

/**
 * AppShell — sidebar + top bar frame, ported from HomeownerHub
 * (packages/ui/src/layouts/AppShell.tsx + components/Sidebar.tsx).
 *
 *   <AppShell>
 *     <AppShellSidebar collapsible>
 *       <SidebarBrand logo={…}>Name</SidebarBrand>
 *       <SidebarNav>
 *         <SidebarSection label="Money"><NavItem href="/" label="…" icon={…} active /></SidebarSection>
 *       </SidebarNav>
 *       <SidebarFooter><SidebarCollapseToggle /></SidebarFooter>
 *     </AppShellSidebar>
 *     <AppShellMain>
 *       <AppShellHeader>…</AppShellHeader>
 *       <AppShellContent>{children}</AppShellContent>
 *     </AppShellMain>
 *   </AppShell>
 *
 * Desktop: full-height sidebar whose contents stick to the viewport,
 * collapsible to a 60px icon rail (persisted in localStorage `sidebar`,
 * applied before paint by THEME_INIT_SCRIPT). Phone: off-canvas drawer
 * that closes on link click, Esc, back/forward and backdrop tap.
 *
 * Not ported: the ⌘K search trigger / CommandPalette (needs cmdk) and the
 * Copilot column.
 */

const SIDEBAR_KEY = "sidebar";

function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = React.useState(false);

  React.useEffect(() => {
    let v = false;
    try {
      v = window.localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    } catch {
      /* storage blocked */
    }
    // Sync React state with the attribute the init script already applied.
    setCollapsedState(v);
    if (v) document.documentElement.setAttribute("data-sidebar", "collapsed");
    else document.documentElement.removeAttribute("data-sidebar");
  }, []);

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(SIDEBAR_KEY, v ? "collapsed" : "expanded");
    } catch {
      /* not persisted */
    }
    if (v) document.documentElement.setAttribute("data-sidebar", "collapsed");
    else document.documentElement.removeAttribute("data-sidebar");
  }, []);

  return [collapsed, setCollapsed];
}

interface AppShellContextValue {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  linkAs: React.ElementType;
}

const AppShellContext = React.createContext<AppShellContextValue | null>(null);
const SidebarContext = React.createContext<{ collapsible: boolean }>({ collapsible: false });

function useAppShellStrict() {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) throw new Error("AppShell.* must be rendered inside <AppShell>");
  return ctx;
}

/** Shell state for custom chrome. Returns null outside an AppShell. */
export function useAppShell(): AppShellContextValue | null {
  return React.useContext(AppShellContext);
}

/** First focusable element: jumps past the chrome to <main id="main">. */
export function SkipLink({ href = "#main", children = "Skip to main content" }: { href?: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-fg focus:no-underline focus:shadow-lg print:hidden"
    >
      {children}
    </a>
  );
}

export function AppShell({
  children,
  className,
  linkAs = Link,
}: {
  children: React.ReactNode;
  className?: string;
  /** Router link component used by NavItem. Defaults to next/link. */
  linkAs?: React.ElementType;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  React.useEffect(() => {
    if (!mobileOpen) return;
    const close = () => setMobileOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("popstate", close);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", close);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  return (
    <AppShellContext.Provider value={{ mobileOpen, setMobileOpen, collapsed, setCollapsed, linkAs }}>
      <TooltipProvider>
        <SkipLink />
        <div className={cn("flex min-h-dvh bg-background", className)}>{children}</div>
      </TooltipProvider>
    </AppShellContext.Provider>
  );
}

export function AppShellSidebar({
  children,
  className,
  collapsible = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Allow the desktop icon-rail mode (every entry must be a NavItem). */
  collapsible?: boolean;
}) {
  const { mobileOpen, setMobileOpen } = useAppShellStrict();
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!mobileOpen) return;
    ref.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
  }, [mobileOpen]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[rgb(10_15_26/0.45)] backdrop-blur-[2px] transition-opacity duration-200 md:hidden print:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <aside
        ref={ref}
        data-collapsible={collapsible || undefined}
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r border-border bg-surface",
          "transition-[transform,width,visibility] duration-[260ms] ease-emphasized",
          "md:relative md:inset-auto md:z-30 md:shrink-0 md:self-stretch md:w-sidebar md:max-w-none md:translate-x-0",
          collapsible && "md:sidebar-collapsed:w-sidebar-collapsed",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full max-md:invisible",
          "print:hidden",
          className
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        aria-label="Primary navigation"
        onClickCapture={(e) => {
          if (mobileOpen && (e.target as HTMLElement).closest("a[href]")) setMobileOpen(false);
        }}
      >
        <div className="flex h-full min-h-0 flex-col md:sticky md:top-0 md:h-dvh">
          <SidebarContext.Provider value={{ collapsible }}>{children}</SidebarContext.Provider>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-1.5 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-label="Close navigation"
          tabIndex={mobileOpen ? 0 : -1}
        >
          <X className="size-4" aria-hidden />
        </button>
      </aside>
    </>
  );
}

/** Desktop-only collapse/expand control. Put it in SidebarFooter. */
export function SidebarCollapseToggle({ className }: { className?: string }) {
  const { collapsed, setCollapsed } = useAppShellStrict();
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <Tooltip content={label} side="right" shortcut="⌘\">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={label}
        aria-pressed={collapsed}
        className={cn(
          "hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground md:inline-flex",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </Tooltip>
  );
}

export function AppShellMain({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-1 flex-col", className)}>{children}</div>;
}

export function AppShellHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  const { mobileOpen, setMobileOpen, collapsed, setCollapsed } = useAppShellStrict();

  // ⌘\ / Ctrl+\ toggles the desktop sidebar.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, setCollapsed]);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4 md:px-6 print:hidden",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground-secondary hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
      >
        <Menu className="size-5" aria-hidden />
        <span>{mobileOpen ? "Close" : "Menu"}</span>
      </button>
      {children}
    </header>
  );
}

export function AppShellContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className={cn("flex-1 px-4 pb-16 pt-6 focus:outline-none sm:px-6 md:pt-8 lg:px-8 print:p-0", className)}
    >
      {children}
    </main>
  );
}

/* ── Sidebar building blocks ─────────────────────────────────────────── */

export function SidebarBrand({
  children,
  logo,
  href,
  className,
}: {
  /** Name / subtitle. Hidden when the sidebar is a rail. */
  children: React.ReactNode;
  /** Square mark shown in both expanded and rail modes. */
  logo?: React.ReactNode;
  /** When set, the logo links here. */
  href?: string;
  className?: string;
}) {
  const shell = useAppShell();
  const LinkAs: React.ElementType = shell?.linkAs ?? "a";
  return (
    <div
      className={cn(
        "flex h-topbar shrink-0 items-center gap-2.5 px-3 text-sm font-semibold text-foreground",
        "md:in-rail:justify-center md:in-rail:px-0",
        className
      )}
    >
      {logo ? (
        <div className="shrink-0">
          {href ? (
            <LinkAs
              href={href}
              aria-label="Home"
              title="Home"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {logo}
            </LinkAs>
          ) : (
            logo
          )}
        </div>
      ) : null}
      <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", logo && "md:in-rail:hidden")}>{children}</div>
    </div>
  );
}

export function SidebarNav({
  children,
  className,
  "aria-label": ariaLabel = "Sidebar",
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <nav
      className={cn(
        "flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-3 py-3 scrollbar-none md:in-rail:px-2",
        className
      )}
      aria-label={ariaLabel}
    >
      {children}
    </nav>
  );
}

export function SidebarSection({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <>
          <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground md:in-rail:hidden">{label}</p>
          <div aria-hidden className="mx-2 mb-1 hidden h-px bg-border md:in-rail:block" />
        </>
      ) : null}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

export interface NavItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  icon?: React.ReactNode;
  label: string;
  /** Count or short marker on the right. Becomes a dot in the rail. */
  badge?: React.ReactNode;
  active?: boolean;
  /** Router link component. Defaults to AppShell's `linkAs`. */
  linkAs?: React.ElementType;
}

export const NavItem = React.forwardRef<HTMLAnchorElement, NavItemProps>(
  ({ icon, label, badge, active, className, children, linkAs, ...props }, ref) => {
    const shell = useAppShell();
    const { collapsible } = React.useContext(SidebarContext);
    const LinkAs: React.ElementType = linkAs ?? shell?.linkAs ?? "a";
    const inRail = Boolean(shell?.collapsed && collapsible);
    const hasBadge = badge !== undefined && badge !== null && badge !== false && badge !== 0;

    const link = (
      <LinkAs
        ref={ref}
        className={cn(
          "group/nav relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium no-underline outline-none transition-colors duration-150 md:h-8",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          active
            ? "bg-subtle text-foreground [&_svg]:text-primary"
            : "text-foreground-secondary hover:bg-subtle hover:text-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground-secondary",
          "md:in-rail:justify-center md:in-rail:px-0",
          className
        )}
        aria-current={active ? "page" : undefined}
        {...props}
      >
        {active ? (
          <span aria-hidden className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-primary md:in-rail:-left-2" />
        ) : null}
        {icon ? <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span> : null}
        <span className="flex-1 truncate md:in-rail:sr-only">{label}</span>
        {hasBadge ? (
          <>
            <span className="num ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle px-1.5 text-xs font-semibold text-primary md:in-rail:hidden">
              {badge}
            </span>
            <span aria-hidden className="absolute right-1.5 top-1.5 hidden size-1.5 rounded-full bg-primary md:in-rail:block" />
          </>
        ) : null}
        {children}
      </LinkAs>
    );

    return (
      <li>
        <Tooltip content={label} side="right" disabled={!inRail}>
          {link}
        </Tooltip>
      </li>
    );
  }
);
NavItem.displayName = "NavItem";

export function SidebarFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 border-t border-border p-2",
        "md:in-rail:flex-col md:in-rail:px-0",
        className
      )}
    >
      {children}
    </div>
  );
}
