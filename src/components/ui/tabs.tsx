"use client";

import * as React from "react";
import Link from "next/link";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 * Tabs (HomeownerHub port).
 *
 *  - `Tabs`      underline LINK tabs for in-page sub-nav (changes URL).
 *  - `TabGroup`  Radix tabs that switch panels without navigating;
 *                `variant="segmented"` is the pill switcher for 2–4 options.
 * ──────────────────────────────────────────────────────────────────── */

export interface TabItem {
  label: string;
  href: string;
  badge?: string | number | null;
  /** Overrides the pathname-prefix match. */
  active?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Used to compute active state when `item.active` is not set. */
  currentPath?: string;
  className?: string;
  "aria-label"?: string;
  /** Router link component. Defaults to next/link. */
  linkAs?: React.ElementType;
}

function isActive(item: TabItem, currentPath?: string): boolean {
  if (typeof item.active === "boolean") return item.active;
  if (!currentPath) return false;
  if (item.href === currentPath) return true;
  return currentPath.startsWith(`${item.href}/`);
}

export function Tabs({ items, currentPath, className, linkAs: LinkAs = Link, ...aria }: TabsProps) {
  return (
    <nav
      aria-label={aria["aria-label"] ?? "Page sections"}
      className={cn("-mx-1 overflow-x-auto scrollbar-none border-b border-border sm:mx-0", className)}
    >
      <div className="flex min-w-max items-end gap-1 px-1 sm:px-0">
        {items.map((item) => {
          const active = isActive(item, currentPath);
          return (
            <LinkAs
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex h-10 items-center gap-2 rounded-t-md border-b-2 px-3 text-sm font-medium no-underline transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground"
              )}
            >
              <span>{item.label}</span>
              {item.badge != null && item.badge !== "" && item.badge !== 0 ? (
                <span
                  className={cn(
                    "num inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none",
                    active ? "bg-primary-subtle text-primary" : "bg-subtle text-muted-foreground"
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </LinkAs>
          );
        })}
      </div>
    </nav>
  );
}

type Variant = "underline" | "segmented";
const VariantCtx = React.createContext<Variant>("underline");

export interface TabGroupProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  variant?: Variant;
}

export const TabGroup = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Root>, TabGroupProps>(
  ({ variant = "underline", className, ...props }, ref) => (
    <VariantCtx.Provider value={variant}>
      <TabsPrimitive.Root ref={ref} className={cn("flex flex-col gap-4", className)} {...props} />
    </VariantCtx.Provider>
  )
);
TabGroup.displayName = "TabGroup";

export const TabList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(VariantCtx);
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === "underline"
          ? "flex items-end gap-1 overflow-x-auto scrollbar-none border-b border-border"
          : "inline-flex w-fit items-center gap-0.5 rounded-lg border border-border bg-subtle p-0.5",
        className
      )}
      {...props}
    />
  );
});
TabList.displayName = "TabList";

export const Tab = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(VariantCtx);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        variant === "underline"
          ? "-mb-px h-10 border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
          : "h-8 rounded-md px-3 text-muted-foreground hover:text-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  );
});
Tab.displayName = "Tab";

export const TabPanel = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    {...props}
  />
));
TabPanel.displayName = "TabPanel";
