"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
import type { ExplainKey } from "@/lib/explain";

/* ──────────────────────────────────────────────────────────────────────
 * Small building blocks shared by the /savings pages: a right-side drawer,
 * an in-app confirm dialog, a sparkline, Hebrew secondary labels, select
 * styling and inline notices. All colours come from theme tokens.
 * ──────────────────────────────────────────────────────────────────── */

/** Same look as properties/shared.tsx `inputCls`, for <select>. */
export const selectCls =
  "w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--input)] bg-no-repeat px-3 py-2 pr-8 text-sm " +
  "text-[var(--foreground)] transition-colors hover:border-[var(--muted-foreground)]/40 " +
  "focus-visible:outline-none focus:outline-none focus:border-accent-amber focus:ring-2 focus:ring-accent-amber/25 " +
  "bg-[length:16px] bg-[position:right_0.5rem_center] " +
  "bg-[image:url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%2394a3b8%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E)]";

/** Hebrew secondary label, right-to-left. */
export function He({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <span dir="rtl" lang="he" className={cn("text-muted-foreground", className)}>
      {children}
    </span>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface text-foreground shadow-xl outline-none",
            "data-[state=open]:animate-fade-in",
            width
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">Edit details</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-5 py-3">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  tone = "danger",
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-elevated p-5 text-foreground shadow-xl outline-none data-[state=open]:animate-fade-in"
        >
          <div className="flex gap-3">
            {tone === "danger" ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger">
                <AlertTriangle className="size-[18px]" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <div className="mt-1 text-sm text-muted-foreground">{description}</div>
              </DialogPrimitive.Description>
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button variant="secondary" disabled={busy}>
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────

/** Minimal line + area sparkline in `currentColor` (set colour via text-*). */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  className,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  const id = React.useId();
  if (values.length < 2) {
    return (
      <span className={cn("inline-flex items-center text-2xs text-muted-foreground", className)} style={{ height }}>
        {values.length === 1 ? "1 statement" : "No history"}
      </span>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible text-primary", className)}
      role="img"
      aria-label={label ?? "Balance history"}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} fill="currentColor" />
    </svg>
  );
}

// ── Notices ────────────────────────────────────────────────────────

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-info/25 bg-info-subtle text-info",
    warning: "border-warning/25 bg-warning-subtle text-warning",
    danger: "border-danger/25 bg-danger-subtle text-danger",
    success: "border-success/25 bg-success-subtle text-success",
  }[tone];
  const Icon = tone === "info" || tone === "success" ? Info : AlertTriangle;
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex gap-3 rounded-xl border px-4 py-3", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-foreground-secondary", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Section heading inside a form/drawer. */
export function FormSection({
  title,
  description,
  tip,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** Glossary key: an ⓘ after the title. */
  tip?: ExplainKey;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section role="group" aria-labelledby={id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 id={id} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
        {tip ? <InfoTip tip={tip} /> : null}
      </h3>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Label/value line used in cards. */
export function Stat({
  label,
  tip,
  children,
  className,
}: {
  label: React.ReactNode;
  /** Glossary key: an ⓘ after the label. */
  tip?: ExplainKey;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
        {tip ? <InfoTip tip={tip} /> : null}
      </dt>
      <dd className="num mt-0.5 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}
