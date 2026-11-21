"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayCurrency } from "@/components/ui/currency";
import type { GuidelineStatusPayload } from "@/lib/guidelines-data";
import { ActionRow, pct } from "./parts";

/**
 * "Account vs guidelines" — compact status for the Trade dashboard. Loads on
 * its own (quotes can take a moment) so it never slows the dashboard down.
 */
export default function GuidelinesDashboardCard({ initial }: { initial?: GuidelineStatusPayload | null }) {
  const { money: displayMoney } = useDisplayCurrency();
  const money = (usd: number) => displayMoney(usd, "USD");
  const [status, setStatus] = React.useState<GuidelineStatusPayload | null>(initial ?? null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (initial !== undefined) return;
    let alive = true;
    fetch("/api/trade/guidelines/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: GuidelineStatusPayload) => alive && setStatus(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [initial]);

  const r = status?.result;
  return (
    <Link
      href="/trade/guidelines"
      className="group block rounded-xl border border-border bg-surface p-4 text-foreground transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary" aria-hidden>
            <Compass className="size-4" />
          </span>
          <h2 className="text-sm font-semibold">Account vs guidelines</h2>
        </div>
        {r ? (
          r.onTarget ? (
            <StatusPill tone="success" label="On target" />
          ) : (
            <StatusPill tone="warning" label={`${r.actions.length} action${r.actions.length === 1 ? "" : "s"}`} />
          )
        ) : null}
      </div>

      {r ? (
        <>
          <dl className="mt-4 grid grid-cols-4 gap-2">
            {r.buckets.map((b) => (
              <div key={b.id} className="min-w-0">
                <dt className="truncate text-2xs text-muted-foreground sm:text-xs">
                  {b.id === "sp500" ? status!.config.sp500Symbol : b.id === "nasdaq" ? status!.config.nasdaqSymbol : b.id === "largeCap" ? "Large caps" : "Cash"}
                </dt>
                <dd
                  className={
                    "num text-sm font-semibold " +
                    (b.status === "ok" ? "text-foreground" : b.status === "over" ? "text-warning" : "text-primary")
                  }
                >
                  {pct(b.actualPct, 0)}
                  <span className="ml-1 text-2xs font-normal text-muted-foreground">/ {b.targetPct}%</span>
                </dd>
              </div>
            ))}
          </dl>
          {r.actions[0] ? (
            <ol className="mt-4 border-t border-border pt-3">
              <ActionRow action={r.actions[0]} index={0} money={money} compact />
            </ol>
          ) : null}
        </>
      ) : failed ? (
        <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t check right now.</p>
      ) : (
        <div className="mt-4 space-y-2" aria-busy="true">
          <span className="sr-only">Loading guideline status</span>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      )}

      <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
        Open guidelines <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </p>
    </Link>
  );
}
