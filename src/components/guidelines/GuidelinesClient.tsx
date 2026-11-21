"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Scale, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useDisplayCurrency } from "@/components/ui/currency";
import { api, errMsg } from "@/components/savings/api";
import { fractionLabel, sharesLabel, type GuidelineConfig } from "@/lib/guidelines";
import type { GuidelineStatusPayload } from "@/lib/guidelines-data";
import { ActionRow, BucketBar, pct } from "./parts";
import { GuidelineConfigPanel } from "./GuidelineConfigPanel";

function when(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function day(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function GuidelinesClient({
  initial,
  error: initialError = null,
  demo = false,
}: {
  initial: GuidelineStatusPayload | null;
  error?: string | null;
  /** Preview with sample data: no network calls, config is read-only. */
  demo?: boolean;
}) {
  const { money: displayMoney } = useDisplayCurrency();
  const money = React.useCallback((usd: number) => displayMoney(usd, "USD"), [displayMoney]);
  const [status, setStatus] = React.useState(initial);
  const [error, setError] = React.useState(initialError);
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (demo) return;
    setRefreshing(true);
    try {
      setStatus(await api<GuidelineStatusPayload>("/api/trade/guidelines/status"));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setRefreshing(false);
    }
  }, [demo]);

  const save = async (next: GuidelineConfig) => {
    await api("/api/trade/guidelines", { method: "PUT", body: next });
    await refresh();
  };

  const header = (
    <PageHeader
      eyebrow="Trade"
      title="Guidelines"
      description="The standing rules for the stocks account, and what to do to get back to them."
      meta={
        status ? (
          status.result.onTarget ? (
            <StatusPill tone="success" label="On target" />
          ) : (
            <StatusPill tone="warning" label={`${status.result.actions.length} action${status.result.actions.length === 1 ? "" : "s"}`} />
          )
        ) : null
      }
      actions={
        <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={demo} icon={<RefreshCw aria-hidden />}>
          Refresh
        </Button>
      }
    />
  );

  if (!status) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        {header}
        <EmptyState
          icon={<AlertTriangle aria-hidden />}
          title="Couldn't load the account"
          description={error ?? "The trade data is unavailable right now. Try again in a moment."}
          action={
            <Button onClick={refresh} loading={refreshing} disabled={demo}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { result, config, cash, freshness } = status;
  const scaleMax = Math.max(50, ...result.buckets.map((b) => Math.ceil((Math.max(b.actualPct, b.targetPct + config.bandPct) + 5) / 10) * 10));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      {header}

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger-subtle px-3 py-2 text-sm text-danger">
          Refresh failed: {error}. Showing the last result.
        </p>
      ) : null}

      {/* Buckets */}
      <Card>
        <CardHeader
          actions={
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Account value</p>
              <p className="num text-lg font-semibold text-foreground">{money(result.totalValue)}</p>
            </div>
          }
        >
          <CardTitle as="h2">Target vs actual</CardTitle>
          <CardDescription>
            Shaded zone = target ± {config.bandPct} pts. Trades are suggested only outside it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {result.buckets.map((b) => (
            <BucketBar key={b.id} bucket={b} band={config.bandPct} scaleMax={scaleMax} money={money} />
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">What to do now</CardTitle>
          <CardDescription>
            {result.onTarget
              ? "Nothing — the account is within its guidelines."
              : "In this order: sales first (they fund the buys), then buys, then cash. Amounts are approximate."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.actions.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-success-subtle px-4 py-3 text-sm text-success">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
              Every bucket is within {config.bandPct} pts of target and no large cap is {config.dipPct}% off its high. Hold.
            </div>
          ) : (
            <ol className="space-y-4">
              {result.actions.map((a, i) => (
                <ActionRow key={a.id} action={a} index={i} money={money} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dip signals */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <TrendingDown className="size-4 text-muted-foreground" aria-hidden /> Dip signals
            </CardTitle>
            <CardDescription>
              Large caps {config.dipPct}%+ below their 3-month high. Each deploys {fractionLabel(config.deployFraction)} of the remaining cash reserve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.dipSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dips right now.</p>
            ) : (
              <ul className="divide-y divide-border">
                {result.dipSignals.map((d) => (
                  <li key={d.symbol} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-foreground">
                      {d.symbol}
                      {!d.held ? <span className="ml-2 text-xs font-normal text-muted-foreground">watchlist</span> : null}
                    </p>
                    <p className="num text-right text-sm font-semibold text-danger">−{pct(d.offPct * 100)}</p>
                    <p className="num text-xs text-muted-foreground">
                      {money(d.price)} vs 3-mo high {money(d.high3m)}
                    </p>
                    <p className="num text-right text-xs text-foreground">
                      {d.suggestedAmount > 0 ? (
                        <>
                          Buy {money(d.suggestedAmount)}
                          {d.suggestedShares != null ? ` (${sharesLabel(d.suggestedShares)})` : ""}
                        </>
                      ) : (
                        <span className="text-muted-foreground">No buy</span>
                      )}
                    </p>
                    {d.note ? <p className="col-span-2 text-xs text-muted-foreground">{d.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Outside the rules */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Scale className="size-4 text-muted-foreground" aria-hidden /> Outside the rules
            </CardTitle>
            <CardDescription>Positions that don&apos;t fit any bucket. The plan sells them over time.</CardDescription>
          </CardHeader>
          <CardContent>
            {result.outside.length === 0 ? (
              <p className="text-sm text-muted-foreground">None — every position fits a bucket.</p>
            ) : (
              <ul className="divide-y divide-border">
                {result.outside.map((o) => (
                  <li key={`${o.symbol}-${o.shares}`} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{o.symbol}</p>
                      <p className="text-xs text-muted-foreground">{o.reason}</p>
                    </div>
                    <div className="num shrink-0 text-right text-sm">
                      <p className="text-foreground">{money(o.value)}</p>
                      <p className="text-xs text-muted-foreground">{pct(o.pctOfTotal)} of account</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Freshness */}
      <Card variant="subtle">
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Clock className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              Prices from {freshness.sources.length ? freshness.sources.join(" and ") : "no source"}, fetched {when(freshness.oldestFetchedAt)}
              {freshness.latestPriceAsOf ? ` (last trade ${day(freshness.latestPriceAsOf)})` : ""}. Delayed quotes, refreshed about every 15 minutes in market hours.
              {freshness.staleSymbols.length ? ` Stale: ${freshness.staleSymbols.join(", ")}.` : ""}
              {freshness.missingSymbols.length ? ` No price: ${freshness.missingSymbols.join(", ")}.` : ""}
            </span>
          </p>
          <p>
            Cash {money(cash.amount)} —{" "}
            {cash.source === "override"
              ? `manual figure as of ${day(cash.asOf ? `${cash.asOf}T00:00:00Z` : null)}.`
              : cash.derived
                ? `worked out from trades: starting balance ${money(cash.derived.startingBalance)} + realized P&L ${money(cash.derived.realizedPnL)} + net deposits ${money(cash.derived.netDeposits)} − open positions at cost ${money(cash.derived.openLongCost)}${cash.derived.openShortProceeds ? ` + short proceeds ${money(cash.derived.openShortProceeds)}` : ""}.`
                : "no trade account found."}
          </p>
          {result.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-warning">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              {w}
            </p>
          ))}
        </CardContent>
      </Card>

      <GuidelineConfigPanel config={config} updatedAt={status.configUpdatedAt} onSave={save} disabled={demo} />
    </div>
  );
}
