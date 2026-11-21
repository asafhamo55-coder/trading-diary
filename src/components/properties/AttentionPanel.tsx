"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AttentionItem, AttentionSeverity } from "@/lib/property-attention";

const ICON: Record<AttentionSeverity, React.ElementType> = {
  danger: XCircle,
  warning: AlertTriangle,
  info: Info,
};
const TONE: Record<AttentionSeverity, string> = {
  danger: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning",
  info: "bg-info-subtle text-info",
};
const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  danger: "Urgent",
  warning: "Soon",
  info: "Missing data",
};

const INITIAL = 6;

export function AttentionPanel({ items, className }: { items: AttentionItem[]; className?: string }) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? items : items.slice(0, INITIAL);
  const urgent = items.filter((i) => i.severity === "danger").length;

  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader
        className="pb-3"
        actions={
          items.length > 0 ? (
            <Badge variant={urgent > 0 ? "danger" : "warning"}>
              {items.length} item{items.length === 1 ? "" : "s"}
            </Badge>
          ) : null
        }
      >
        <CardTitle as="h2">Needs attention</CardTitle>
        <CardDescription>Vacancies, lease ends and missing figures</CardDescription>
      </CardHeader>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 px-5 pb-5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          All caught up. Nothing needs a look right now.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border border-t border-border">
            {visible.map((item) => {
              const Icon = ICON[item.severity];
              return (
                <li key={item.id}>
                  <Link
                    href={`/properties/${item.propertyId}`}
                    className="group flex items-center gap-3 px-5 py-2.5 no-underline transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONE[item.severity])}>
                      <Icon className="size-4" aria-hidden />
                      <span className="sr-only">{SEVERITY_LABEL[item.severity]}:</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        <span className="font-medium">{item.propertyTitle}</span>
                        <span className="text-muted-foreground"> · </span>
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          {items.length > INITIAL ? (
            <div className="border-t border-border px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
                {showAll ? "Show fewer" : `Show all ${items.length}`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
