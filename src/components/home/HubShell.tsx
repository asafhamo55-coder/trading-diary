"use client";

import { usePathname } from "next/navigation";
import {
  Building2,
  CandlestickChart,
  House,
  LayoutDashboard,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
  NavItem,
  SidebarBrand,
  SidebarCollapseToggle,
  SidebarFooter,
  SidebarNav,
  SidebarSection,
} from "@/components/ui/app-shell";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";

interface HubNavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Path prefix that marks this entry active (defaults to href). */
  match?: string;
}

/**
 * Hub navigation. Trade has no index route, so it links to its dashboard
 * but is active anywhere under /trade. "Retirement & Savings" points at
 * /savings, which is being built separately.
 */
export const HUB_NAV: { label?: string; items: HubNavLink[] }[] = [
  { items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
  {
    label: "Apps",
    items: [
      { label: "Trade", href: "/trade/dashboard", match: "/trade", icon: CandlestickChart },
      { label: "Properties", href: "/properties", icon: Building2 },
      { label: "Home", href: "/home", icon: House },
      { label: "Retirement & Savings", href: "/savings", icon: PiggyBank },
    ],
  },
];

function isActive(link: HubNavLink, pathname: string): boolean {
  const base = link.match ?? link.href;
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** The HomeownerHub-style app shell for the Home Equity hub (`/`). */
export default function HubShell({
  title = "Dashboard",
  headerActions,
  children,
}: {
  title?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <AppShell>
      <AppShellSidebar collapsible>
        <SidebarBrand href="/" logo={<Logo collapsed />}>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">Hamo</p>
            <p className="truncate text-xs font-normal text-muted-foreground">Home Equity</p>
          </div>
        </SidebarBrand>
        <SidebarNav>
          {HUB_NAV.map((group, i) => (
            <SidebarSection key={group.label ?? i} label={group.label}>
              {group.items.map((link) => {
                const Icon = link.icon;
                return (
                  <NavItem
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    icon={<Icon aria-hidden />}
                    active={isActive(link, pathname)}
                  />
                );
              })}
            </SidebarSection>
          ))}
        </SidebarNav>
        <SidebarFooter className="justify-end">
          <SidebarCollapseToggle />
        </SidebarFooter>
      </AppShellSidebar>
      <AppShellMain>
        <AppShellHeader>
          <p className="min-w-0 truncate text-sm font-medium text-foreground-secondary">{title}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {headerActions}
            <ThemeToggle collapsed />
          </div>
        </AppShellHeader>
        <AppShellContent>{children}</AppShellContent>
      </AppShellMain>
    </AppShell>
  );
}
