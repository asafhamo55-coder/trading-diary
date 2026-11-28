import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CandlestickChart,
  Compass,
  ClipboardCheck,
  FileUp,
  HeartPulse,
  House,
  LayoutDashboard,
  LineChart,
  List,
  PiggyBank,
  Receipt,
  Settings,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The app's single navigation map. The shared sidebar (AppNavShell), the
 * top-bar breadcrumbs and the /savings section tabs all read from here.
 *
 * Matching is longest-prefix on the pathname, so dynamic routes such as
 * /properties/[id] or /trade/trades/[id]/edit resolve to their parent page.
 */

export interface NavPage {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavArea {
  id: "dashboard" | "savings" | "properties" | "home" | "trade";
  label: string;
  /** Where clicking the area goes. */
  href: string;
  /** Path prefix that belongs to the area (defaults to href). */
  match?: string;
  icon: LucideIcon;
  /** Sub-pages, shown beneath the area. The first is the area's landing page. */
  pages?: NavPage[];
}

export interface NavGroup {
  label?: string;
  areas: NavArea[];
}

export const NAV: NavGroup[] = [
  {
    areas: [{ id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Areas",
    areas: [
      {
        id: "savings",
        label: "Retirement & Savings",
        href: "/savings",
        icon: PiggyBank,
        pages: [
          { label: "Accounts", href: "/savings", icon: Wallet },
          { label: "Profile & goals", href: "/savings/profile", icon: Target },
          { label: "Benefits & insurance", href: "/savings/benefits", icon: HeartPulse },
          { label: "Tax returns", href: "/savings/tax", icon: Receipt },
          { label: "Import", href: "/savings/import", icon: FileUp },
        ],
      },
      {
        id: "properties",
        label: "Properties",
        href: "/properties",
        icon: Building2,
        pages: [{ label: "All properties", href: "/properties", icon: List }],
      },
      {
        id: "home",
        label: "Home",
        href: "/home",
        icon: House,
        pages: [
          { label: "Ledger", href: "/home", icon: List },
          { label: "Insights", href: "/home/insights", icon: BarChart3 },
          { label: "Coach", href: "/home/coach", icon: Sparkles },
          { label: "Review", href: "/home/review", icon: ClipboardCheck },
          { label: "Categories", href: "/home/categories", icon: Tag },
        ],
      },
      {
        id: "trade",
        label: "Trade",
        // /trade has no index route.
        href: "/trade/dashboard",
        match: "/trade",
        icon: CandlestickChart,
        pages: [
          { label: "Dashboard", href: "/trade/dashboard", icon: LayoutDashboard },
          { label: "Trades", href: "/trade/trades", icon: LineChart },
          { label: "Monthly", href: "/trade/monthly", icon: Calendar },
          { label: "Portfolio", href: "/trade/portfolio", icon: Briefcase },
          { label: "Guidelines", href: "/trade/guidelines", icon: Compass },
          { label: "Journal", href: "/trade/journal", icon: BookOpen },
          { label: "Analytics", href: "/trade/analytics", icon: BarChart3 },
          { label: "Assets", href: "/trade/assets", icon: Wallet },
          { label: "Stocks", href: "/trade/stocks", icon: TrendingUp },
          { label: "Errors", href: "/trade/errors", icon: AlertTriangle },
          { label: "Settings", href: "/trade/settings", icon: Settings },
        ],
      },
    ],
  },
];

export const NAV_AREAS: NavArea[] = NAV.flatMap((g) => g.areas);

/** True when `pathname` is `base` or below it. "/" only matches itself. */
export function pathMatches(base: string, pathname: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

function normalize(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  const p = pathname.split(/[?#]/)[0] || "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export interface NavLocation {
  area: NavArea | null;
  page: NavPage | null;
  /** True when the pathname is exactly the matched page (not a child route). */
  exact: boolean;
  pathname: string;
}

/** The area and sub-page the pathname belongs to (longest-prefix match). */
export function resolveNav(rawPathname: string | null | undefined): NavLocation {
  const pathname = normalize(rawPathname);
  let area: NavArea | null = null;
  let areaLen = -1;
  for (const a of NAV_AREAS) {
    const base = a.match ?? a.href;
    if (pathMatches(base, pathname) && base.length > areaLen) {
      area = a;
      areaLen = base.length;
    }
  }
  let page: NavPage | null = null;
  for (const p of area?.pages ?? []) {
    if (pathMatches(p.href, pathname) && (!page || p.href.length > page.href.length)) page = p;
  }
  const exact = page ? page.href === pathname : area ? (area.match ?? area.href) === pathname : false;
  return { area, page, exact, pathname };
}

export interface Crumb {
  label: string;
  /** Omitted for the current location. */
  href?: string;
}

const SEGMENT_LABELS: Record<string, string> = { new: "New", edit: "Edit" };

/**
 * "You are here" trail: Area › Sub-page › detail…
 *
 * `detail` comes from the page (e.g. a property's title); without it, a child
 * route gets a generic label from its last segment ("New", "Edit", "Details").
 * The last crumb never has an href.
 */
export function buildCrumbs(rawPathname: string | null | undefined, detail?: Crumb[] | null): Crumb[] {
  const { area, page, exact, pathname } = resolveNav(rawPathname);
  if (!area) return [{ label: "Hamo Home Equity" }];

  const crumbs: Crumb[] = [{ label: area.label, href: area.href }];
  const isLanding = page != null && page.href === area.href;
  const hasDetail = !exact || (detail != null && detail.length > 0);
  // The landing page gets its own crumb only when it is the destination
  // ("Retirement & Savings › Accounts"), not as a step before a detail.
  if (page && (!isLanding || !hasDetail)) crumbs.push({ label: page.label, href: page.href });

  if (detail && detail.length > 0) {
    crumbs.push(...detail);
  } else if (!exact) {
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    crumbs.push({ label: SEGMENT_LABELS[last] ?? "Details" });
  }

  // De-duplicate a single-crumb area ("Dashboard").
  const out = crumbs.filter((c, i) => i === 0 || c.label !== crumbs[i - 1].label || c.href !== crumbs[i - 1].href);
  return out.map((c, i) => (i === out.length - 1 ? { label: c.label } : c));
}
