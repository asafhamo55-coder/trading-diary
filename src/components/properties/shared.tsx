"use client";

import type { ReactNode } from "react";
import { cn, formatCurrency, signedClass } from "@/lib/utils";

export { MONTH_ABBR } from "@/lib/property";

/** Themed text/date/number input class — border, muted placeholder, amber focus halo. */
export const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm " +
  "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 transition-colors " +
  "hover:border-[var(--muted-foreground)]/40 " +
  "focus-visible:outline-none focus:outline-none focus:border-accent-amber " +
  "focus:ring-2 focus:ring-accent-amber/25";

/** Labelled form field. Set `required` to append a red asterisk. */
export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5 block">
        {label}
        {required && <span className="text-loss ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

/** In-card section header: amber chip icon + title + optional meta. */
export function SectionHeader({
  icon,
  title,
  meta,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent-amber/10 ring-1 ring-inset ring-accent-amber/15">
        {icon}
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
      {meta && (
        <span className="text-xs text-[var(--muted-foreground)]">· {meta}</span>
      )}
    </div>
  );
}

/** KPI tile. `money` colours by sign; `count`/`percent` stay neutral. */
export function SummaryTile({
  label,
  value,
  variant = "money",
  tone,
  caption,
  captionTone,
}: {
  label: string;
  value: string | number;
  variant?: "money" | "count" | "percent";
  /** For money: "pos" forces green, "neg" forces red, "net" colours by sign. */
  tone?: "pos" | "neg" | "net";
  caption?: string;
  captionTone?: string;
}) {
  let valueClass = "text-[var(--foreground)]";
  if (variant === "money") {
    const num = typeof value === "number" ? value : 0;
    valueClass =
      tone === "pos"
        ? "text-profit"
        : tone === "neg"
          ? "text-loss"
          : signedClass(num);
  }
  const display =
    variant === "money" && typeof value === "number"
      ? `${tone === "net" && value >= 0 ? "+" : ""}${formatCurrency(value)}`
      : String(value);

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm transition-colors hover:border-[var(--muted-foreground)]/30">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)] mb-1.5 truncate">
        {label}
      </p>
      <p className={cn("text-base sm:text-lg md:text-xl font-bold font-data tracking-tight tabular-nums", valueClass)}>
        {display}
      </p>
      {caption && (
        <p className={cn("text-[11px] mt-1 text-[var(--muted-foreground)]", captionTone)}>
          {caption}
        </p>
      )}
    </div>
  );
}

/** Segmented control — backs the theme toggle and the income/expense switch. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: {
    value: T;
    label: string;
    icon?: ReactNode;
    activeClassName?: string;
  }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--muted)]",
              active
                ? (o.activeClassName ?? "bg-[var(--ring)]/15 text-[var(--ring)]")
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
