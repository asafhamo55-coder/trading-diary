import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — a placeholder block while content loads (HomeownerHub port).
 * Purely decorative: the loading region itself must announce `aria-busy`.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-subtle bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--foreground)_6%,transparent)_50%,transparent_100%)] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}

/** A few lines of text-shaped skeleton. Last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}
