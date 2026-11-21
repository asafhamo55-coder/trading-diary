# HomeownerHub design system → Hamo Home Equity

Source of truth in HomeownerHub (read-only):

- `packages/ui/src/tokens.ts`: colour roles (light + dark), type scale, radii, shadows, motion, layout. Spec: `docs/specs/2026-10-15-design-system-v2.md`. Note that `DESIGN_STRATEGY.md` is older and its palette is superseded.
- `packages/ui/tailwind.config.ts`: the Tailwind v3 preset. It turns the tokens into CSS variables and adds the `in-rail`, `sidebar-collapsed`, `coarse` and `cq-*` variants plus the `.num` and `.focus-ring` utilities.
- `packages/ui/src/components/*`, `packages/ui/src/layouts/AppShell.tsx`: the components.
- `apps/hoa/src/app/layout.tsx`: the fonts (Be Vietnam Pro + JetBrains Mono, via `next/font/google`).
- `apps/hoa/src/components/dashboard/*`: chart styling (ECharts 6 through `echarts-for-react`).

In trading-diary everything lives in `src/app/globals.css` (Tailwind v4, `@theme inline`) and `src/components/ui/`.

## 1. Tokens

HomeownerHub uses the **hoa hub** (brand blue). HomeownerHub stores HSL channels. Here they are stored as hex, because the existing code reads them as `var(--x)`.

### Colour roles

| Role (HomeownerHub) | trading-diary var | Utility | Light | Dark |
|---|---|---|---|---|
| background | `--background` | `bg-background` | #F5F8FC | #0A0F1A |
| surface | `--surface`, **`--card`** | `bg-surface` / `bg-card` | #FFFFFF | #111827 |
| elevated | `--elevated` | `bg-elevated` | #FFFFFF | #182235 |
| subtle | `--subtle`, **`--muted`** | `bg-subtle` | #EEF3F9 | #1E293B |
| border | `--border` | `border-border` | #E2E8F0 | #243045 |
| border-strong | `--border-strong` | `border-border-strong` | #CBD5E1 | #334155 |
| input (control edge) | `--input-border` | `border-input` | #7A879C | #6B7A90 |
| ring | `--ring` | `ring-ring` | #2563EB | #60A5FA |
| foreground | `--foreground` (+ `--card-foreground`) | `text-foreground` | #0F172A | #F1F5F9 |
| foreground-secondary | `--foreground-secondary` | `text-foreground-secondary` | #334155 | #CBD5E1 |
| muted (text) | **`--muted-foreground`** | `text-muted-foreground` | #526077 | #94A3B8 |
| primary / hover / fg / subtle | `--primary*` | `bg-primary`, `text-primary-fg`, `bg-primary-subtle` … | #2563EB / #1D4ED8 / #FFF / #EFF6FF | #60A5FA / #93C5FD / #0A0F1A / #172554 |
| accent (AI, amber) | `--accent`, `--accent-subtle`, `--accent-fg` | `bg-accent-subtle text-accent-fg` | #F79009 / #FFF6E5 / #93370D | #FDB022 / #2B2110 / #FEC84B |
| success | `--success(-solid/-subtle)` | `text-success` … | #047857 / #047857 / #ECFDF5 | #4ACB8B / #047857 / #0D2419 |
| warning | `--warning(-solid/-subtle)` | | #A6420A / #B54708 / #FFF8E6 | #FDB022 / #B54708 / #2B2110 |
| danger | `--danger(-solid/-subtle)` | `text-danger` … | #C4261B / #C4261B / #FEF3F2 | #F97B70 / #C4261B / #2C1414 |
| info | `--info(-solid/-subtle)` | | #026AA2 / #026AA2 / #EFF8FF | #5CB5FD / #026AA2 / #0B2133 |
| on-solid | `--on-solid` | `text-on-solid` | #FFFFFF | #FFFFFF |
| (eviction-hub violet) | `--violet` | (via `accent-purple`) | #6D3FE0 | #AE96FB |

**Naming differences to keep in mind:**

- HomeownerHub `text-muted` is a **text** colour. In this app `--muted` has always been a **fill**. So `--muted` now equals HomeownerHub `subtle`, and HomeownerHub `muted` text is `--muted-foreground` / `text-muted-foreground`. There is deliberately no `--color-muted` utility, which avoids a `bg-muted` / `text-muted` mixup.
- `--input` stays the form-field **fill** here (now = surface). HomeownerHub's input *border* colour is `--input-border`, exposed as `border-input`.

**Legacy accent utilities are now theme-aware aliases:**

| Utility | Was | Now |
|---|---|---|
| `profit` | #00D68F | `var(--success)` |
| `loss` | #FF4D6A | `var(--danger)` |
| `accent-blue` | #3B82F6 | `var(--primary)` |
| `accent-amber` | #FFB547 | `var(--accent)` |
| `accent-purple` | #A78BFA | `var(--violet)` |

Theme switching is unchanged: `:root` / `:root.dark` is dark (this app's default) and `:root.light` is light. `src/lib/theme-script.ts` now applies the saved theme before paint, so there is no dark flash on light mode.

### Typography

- **Sans:** Be Vietnam Pro 300–700 (`--font-be-vietnam`). **Mono:** JetBrains Mono (`--font-jetbrains-mono`). Both load through `next/font/google` in `src/app/layout.tsx`. This replaces the broken DM Sans `@font-face`.
- The body uses the Inter-style alternates `"cv02","cv03","cv04","cv11"`.
- `.num` (`@utility num`) gives tabular, lining figures. HomeownerHub shows money in the sans face with `.num`, not in mono. `.font-data` (mono) still exists for older pages.
- **Scale (HomeownerHub):**

  | Step | Size | Use |
  |---|---|---|
  | 2xs | 11 | overline |
  | xs | 13 | meta |
  | sm | 15 | UI default |
  | base | 16 | |
  | lg | 18 | section title |
  | xl | 20 | |
  | 2xl | 24 | page h1 |
  | 3xl | 30 | KPI |
  | 4xl | 36 | |

  Page h1 is `text-2xl font-semibold tracking-[-0.015em]`. An eyebrow is `text-xs font-semibold uppercase tracking-[0.08em]`.

  **Not ported:** the 13 / 15 px redefinition of `xs` / `sm`. Overriding them globally would re-flow every dense trade table. Only `text-2xs` was added; `xs` and `sm` keep Tailwind's 12 and 14.

### Radii

| Token | Size | Used for |
|---|---|---|
| sm | 4 | |
| DEFAULT / md | 6 | controls |
| lg | 8 | buttons, nav items |
| xl | 12 | cards |
| 2xl | 16 | |
| 3xl | 24 | |
| full | pill | badges |

These match Tailwind v4's defaults and are pinned in `@theme`.

### Shadows

`--shadow-xs` … `--shadow-xl` point at `--elev-*`, which change per theme. Light uses layered `rgb(16 24 40 / .05–.10)`. Dark uses black plus a 1px inset highlight.

HomeownerHub cards have **no shadow at rest**. `shadow-md` is applied on hover (interactive cards) or for floating content.

### Motion and layout

- **Easings:** `ease-standard` cubic-bezier(.2,0,0,1), `ease-emphasized` (.3,0,0,1), `ease-exit`.
- **Durations:** 80 / 120 / 180 / 260 ms. Arbitrary `duration-*` values are used here.
- **Shell:** `w-sidebar` 15rem, `w-sidebar-collapsed` 3.75rem, `h-topbar` 3.5rem.
- **Variants:** `in-rail:`, `sidebar-collapsed:`, `coarse:` are declared with `@custom-variant`. HomeownerHub's `cq-*` container variants map to Tailwind v4's built-in `@container` / `@min-[…]:`.

## 2. Component inventory

| HomeownerHub (`packages/ui`) | trading-diary (`src/components/ui`) | Notes |
|---|---|---|
| `Button` | `button.tsx` (restyled) | Same variants and sizes. The old names `primary` (default), `danger`, `danger-ghost`, `size="default"` are kept. Adds `subtle`, `destructive`, `loading`, `icon`, `iconRight`, sizes `xs`/`md`/`icon-xs`. |
| `Card`, `CardHeader(actions)`, `CardTitle(as)`, `CardDescription`, `CardContent`, `CardFooter` | `card.tsx` (replaced; the old shadcn card was unused) | Variants: default / elevated / interactive / ghost / subtle. |
| `Badge`, `StatusPill`, `STATUS_ICONS` | `badge.tsx` (replaced; it was unused) | Badge variants: default, solid, success, warning, danger/destructive, info, neutral/secondary, ai, outline. Sizes: sm / md. |
| `Kpi` (+ legacy `StatCard`) | `stat-tile.tsx`: `Kpi`, alias `StatTile` | Adds `valueTone` for signed money. |
| `Tabs` (link tabs), `TabGroup` / `TabList` / `Tab` / `TabPanel` (Radix) | `tabs.tsx` (replaced; the shadcn tabs were unused) | `linkAs` defaults to `next/link`. |
| `PageHeader`, `Breadcrumbs` | `page-header.tsx` | |
| `EmptyState` | `empty-state.tsx` | |
| `DataTable`, `TableScroll` | `data-table.tsx`; `table.tsx` restyled to tokens | |
| `AppShell` family + `Sidebar` (`SidebarBrand`, `SidebarNav`, `SidebarSection`, `NavItem`, `SidebarFooter`, `SidebarCollapseToggle`) | `app-shell.tsx` | Includes `SkipLink` and `useAppShell`. |
| `Tooltip`, `TooltipProvider` | `tooltip.tsx` | Adds `@radix-ui/react-tooltip` 1.2.8, the version HomeownerHub resolves. |
| `Skeleton`, `SkeletonText` | `skeleton.tsx` | |
| `THEME_INIT_SCRIPT` | `src/lib/theme-script.ts` | Adapted to the `theme-mode-v1` key and `.light` / `.dark` classes. |
| Chart colours via `palette()` | `src/lib/use-theme-tokens.ts` (`useThemeTokens()`) | Resolves CSS vars for ECharts and re-reads them on theme change. |

**Not ported (yet):**

- `CommandPalette` and `AppShellSearchTrigger` (they need `cmdk`).
- `UserMenu`, `HubSwitcher`, `Dialog`, `DropdownMenu`, `Select`, `Field`, `Input`, `Toast`, `WizardStepper`, `Timeline`, `Confirm`, `FilterBar`, `Pager`.
- `BrandLogo`. The Hamo `Logo` is kept as the brand mark.

The existing shadcn `dialog`, `select`, `dropdown-menu`, `input` etc. pick up the new tokens only where they use the CSS vars.

**Libraries:** HomeownerHub pins `lucide-react ^0.460`, `tailwind-merge ^2.5` and Tailwind 3. This app already has the newer `lucide-react` 1.7, `tailwind-merge` 3.5 and Tailwind 4, so those were not downgraded. Every icon name used exists in 1.7.

## 3. Mapping onto this app

- **Every existing page:** picks up the palette, font, radii and scrollbar through the remapped vars (`--card`, `--muted`, `--muted-foreground`, `--border`, `--background`, `--foreground`, `--ring`) and the aliased `profit` / `loss` / `accent-*` utilities.
- **Hub (`/`):** wrapped in `HubShell` (`src/components/home/HubShell.tsx`), which is `AppShell` with:
  - nav entries Dashboard `/`, Trade `/trade/dashboard` (active for `/trade/*`; `/trade` has no index route), Properties, Home, and Retirement & Savings `/savings`;
  - the top bar holds the page title, the year picker and the theme toggle.

  `HubClient` uses `PageHeader`, `Kpi`, `EmptyState`, token colours and a theme-aware chart.
- **Sub-apps (`/trade`, `/properties`, `/home`):** layouts unchanged; they inherit tokens only. Moving them onto `AppShell` is the next step:
  - replace the trade `Sidebar` and `AppBar` with `AppShellSidebar` + `NavItem`;
  - swap `SummaryTile` → `Kpi`, `SegmentedControl` → `TabGroup variant="segmented"`.
- **Global CSS fix:** `* { border-color: var(--border) }` moved into `@layer base`. While unlayered it beat every Tailwind utility, so `border-transparent`, `border-profit` and the like had silently been rendering as the default border colour.

**Known leftovers:**

- About 40 files still hard-code the old dark hex values (`#00D68F`, `#FF4D6A`, `#3B82F6`, `#FFB547`, `#2A3040`, `#8892A6` …). This is mostly in ECharts options and inline `style`s.
- Those spots stay neon / dark-only until they are switched to tokens or `useThemeTokens()`.
