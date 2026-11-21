import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — "there is nothing here yet", plus the one next step
 * (HomeownerHub port). Only for a list that genuinely loaded and is empty;
 * a failed load should say so instead.
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** The primary next step (usually one Button). */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** `dashed` (default) standalone; `plain` inside a Card; `compact` for small panels / table bodies. */
  variant?: "dashed" | "plain" | "compact";
  titleAs?: "h2" | "h3" | "p";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "dashed",
  titleAs: Title = "h3",
  className,
}: EmptyStateProps) {
  const compact = variant === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "dashed" && "rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12",
        variant === "plain" && "px-6 py-12",
        compact && "px-4 py-8",
        className
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-xl border border-border bg-subtle text-muted-foreground shadow-xs",
            compact ? "size-10 [&_svg]:size-5" : "size-12 [&_svg]:size-6"
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <Title className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</Title>
      {description ? (
        <p className={cn("mt-1 max-w-md text-muted-foreground", compact ? "text-xs" : "text-sm")}>{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className={cn("flex flex-wrap items-center justify-center gap-3", compact ? "mt-3" : "mt-5")}>
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
