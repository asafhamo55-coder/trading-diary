import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

/* ──────────────────────────────────────────────────────────────────────
 * Kpi / StatTile — a single metric tile (HomeownerHub `Kpi` port).
 * Value in tabular figures, optional delta with direction icon + sign
 * (never colour alone), explicit loading / failed states: a KPI whose
 * source failed shows "—" and says so, never "$0".
 * ──────────────────────────────────────────────────────────────────── */

export interface KpiDelta {
  /** Display string, e.g. "+12%" or "−$1,240". */
  value: string;
  direction: "up" | "down" | "flat";
  /** Whether this direction is good news. Drives colour only. */
  sentiment?: "positive" | "negative" | "neutral";
  /** Context, e.g. "vs last month". */
  label?: string;
}

export interface KpiProps {
  label: string;
  value?: React.ReactNode;
  icon?: React.ReactNode;
  delta?: KpiDelta;
  /** One line under the value. */
  hint?: React.ReactNode;
  /** Link the whole tile (rendered with next/link unless `linkAs` given). */
  href?: string;
  linkAs?: React.ElementType;
  state?: "ready" | "loading" | "failed";
  /** Colour the value: `positive` → success, `negative` → danger. */
  valueTone?: "default" | "positive" | "negative" | "muted";
  className?: string;
}

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;
const SENTIMENT = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-muted-foreground",
} as const;
const VALUE_TONE = {
  default: "text-foreground",
  positive: "text-success",
  negative: "text-danger",
  muted: "text-muted-foreground",
} as const;

export function Kpi({
  label,
  value,
  icon,
  delta,
  hint,
  href,
  linkAs: LinkAs = Link,
  state = "ready",
  valueTone = "default",
  className,
}: KpiProps) {
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null;
  const body = (
    <div className="@container flex h-full min-w-0 flex-col gap-2 p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 break-words pt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary [&_svg]:size-[18px]"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
      {state === "loading" ? (
        <div aria-busy="true" className="space-y-2 pt-1">
          <span className="sr-only">Loading {label}</span>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ) : state === "failed" ? (
        <div>
          <p className="num text-3xl font-semibold text-muted-foreground" aria-hidden>
            —
          </p>
          <p className="mt-1 text-xs font-medium text-danger">Couldn’t load</p>
        </div>
      ) : (
        <>
          <p
            className={cn(
              "num min-w-0 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] @min-[12rem]:text-3xl",
              VALUE_TONE[valueTone]
            )}
          >
            {value}
          </p>
          {delta || hint ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {delta && DeltaIcon ? (
                <span
                  className={cn(
                    "num inline-flex max-w-full items-center gap-0.5 font-semibold",
                    SENTIMENT[delta.sentiment ?? "neutral"]
                  )}
                >
                  <DeltaIcon className="size-3.5 shrink-0" aria-hidden />
                  {delta.value}
                </span>
              ) : null}
              {delta?.label ? <span className="min-w-0 text-muted-foreground">{delta.label}</span> : null}
              {hint ? <span className="min-w-0 break-words text-muted-foreground">{hint}</span> : null}
            </div>
          ) : null}
          {href ? (
            <ArrowRight
              className="mt-auto size-4 self-end text-primary transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden
            />
          ) : null}
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <LinkAs
        href={href}
        className={cn(
          "group block min-w-0 rounded-xl no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
      >
        <Card
          variant="interactive"
          className="h-full transition-[border-color,box-shadow,transform] motion-safe:group-hover:-translate-y-0.5"
        >
          {body}
        </Card>
      </LinkAs>
    );
  }
  return <Card className={cn("h-full min-w-0", className)}>{body}</Card>;
}

/** Alias: the name used in this codebase's docs. */
export const StatTile = Kpi;
export type StatTileProps = KpiProps;
