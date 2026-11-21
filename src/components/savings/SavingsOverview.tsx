"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronDown,
  CircleAlert,
  FileUp,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  Wallet,
  Receipt,
  TrendingDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, TabGroup, TabList, TabPanel } from "@/components/ui/tabs";
import {
  JOINT_OWNER,
  childMilestones,
  convert,
  normalizeCurrency,
  retirementTiming,
  type HouseholdMember,
  type SavingsAccountLite,
  type SavingsAccountView,
} from "@/lib/savings";
import type { HouseholdProfileDTO, NetWorthResponse } from "@/lib/savings-data";
import { cn } from "@/lib/utils";
import { api, errMsg } from "./api";
import { AccountCard } from "./AccountCard";
import { AccountDrawer } from "./AccountDrawer";
import { fmtMonth, memberName, money, typeLabel, typeLabelHe, typeOrder } from "./format";
import { He, Notice, Sparkline } from "./ui";
import { useFlash } from "./useFlash";

type Snap = { asOf: string; balance: number };

export interface OverviewData {
  netWorth: NetWorthResponse;
  profile: HouseholdProfileDTO;
  /** Archived accounts (not part of net worth). */
  archived: SavingsAccountLite[];
  /** Per-account balance history, keyed by account id. */
  history: Record<string, Snap[]>;
}

interface PersonTab {
  value: string;
  label: string;
  /** Owner keys shown in this tab; null = everyone. */
  owners: string[] | null;
  kind: "household" | "adult" | "kids";
}

function buildTabs(members: HouseholdMember[], accounts: { owner: string }[]): PersonTab[] {
  const adults = members.filter((m) => m.role === "adult");
  const kids = members.filter((m) => m.role === "child");
  const known = new Set(members.map((m) => m.key));
  // Owners on accounts that aren't in the profile yet still get a tab.
  const strays = [...new Set(accounts.map((a) => a.owner))].filter((o) => o !== JOINT_OWNER && !known.has(o));
  const tabs: PersonTab[] = [{ value: "household", label: "Household", owners: null, kind: "household" }];
  for (const m of adults) tabs.push({ value: m.key, label: memberName(m.key, members), owners: [m.key], kind: "adult" });
  for (const o of strays) tabs.push({ value: o, label: memberName(o, members), owners: [o], kind: "adult" });
  if (kids.length > 0) tabs.push({ value: "kids", label: "Kids", owners: kids.map((k) => k.key), kind: "kids" });
  return tabs;
}

export default function SavingsOverview({ initial }: { initial?: OverviewData }) {
  const preview = !!initial;
  const [data, setData] = React.useState<OverviewData | null>(initial ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!initial);
  const [tab, setTab] = React.useState("household");
  const [drawer, setDrawer] = React.useState<{ id: string | null; nonce: number } | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const { flash, node: flashNode } = useFlash();
  const params = useSearchParams();

  const load = React.useCallback(async () => {
    if (preview) return;
    setLoading(true);
    setError(null);
    try {
      const [netWorth, profile, all] = await Promise.all([
        api<NetWorthResponse>("/api/savings/networth"),
        api<HouseholdProfileDTO>("/api/savings/profile"),
        api<SavingsAccountLite[]>("/api/savings/accounts?includeArchived=1"),
      ]);
      const archived = all.filter((a) => a.archivedAt);
      setData((prev) => ({ netWorth, profile, archived, history: prev?.history ?? {} }));
      setLoading(false);
      // Per-account history for the sparklines (one small request each).
      const entries = await Promise.all(
        all.map(async (a) => {
          try {
            const d = await api<{ snapshots: Snap[] }>(`/api/savings/accounts/${a.id}`);
            return [a.id, d.snapshots ?? []] as const;
          } catch {
            return [a.id, [] as Snap[]] as const;
          }
        })
      );
      setData((prev) => (prev ? { ...prev, history: Object.fromEntries(entries) } : prev));
    } catch (e) {
      setError(errMsg(e));
      setLoading(false);
    }
  }, [preview]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Deep links: /savings?account=<id> opens that account, ?new=1 the add form.
  const deepLinked = React.useRef(false);
  React.useEffect(() => {
    if (deepLinked.current || !data) return;
    const id = params.get("account");
    const isNew = params.get("new");
    if (id || isNew) {
      deepLinked.current = true;
      setDrawer({ id: id ?? null, nonce: Date.now() });
    }
  }, [params, data]);

  const onChanged = (msg: string) => {
    flash(msg);
    void load();
  };

  if (loading && !data) return <OverviewSkeleton />;
  if (error && !data) {
    return (
      <div className="space-y-6">
        <Header onAdd={() => {}} disabled />
        <Notice tone="danger" title="Couldn’t load your savings">
          <p>{error}</p>
          <Button className="mt-3" size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => void load()}>
            Try again
          </Button>
        </Notice>
      </div>
    );
  }
  if (!data) return null;

  const { netWorth, profile, archived, history } = data;
  const members = profile.members;
  const accounts = netWorth.savings.accounts;
  const fx = netWorth.fx;
  const tabs = buildTabs(members, [...accounts, ...archived]);
  const activeTab = tabs.find((t) => t.value === tab) ?? tabs[0];
  const editing =
    drawer?.id != null ? (accounts.find((a) => a.id === drawer.id) ?? archived.find((a) => a.id === drawer.id) ?? null) : null;
  const defaultOwner =
    activeTab.kind === "adult" ? activeTab.value : (members.find((m) => m.role === "adult")?.key ?? members[0]?.key ?? "");

  const empty = accounts.length === 0 && archived.length === 0;

  return (
    <div className="space-y-6">
      <Header
        onAdd={() => setDrawer({ id: null, nonce: Date.now() })}
        meta={
          empty ? null : (
            <Badge variant="neutral" title={`Rate source: ${fx.source}`}>
              1 USD = {money(fx.usdIls, "ILS", { digits: 2 })}
              {fx.source === "default" ? " (default)" : fx.source === "profile" ? " (your override)" : ""}
            </Badge>
          )
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {empty ? (
        <EmptyState
          icon={<PiggyBank />}
          title="No savings accounts yet"
          description="Import the Israeli clearing-house / provider statements, or add your 401(k), RSUs, study funds and pension funds by hand. Everything you enter here feeds the net-worth summary and the AI advisor."
          action={
            <Button asChild>
              <Link href="/savings/import">
                <FileUp aria-hidden /> Import statements
              </Link>
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" icon={<Plus />} onClick={() => setDrawer({ id: null, nonce: Date.now() })}>
              Add account
            </Button>
          }
        />
      ) : (
        <TabGroup variant="segmented" value={activeTab.value} onValueChange={setTab}>
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
            <TabList aria-label="Whose accounts">
              {tabs.map((t) => (
                <Tab key={t.value} value={t.value}>
                  {t.label}
                  <span className="num text-xs text-muted-foreground">
                    {t.owners ? accounts.filter((a) => t.owners!.includes(a.owner)).length : accounts.length}
                  </span>
                </Tab>
              ))}
            </TabList>
          </div>
          {tabs.map((t) => (
            <TabPanel key={t.value} value={t.value} className="space-y-6">
              <PersonPanel
                tab={t}
                netWorth={netWorth}
                members={members}
                history={history}
                onEdit={(id) => setDrawer({ id, nonce: Date.now() })}
                onAdd={() => setDrawer({ id: null, nonce: Date.now() })}
              />
            </TabPanel>
          ))}
        </TabGroup>
      )}

      {archived.length > 0 ? (
        <Card variant="subtle">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-xl"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((s) => !s)}
          >
            <Archive className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium text-foreground">Archived accounts</span>
            <Badge variant="neutral">{archived.length}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">Not counted in totals</span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showArchived && "rotate-180")} aria-hidden />
          </button>
          {showArchived ? (
            <ul className="divide-y divide-border border-t border-border">
              {archived.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{a.provider}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {typeLabel(a.type)} · {memberName(a.owner, members)}
                      {a.policyLast4 ? ` · ••${a.policyLast4}` : ""}
                    </span>
                  </span>
                  <span className="num text-foreground-secondary">{money(a.balance, normalizeCurrency(a.currency))}</span>
                  <Button size="xs" variant="secondary" onClick={() => setDrawer({ id: a.id, nonce: Date.now() })}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {drawer ? (
        <AccountDrawer
          key={`${drawer.id ?? "new"}-${drawer.nonce}`}
          open
          onOpenChange={(o) => {
            if (!o) setDrawer(null);
          }}
          account={editing}
          snapshots={editing ? history[editing.id] : undefined}
          members={members}
          defaultOwner={defaultOwner}
          onChanged={onChanged}
          readOnly={preview}
        />
      ) : null}
      {flashNode}
    </div>
  );
}

function Header({ onAdd, meta, disabled }: { onAdd: () => void; meta?: React.ReactNode; disabled?: boolean }) {
  return (
    <PageHeader
      title="Retirement & Savings"
      description="Pensions, study funds, provident funds, 401(k), RSUs and cash for the whole household — view, correct and add what the advisor works from."
      meta={meta}
      actions={
        <>
          <Button asChild variant="secondary" className="max-sm:flex-1">
            <Link href="/savings/import">
              <FileUp aria-hidden /> Import
            </Link>
          </Button>
          <Button icon={<Plus />} onClick={onAdd} disabled={disabled} className="max-sm:flex-1">
            Add account
          </Button>
        </>
      }
    />
  );
}

// ── Per-person panel ───────────────────────────────────────────────

function PersonPanel({
  tab,
  netWorth,
  members,
  history,
  onEdit,
  onAdd,
}: {
  tab: PersonTab;
  netWorth: NetWorthResponse;
  members: HouseholdMember[];
  history: Record<string, Snap[]>;
  onEdit: (id: string) => void;
  onAdd: () => void;
}) {
  const fx = netWorth.fx;
  const now = React.useMemo(() => new Date(`${netWorth.asOf}T12:00:00Z`), [netWorth.asOf]);
  const all = netWorth.savings.accounts;
  const accounts = tab.owners ? all.filter((a) => tab.owners!.includes(a.owner)) : all;

  const totalUsd = accounts.reduce((s, a) => s + a.balanceUsd, 0);
  const totalIls = accounts.reduce((s, a) => s + a.balanceIls, 0);
  const depositsUsd = accounts.reduce((s, a) => s + convert(a.monthlyDeposit, normalizeCurrency(a.currency), "USD", fx), 0);
  const feesUsd = accounts.reduce((s, a) => s + a.annualFees.totalUsd, 0);
  const feeBase = accounts
    .filter((a) => a.feeAccumulationPct != null || a.feeDepositPct != null)
    .reduce((s, a) => s + a.balanceUsd, 0);
  const dragUsd = accounts.reduce(
    (s, a) => s + (a.feeDrag10y ? convert(Math.max(0, a.feeDrag10y.costVsBenchmark), normalizeCurrency(a.currency), "USD", fx) : 0),
    0
  );
  const missingFees = accounts.filter(
    (a) => a.feeDepositPct == null && a.feeAccumulationPct == null && !["cash", "rsu", "other"].includes(a.type)
  ).length;

  const groups = new Map<string, SavingsAccountView[]>();
  for (const a of [...accounts].sort((x, y) => typeOrder(x.type) - typeOrder(y.type) || y.balanceUsd - x.balanceUsd)) {
    const g = groups.get(a.type) ?? [];
    g.push(a);
    groups.set(a.type, g);
  }
  const showOwner = tab.kind !== "adult";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Savings"
          icon={<Wallet />}
          value={money(totalUsd, "USD")}
          hint={`≈ ${money(totalIls, "ILS")} · ${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
        />
        <Kpi label="Monthly deposits" icon={<Landmark />} value={money(depositsUsd, "USD")} hint="all sources, per month" />
        <Kpi
          label="Annual fees"
          icon={<Receipt />}
          value={money(feesUsd, "USD")}
          hint={
            missingFees > 0
              ? `${missingFees} account${missingFees === 1 ? "" : "s"} missing fees`
              : feeBase > 0
                ? `${((feesUsd / feeBase) * 100).toFixed(2)}% of balance`
                : undefined
          }
        />
        <Kpi
          label="10-yr fee drag"
          icon={<TrendingDown />}
          value={money(dragUsd, "USD")}
          valueTone={dragUsd > 0 ? "negative" : "default"}
          hint="vs benchmark fees"
        />
      </div>

      {tab.kind === "household" ? <HouseholdInsights netWorth={netWorth} members={members} /> : null}
      {tab.kind === "adult" ? <RetirementStrip memberKey={tab.value} members={members} accounts={accounts} now={now} /> : null}
      {tab.kind === "kids" ? <KidsStrip members={members} netWorth={netWorth} now={now} /> : null}

      {accounts.length === 0 ? (
        <EmptyState
          icon={<PiggyBank />}
          title={tab.kind === "kids" ? "No children’s accounts yet" : `No accounts for ${tab.label} yet`}
          description={
            tab.kind === "kids"
              ? "Add each child’s חיסכון לכל ילד account (and any other savings in their name)."
              : "Add a pension, study fund, 401(k), RSU plan or cash account."
          }
          action={
            <Button icon={<Plus />} onClick={onAdd}>
              Add account
            </Button>
          }
        />
      ) : (
        [...groups.entries()].map(([type, list]) => {
          const groupUsd = list.reduce((s, a) => s + a.balanceUsd, 0);
          return (
            <section key={type} aria-labelledby={`grp-${tab.value}-${type}`} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border pb-2">
                <h3 id={`grp-${tab.value}-${type}`} className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                  {typeLabel(type)}
                </h3>
                <He className="text-sm">{typeLabelHe(type)}</He>
                <span className="ml-auto num text-sm text-muted-foreground">
                  {list.length} · <span className="font-medium text-foreground">{money(groupUsd, "USD")}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {list.map((a) => (
                  <AccountCard
                    key={a.id}
                    a={a}
                    fx={fx}
                    now={now}
                    history={history[a.id]?.map((s) => s.balance)}
                    ownerName={showOwner ? memberName(a.owner, members) : undefined}
                    onEdit={() => onEdit(a.id)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

function HouseholdInsights({ netWorth, members }: { netWorth: NetWorthResponse; members: HouseholdMember[] }) {
  const owners = Object.entries(netWorth.byOwner).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...owners.map(([, v]) => v));
  const hist = netWorth.history;
  const gaps = netWorth.dataGaps.filter((g) => /fees missing|balance/i.test(g));
  const countries = Object.entries(netWorth.byCountry);
  const total = netWorth.savings.totalUsd || 1;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>By person</CardTitle>
          <CardDescription>
            {countries.map(([c, v], i) => (
              <span key={c}>
                {i ? " · " : ""}
                {c === "IL" ? "Israel" : c} {Math.round((v / total) * 100)}%
              </span>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {owners.map(([o, v]) => (
              <li key={o}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-foreground-secondary">{memberName(o, members)}</span>
                  <span className="num font-medium text-foreground">{money(v, "USD")}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Savings over time</CardTitle>
          <CardDescription>
            {hist.length >= 2
              ? `${fmtMonth(hist[0].month)} – ${fmtMonth(hist[hist.length - 1].month)}, at today’s rate`
              : "Builds up as statements are imported or balances updated"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hist.length >= 2 ? (
            <>
              <Sparkline values={hist.map((h) => h.savingsUsd)} width={320} height={84} className="h-[84px] w-full" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground num">
                <span>{money(hist[0].savingsUsd, "USD", { compact: true })}</span>
                <span className="font-medium text-foreground">
                  {money(hist[hist.length - 1].savingsUsd, "USD", { compact: true })}
                </span>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Not enough history yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            Needs attention
            {gaps.length > 0 ? <Badge variant="warning">{gaps.length}</Badge> : null}
          </CardTitle>
          <CardDescription>Missing data lowers the advisor’s confidence.</CardDescription>
        </CardHeader>
        <CardContent>
          {gaps.length === 0 ? (
            <p className="text-sm text-success">Every account has fees and a recent balance.</p>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto pr-1 text-sm">
              {gaps.map((g) => (
                <li key={g} className="flex gap-2 text-foreground-secondary">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RetirementStrip({
  memberKey,
  members,
  accounts,
  now,
}: {
  memberKey: string;
  members: HouseholdMember[];
  accounts: SavingsAccountView[];
  now: Date;
}) {
  const m = members.find((x) => x.key === memberKey);
  if (!m) {
    return (
      <Notice tone="warning" title="Not in the household profile yet">
        Add {memberKey} in <Link className="underline" href="/savings/profile">Profile &amp; goals</Link> with a birth date and
        target retirement age.
      </Notice>
    );
  }
  const t = retirementTiming(m, now);
  const pensionIls = accounts
    .filter((a) => a.projectedMonthlyPension && normalizeCurrency(a.currency) === "ILS")
    .reduce((s, a) => s + (a.projectedMonthlyPension ?? 0), 0);
  return (
    <Card variant="subtle">
      <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5">
        <div>
          <dt className="text-xs text-muted-foreground">Age</dt>
          <dd className="num text-lg font-semibold text-foreground">{t.age ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Target retirement</dt>
          <dd className="num text-lg font-semibold text-foreground">
            {t.targetRetirementAge}
            {t.targetAgeAssumed ? <span className="ml-1 text-xs font-normal text-muted-foreground">(assumed)</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Years to go</dt>
          <dd className="num text-lg font-semibold text-foreground">{t.yearsToRetirement ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Projected pension (IL)</dt>
          <dd className="num text-lg font-semibold text-foreground">{pensionIls > 0 ? `${money(pensionIls, "ILS")}/mo` : "—"}</dd>
        </div>
      </dl>
      {t.age == null || t.targetAgeAssumed ? (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          {t.age == null ? "Birth date missing. " : ""}
          {t.targetAgeAssumed ? "Target retirement age not set. " : ""}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/savings/profile">
            Complete the profile
          </Link>
        </p>
      ) : null}
    </Card>
  );
}

function KidsStrip({ members, netWorth, now }: { members: HouseholdMember[]; netWorth: NetWorthResponse; now: Date }) {
  const ms = childMilestones(
    members,
    netWorth.savings.accounts.map((a) => ({ owner: a.owner, type: a.type, balanceUsd: a.balanceUsd })),
    now
  );
  if (ms.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ms.map((c) => (
        <Card key={c.memberKey} variant="subtle" className="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-foreground">{memberName(c.memberKey, members)}</p>
            <p className="num text-sm text-muted-foreground">{c.age != null ? `age ${c.age}` : "birth date missing"}</p>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">Turns 18</dt>
              <dd className="num text-foreground">{c.turns18 ? fmtMonth(c.turns18) : "—"}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">Turns 21</dt>
              <dd className="num text-foreground">{c.turns21 ? fmtMonth(c.turns21) : "—"}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground" dir="rtl" lang="he">
                חיסכון לכל ילד
              </dt>
              <dd className="num text-foreground">
                {c.hasSavingsForEveryChildAccount ? money(c.savingsForEveryChildBalanceUsd, "USD") : (
                  <span className="text-warning">none</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Loading savings</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-80 max-w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

