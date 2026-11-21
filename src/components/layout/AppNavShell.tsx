"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
  SidebarBrand,
  SidebarCollapseToggle,
  SidebarFooter,
  SidebarNav,
  SidebarSection,
  useAppShell,
} from "@/components/ui/app-shell";
import { Tooltip } from "@/components/ui/tooltip";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { CurrencyToggle } from "@/components/ui/currency";
import { NAV, buildCrumbs, resolveNav, type Crumb, type NavArea, type NavPage } from "@/lib/nav";
import { cn } from "@/lib/utils";

/* ── Page-supplied breadcrumb detail ("12 Oak St", "AAPL › Edit") ───────── */

interface DetailState {
  path: string;
  items: Crumb[];
}

const CrumbContext = React.createContext<React.Dispatch<React.SetStateAction<DetailState | null>> | null>(null);

/**
 * Adds a detail title to the top-bar breadcrumbs for the current page, e.g.
 * `<PageCrumbs items={[{ label: property.title }]} />`. Renders nothing; safe
 * in server pages (it is a client component).
 */
export function PageCrumbs({ items }: { items: Crumb[] }) {
  const set = React.useContext(CrumbContext);
  const pathname = usePathname() ?? "/";
  const key = JSON.stringify(items);
  React.useEffect(() => {
    if (!set) return;
    set({ path: pathname, items: JSON.parse(key) as Crumb[] });
    return () => set((cur) => (cur && cur.path === pathname ? null : cur));
  }, [set, pathname, key]);
  return null;
}

/* ── Sidebar ─────────────────────────────────────────────────────────── */

const rowBase =
  "group/nav relative flex items-center gap-2.5 rounded-lg px-2.5 text-sm no-underline outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0 md:in-rail:justify-center md:in-rail:px-0";

function RailTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  const shell = useAppShell();
  return (
    <Tooltip content={label} side="right" disabled={!shell?.collapsed}>
      {children}
    </Tooltip>
  );
}

function AreaItem({
  area,
  current,
  exact,
  activePage,
  expanded,
  onToggle,
}: {
  area: NavArea;
  current: boolean;
  exact: boolean;
  activePage: NavPage | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = area.icon;
  const pages = area.pages ?? [];
  // A single sub-page is the area itself; don't repeat it underneath.
  const hasChildren = pages.length > 1;
  const listId = `nav-${area.id}-pages`;
  // aria-current: "page" when the area link IS this page; "true" when we are
  // somewhere inside the area (e.g. a property's detail page).
  const areaCurrent = current ? (!hasChildren && (exact || pages.length === 0) ? "page" : "true") : undefined;

  return (
    <li>
      <div className="relative flex items-center">
        <RailTooltip label={area.label}>
          <Link
            href={area.href}
            aria-current={areaCurrent}
            className={cn(
              rowBase,
              "h-9 min-w-0 flex-1 md:h-8",
              current
                ? "font-semibold text-foreground [&_svg]:text-primary"
                : "font-medium text-foreground-secondary hover:bg-subtle hover:text-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground-secondary",
              current && !hasChildren && "bg-subtle",
              current && hasChildren && "md:in-rail:bg-subtle",
              hasChildren && "pr-9 md:in-rail:pr-0"
            )}
          >
            {current ? (
              <span aria-hidden className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-primary md:in-rail:-left-2" />
            ) : null}
            <span className="flex size-5 shrink-0 items-center justify-center">
              <Icon aria-hidden />
            </span>
            <span className="flex-1 truncate md:in-rail:sr-only">{area.label}</span>
          </Link>
        </RailTooltip>
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={`${expanded ? "Hide" : "Show"} ${area.label} pages`}
            className="absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-6 md:in-rail:hidden"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", !expanded && "-rotate-90")}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <ul
          id={listId}
          aria-label={`${area.label} pages`}
          className={cn(
            "mt-0.5 ml-[1.15rem] flex flex-col gap-0.5 border-l border-border pl-2",
            "md:in-rail:ml-0 md:in-rail:mt-1 md:in-rail:border-l-0 md:in-rail:border-t md:in-rail:pl-0 md:in-rail:pt-1",
            // In the rail only the current area's pages are shown.
            !current && "md:in-rail:hidden"
          )}
        >
          {pages.map((p) => (
            <PageItem key={p.href} page={p} active={current && activePage?.href === p.href} exact={exact} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PageItem({ page, active, exact }: { page: NavPage; active: boolean; exact: boolean }) {
  const Icon = page.icon;
  return (
    <li>
      <RailTooltip label={page.label}>
        <Link
          href={page.href}
          aria-current={active ? (exact ? "page" : "true") : undefined}
          className={cn(
            rowBase,
            "h-9 md:h-8",
            active
              ? "bg-subtle font-medium text-foreground [&_svg]:text-primary"
              : "font-normal text-foreground-secondary hover:bg-subtle hover:text-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground-secondary"
          )}
        >
          {active ? (
            <span
              aria-hidden
              className="absolute inset-y-1.5 -left-[calc(0.5rem+1.5px)] w-[3px] rounded-full bg-primary md:in-rail:-left-2 md:in-rail:rounded-l-none"
            />
          ) : null}
          <span className="flex size-5 shrink-0 items-center justify-center">
            <Icon aria-hidden />
          </span>
          <span className="flex-1 truncate md:in-rail:sr-only">{page.label}</span>
        </Link>
      </RailTooltip>
    </li>
  );
}

function AppSidebarNav() {
  const pathname = usePathname() ?? "/";
  const shell = useAppShell();
  const { area: currentArea, page: activePage, exact } = resolveNav(pathname);
  const currentId = currentArea?.id ?? null;

  // Areas the user folded by hand. Every area starts open so any page is one
  // click away; entering an area re-opens it.
  const [overrides, setOverrides] = React.useState<Partial<Record<NavArea["id"], boolean>>>({});
  const [lastArea, setLastArea] = React.useState(currentId);
  if (lastArea !== currentId) {
    setLastArea(currentId);
    if (currentId && currentId in overrides) {
      const next = { ...overrides };
      delete next[currentId];
      setOverrides(next);
    }
  }

  // Close the phone drawer after any navigation (link clicks close it too).
  const setMobileOpen = shell?.setMobileOpen;
  React.useEffect(() => {
    setMobileOpen?.(false);
  }, [pathname, setMobileOpen]);

  return (
    <SidebarNav aria-label="Main">
      {NAV.map((group, gi) => (
        <SidebarSection key={group.label ?? gi} label={group.label}>
          {group.areas.map((area) => {
            const current = area.id === currentId;
            const expanded = overrides[area.id] ?? true;
            return (
              <AreaItem
                key={area.id}
                area={area}
                current={current}
                exact={exact}
                activePage={current ? activePage : null}
                expanded={expanded}
                onToggle={() => setOverrides((o) => ({ ...o, [area.id]: !expanded }))}
              />
            );
          })}
        </SidebarSection>
      ))}
    </SidebarNav>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }
  return (
    <Tooltip content="Sign out" side="right">
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        aria-label="Sign out"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:size-8"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </Tooltip>
  );
}

/* ── Top bar: "you are here" ─────────────────────────────────────────── */

function Breadcrumbs({ detail }: { detail: DetailState | null }) {
  const pathname = usePathname() ?? "/";
  const { area } = resolveNav(pathname);
  const crumbs = buildCrumbs(pathname, detail && detail.path === pathname ? detail.items : null);
  const AreaIcon = area?.icon;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {AreaIcon ? (
          <li aria-hidden className="mr-0.5 flex shrink-0 items-center text-primary">
            <AreaIcon className="size-4" />
          </li>
        ) : null}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          // Phones: the area icon plus the current crumb.
          const hideOnPhone = !last;
          return (
            <li key={`${i}-${c.label}`} className={cn("flex min-w-0 items-center gap-1", hideOnPhone && "max-sm:hidden", last ? "min-w-0" : "shrink-0")}>
              {i > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground max-sm:hidden" /> : null}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="max-w-[12rem] truncate rounded-sm px-0.5 font-medium text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:max-w-[7rem]"
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate px-0.5 font-semibold text-foreground">
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── The shell ───────────────────────────────────────────────────────── */

/**
 * The one app frame for every section: persistent sidebar (all areas, the
 * current one expanded), breadcrumbs, currency + theme toggles.
 *
 * `flush` drops the content padding for sections whose pages bring their own
 * (Trade, Properties, Home).
 */
export default function AppNavShell({
  children,
  headerActions,
  flush = false,
}: {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  flush?: boolean;
}) {
  const [detail, setDetail] = React.useState<DetailState | null>(null);
  return (
    <CrumbContext.Provider value={setDetail}>
      <AppShell>
        <AppShellSidebar collapsible>
          <SidebarBrand href="/" logo={<Logo collapsed />}>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-foreground">Hamo</p>
              <p className="truncate text-xs font-normal text-muted-foreground">Home Equity</p>
            </div>
          </SidebarBrand>
          <AppSidebarNav />
          <SidebarFooter className="justify-between md:in-rail:justify-start">
            <SignOutButton />
            <SidebarCollapseToggle />
          </SidebarFooter>
        </AppShellSidebar>
        <AppShellMain>
          <AppShellHeader>
            <Breadcrumbs detail={detail} />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {headerActions}
              <CurrencyToggle />
              <ThemeToggle collapsed />
            </div>
          </AppShellHeader>
          <AppShellContent className={flush ? "p-0 pt-0 pb-0 sm:px-0 md:pt-0 lg:px-0 overflow-x-clip" : undefined}>
            {children}
          </AppShellContent>
        </AppShellMain>
      </AppShell>
    </CrumbContext.Provider>
  );
}
