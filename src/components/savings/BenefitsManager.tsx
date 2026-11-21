"use client";

import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Copy,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Umbrella,
  Wallet,
} from "lucide-react";
import { Field, inputCls } from "@/components/properties/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, TableScroll, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, TabGroup, TabList } from "@/components/ui/tabs";
import {
  BENEFIT_CATEGORIES,
  BENEFIT_PAYERS,
  JOINT_OWNER,
  riskOf,
  type CoverageReport,
  type HouseholdMember,
  type SavingsAccountLite,
} from "@/lib/savings";
import type { BenefitDTO, HouseholdProfileDTO } from "@/lib/savings-data";
import { cn } from "@/lib/utils";
import { api, errMsg } from "./api";
import {
  BENEFIT_LABELS,
  PAYER_LABELS,
  benefitLabel,
  fmtDate,
  memberName,
  money,
  numToField,
  parseNum,
  riskLabel,
  typeLabel,
} from "./format";
import { useDisplayCurrency } from "@/components/ui/currency";
import { ConfirmDialog, Drawer, FormSection, He, Notice, selectCls } from "./ui";
import { useFlash } from "./useFlash";

export interface BenefitsData {
  benefits: BenefitDTO[];
  coverage: CoverageReport;
  profile: HouseholdProfileDTO;
  accounts: SavingsAccountLite[];
}

/** Rows of the coverage map — the risks a household plan should look at. */
const MAP_RISKS = ["death", "disability", "accidental_death", "health", "critical_illness", "long_term_care"];
/** Risks that are a gap for an adult when missing. */
const ESSENTIAL = new Set(["death", "disability"]);

export default function BenefitsManager({ initial }: { initial?: BenefitsData }) {
  const preview = !!initial;
  const [data, setData] = React.useState<BenefitsData | null>(initial ?? null);
  const { money: dm, currency: display, isForeign } = useDisplayCurrency();
  const [error, setError] = React.useState<string | null>(null);
  const [owner, setOwner] = React.useState("all");
  const [drawer, setDrawer] = React.useState<{ id: string | null; nonce: number } | null>(null);
  const { flash, node: flashNode } = useFlash();

  const load = React.useCallback(async () => {
    if (preview) return;
    setError(null);
    try {
      const [b, profile, accounts] = await Promise.all([
        api<{ benefits: BenefitDTO[]; coverage: CoverageReport }>("/api/savings/benefits"),
        api<HouseholdProfileDTO>("/api/savings/profile"),
        api<SavingsAccountLite[]>("/api/savings/accounts").catch(() => [] as SavingsAccountLite[]),
      ]);
      setData({ ...b, profile, accounts });
    } catch (e) {
      setError(errMsg(e));
    }
  }, [preview]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <PageHeader
      title="Benefits & insurance"
      description="Life, disability, health and other coverage across Israeli policies and US employer plans — who’s covered, by whom, at what cost."
      actions={
        <Button icon={<Plus />} disabled={!data} onClick={() => setDrawer({ id: null, nonce: Date.now() })}>
          Add coverage
        </Button>
      }
    />
  );

  if (error && !data) {
    return (
      <div className="space-y-6">
        {header}
        <Notice tone="danger" title="Couldn’t load benefits">
          <p>{error}</p>
          <Button className="mt-3" size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => void load()}>
            Try again
          </Button>
        </Notice>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const { benefits, coverage, profile, accounts } = data;
  const members = profile.members;
  const costUsdById = new Map<string, number | null>();
  for (const g of coverage.groups) for (const it of g.items) costUsdById.set(it.id, it.monthlyCostUsd);
  const owners = [...new Set([...members.map((m) => m.key), ...benefits.map((b) => b.owner)])];
  const filtered = owner === "all" ? benefits : benefits.filter((b) => b.owner === owner);
  const editing = drawer?.id ? (benefits.find((b) => b.id === drawer.id) ?? null) : null;
  const accountName = (id: string | null | undefined) => {
    if (!id) return null;
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.provider} ${typeLabel(a.type).toLowerCase()}` : "a savings policy";
  };

  const columns: DataTableColumn<BenefitDTO>[] = [
    {
      key: "coverage",
      header: "Coverage",
      mobilePrimary: true,
      cell: (b) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {benefitLabel(b.category)}{" "}
            <He className="text-xs font-normal">{BENEFIT_LABELS[b.category]?.he}</He>
          </p>
          <p className="text-xs text-muted-foreground">
            {memberName(b.owner, members)} · {b.source}
            {b.linkedSavingsAccountId ? <span> · inside {accountName(b.linkedSavingsAccountId)}</span> : null}
          </p>
        </div>
      ),
    },
    {
      key: "country",
      header: "Country",
      cell: (b) => <Badge variant="outline">{b.country}</Badge>,
    },
    {
      key: "amount",
      header: "Cover",
      numeric: true,
      cell: (b) => {
        if (b.coverageAmount == null) return "—";
        const cur = b.coverageCurrency ?? "ILS";
        return (
          <span className="inline-flex flex-col items-end leading-tight">
            <span>{dm(b.coverageAmount, cur)}</span>
            {isForeign(cur) ? <span className="text-xs font-normal text-muted-foreground">{money(b.coverageAmount, cur)}</span> : null}
          </span>
        );
      },
    },
    {
      key: "cost",
      header: "Monthly cost",
      numeric: true,
      mobileAside: true,
      cell: (b) => {
        if (b.monthlyCost == null) return <span className="text-muted-foreground">—</span>;
        const cur = b.costCurrency ?? b.coverageCurrency ?? "ILS";
        // Primary in the display currency (the server's USD figure in USD mode),
        // native cost underneath when it differs.
        const usd = costUsdById.get(b.id);
        const [amt, from] = display === "USD" && usd != null ? [usd, "USD"] : [b.monthlyCost, cur];
        const digitsFor = (v: number) => (Math.abs(v) < 100 ? 2 : 0);
        return (
          <span className="inline-flex flex-col items-end leading-tight">
            <span>{dm(amt, from, { digits: digitsFor(amt) })}</span>
            {isForeign(cur) ? (
              <span className="text-xs font-normal text-muted-foreground">
                {money(b.monthlyCost, cur, { digits: digitsFor(b.monthlyCost) })}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "payer",
      header: "Paid by",
      cell: (b) => (b.payer ? <Badge variant={b.payer === "employer" ? "success" : "neutral"}>{PAYER_LABELS[b.payer] ?? b.payer}</Badge> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "ends",
      header: "Ends",
      hideBelowLg: true,
      cell: (b) => <span className="text-muted-foreground">{b.endsAt ? fmtDate(b.endsAt) : "—"}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-12",
      cell: (b) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${benefitLabel(b.category)} (${b.source})`} onClick={() => setDrawer({ id: b.id, nonce: Date.now() })}>
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {header}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {benefits.length === 0 ? (
        <EmptyState
          icon={<Umbrella />}
          title="No coverage recorded yet"
          description="Importing the Israeli statements adds the life and disability cover inside pension and manager’s-insurance policies. Add US employer benefits (life, AD&D, LTD, health, HSA, ESPP) by hand."
          action={
            <Button icon={<Plus />} onClick={() => setDrawer({ id: null, nonce: Date.now() })}>
              Add coverage
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Monthly premiums" tip="benefits.premiums" icon={<Wallet />} value={dm(coverage.totalMonthlyCostUsd, "USD")} hint={`all coverage, in ${display === "USD" ? "USD" : "ILS"}`} />
            <Kpi label="Coverages" tip="benefits.count" icon={<ShieldCheck />} value={benefits.length} hint={`${new Set(benefits.map((b) => b.owner)).size} people covered`} />
            <Kpi
              label="Possible duplicates"
              tip="benefits.duplicates"
              icon={<Copy />}
              value={coverage.duplicates.length}
              valueTone={coverage.duplicates.length ? "negative" : "default"}
              hint="same risk insured twice"
            />
            <Kpi
              label="Gaps"
              tip="benefits.gaps"
              icon={<CircleAlert />}
              value={coverage.gaps.length}
              valueTone={coverage.gaps.length ? "negative" : "positive"}
              hint="adults without death / disability cover"
            />
          </div>
          <CoverageReportView coverage={coverage} members={members} />
        </>
      )}

      {benefits.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
              All coverage <InfoTip tip="benefits.all" />
            </h2>
            <TabGroup variant="segmented" value={owner} onValueChange={setOwner}>
              <div className="-mx-1 max-w-full overflow-x-auto px-1 scrollbar-none">
                <TabList aria-label="Filter by person">
                  <Tab value="all">Everyone</Tab>
                  {owners.map((o) => (
                    <Tab key={o} value={o}>
                      {memberName(o, members)}
                    </Tab>
                  ))}
                </TabList>
              </div>
            </TabGroup>
          </div>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(b) => b.id}
            caption="Coverage"
            mobile="cards"
            empty={<EmptyState variant="compact" title="Nothing for this person" description="Add their coverage with “Add coverage”." />}
          />
        </section>
      ) : null}

      {drawer ? (
        <BenefitDrawer
          key={`${drawer.id ?? "new"}-${drawer.nonce}`}
          benefit={editing}
          members={members}
          accounts={accounts}
          defaultOwner={owner !== "all" ? owner : (members.find((m) => m.role === "adult")?.key ?? "")}
          readOnly={preview}
          onClose={() => setDrawer(null)}
          onChanged={(m) => {
            flash(m);
            void load();
          }}
        />
      ) : null}
      {flashNode}
    </div>
  );
}

// ── Coverage report ────────────────────────────────────────────────

function CoverageReportView({ coverage, members }: { coverage: CoverageReport; members: HouseholdMember[] }) {
  const { money: dm } = useDisplayCurrency();
  const people = [
    ...members.filter((m) => m.role === "adult").map((m) => m.key),
    ...[...new Set(coverage.groups.map((g) => g.owner))].filter(
      (o) => !members.some((m) => m.key === o && m.role === "adult")
    ),
  ];
  const cell = (owner: string, risk: string) => coverage.groups.find((g) => g.owner === owner && g.risk === risk);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle as="h2" className="flex items-center gap-1.5">
            Coverage map <InfoTip tip="benefits.coverageMap" />
          </CardTitle>
          <CardDescription>Each risk per person, across Israel and the US. Amounts in USD.</CardDescription>
        </CardHeader>
        <TableScroll>
          <table className="w-full min-w-[32rem] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="border-y border-border bg-subtle px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  Risk
                </th>
                {people.map((p) => (
                  <th key={p} scope="col" className="border-y border-border bg-subtle px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    {memberName(p, members)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAP_RISKS.map((risk) => (
                <tr key={risk}>
                  <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-medium text-foreground-secondary">
                    {riskLabel(risk)}
                  </th>
                  {people.map((p) => {
                    const g = cell(p, risk);
                    const isAdult = members.some((m) => m.key === p && m.role === "adult");
                    return (
                      <td key={p} className="border-b border-border px-4 py-2.5 align-top">
                        {!g ? (
                          ESSENTIAL.has(risk) && isAdult ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                              <CircleAlert className="size-3.5" aria-hidden /> None
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="inline-flex flex-col gap-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                g.duplicate ? "text-warning" : "text-success"
                              )}
                            >
                              {g.duplicate ? <Copy className="size-3.5" aria-hidden /> : <CircleCheck className="size-3.5" aria-hidden />}
                              {g.count} {g.count === 1 ? "policy" : "policies"}
                              {g.countries.length > 1 ? ` · ${g.countries.join("+")}` : ""}
                            </span>
                            {g.totalCoverageUsd > 0 ? (
                              <span className="num text-xs text-foreground-secondary">{dm(g.totalCoverageUsd, "USD", { compact: true })}</span>
                            ) : null}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle as="h2" className="flex items-center gap-2">
              Gaps <InfoTip tip="benefits.gaps" /> {coverage.gaps.length ? <Badge variant="danger">{coverage.gaps.length}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coverage.gaps.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-success">
                <ShieldCheck className="size-4" aria-hidden /> Every adult has life and disability cover.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {coverage.gaps.map((g) => (
                  <li key={`${g.owner}-${g.risk}`} className="flex gap-2.5 text-sm">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    <span>
                      <span className="font-medium text-foreground">
                        {memberName(g.owner, members)} · {riskLabel(g.risk)}
                      </span>
                      <span className="block text-muted-foreground">{g.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle as="h2" className="flex items-center gap-2">
              Possible duplicates <InfoTip tip="benefits.duplicates" /> {coverage.duplicates.length ? <Badge variant="warning">{coverage.duplicates.length}</Badge> : null}
            </CardTitle>
            <CardDescription>The same risk insured more than once — sometimes intended, often money to save.</CardDescription>
          </CardHeader>
          <CardContent>
            {coverage.duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overlapping policies found.</p>
            ) : (
              <ul className="space-y-3">
                {coverage.duplicates.map((g) => (
                  <li key={`${g.owner}-${g.risk}`} className="rounded-lg border border-warning/25 bg-warning-subtle/50 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {memberName(g.owner, members)} · {riskLabel(g.risk)}
                      </p>
                      <p className="num text-xs text-muted-foreground">
                        {dm(g.totalCoverageUsd, "USD", { compact: true })} cover · {dm(g.monthlyCostUsd, "USD")}/mo
                      </p>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {g.items.map((it) => (
                        <li key={it.id} className="flex flex-wrap items-center gap-x-2 text-foreground-secondary">
                          <Badge variant="outline">{it.country}</Badge>
                          <span>{it.source}</span>
                          <span className="text-muted-foreground">({benefitLabel(it.category)}{it.insideSavingsAccount ? ", inside a savings policy" : ""})</span>
                          {it.coverageUsd != null ? <span className="num ml-auto">{dm(it.coverageUsd, "USD", { compact: true })}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Add / edit drawer ──────────────────────────────────────────────

function BenefitDrawer({
  benefit,
  members,
  accounts,
  defaultOwner,
  readOnly,
  onClose,
  onChanged,
}: {
  benefit: BenefitDTO | null;
  members: HouseholdMember[];
  accounts: SavingsAccountLite[];
  defaultOwner: string;
  readOnly?: boolean;
  onClose: () => void;
  onChanged: (msg: string) => void;
}) {
  const isNew = !benefit;
  const [f, setF] = React.useState(() => ({
    owner: benefit?.owner ?? defaultOwner,
    country: benefit?.country ?? "US",
    category: benefit?.category ?? "life",
    source: benefit?.source ?? "",
    coverageAmount: numToField(benefit?.coverageAmount),
    coverageCurrency: benefit?.coverageCurrency ?? (benefit?.country === "IL" ? "ILS" : "USD"),
    monthlyCost: numToField(benefit?.monthlyCost),
    costCurrency: benefit?.costCurrency ?? benefit?.coverageCurrency ?? (benefit?.country === "IL" ? "ILS" : "USD"),
    payer: benefit?.payer ?? "",
    beneficiary: benefit?.beneficiary ?? "",
    endsAt: benefit?.endsAt ?? "",
    linkedSavingsAccountId: benefit?.linkedSavingsAccountId ?? "",
    notes: typeof benefit?.details?.notes === "string" ? (benefit.details.notes as string) : "",
  }));
  const [busy, setBusy] = React.useState<null | "save" | "delete">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const ownerOptions = [...new Set([...members.map((m) => m.key), ...(f.owner && f.owner !== JOINT_OWNER ? [f.owner] : [])])];
  const ownerAccounts = accounts.filter((a) => a.owner === f.owner);

  async function save() {
    if (!f.owner) return setError("Choose who is covered.");
    if (!f.source.trim()) return setError("Enter the provider or employer plan.");
    const amt = parseNum(f.coverageAmount);
    const cost = parseNum(f.monthlyCost);
    if (Number.isNaN(amt) || (amt != null && amt < 0)) return setError("Cover amount must be a positive number.");
    if (Number.isNaN(cost) || (cost != null && cost < 0)) return setError("Monthly cost must be a positive number.");
    setError(null);
    if (readOnly) return setError("Preview mode — changes are not saved.");
    const details = { ...(benefit?.details ?? {}) } as Record<string, unknown>;
    if (f.notes.trim()) details.notes = f.notes.trim();
    else delete details.notes;
    const body = {
      owner: f.owner,
      country: f.country,
      category: f.category,
      source: f.source.trim(),
      coverageAmount: amt,
      coverageCurrency: f.coverageCurrency || null,
      monthlyCost: cost,
      costCurrency: f.costCurrency || null,
      payer: f.payer || null,
      beneficiary: f.beneficiary.trim() || null,
      endsAt: f.endsAt || null,
      linkedSavingsAccountId: f.linkedSavingsAccountId || null,
      details: Object.keys(details).length ? details : null,
    };
    setBusy("save");
    try {
      if (isNew) await api("/api/savings/benefits", { method: "POST", body });
      else await api(`/api/savings/benefits/${benefit.id}`, { method: "PATCH", body });
      onChanged(isNew ? "Coverage added" : "Coverage saved");
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!benefit) return;
    if (readOnly) {
      setConfirm(false);
      return setError("Preview mode — changes are not saved.");
    }
    setBusy("delete");
    try {
      await api(`/api/savings/benefits/${benefit.id}`, { method: "DELETE" });
      setConfirm(false);
      onChanged("Coverage deleted");
      onClose();
    } catch (e) {
      setConfirm(false);
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const risk = riskOf(f.category);

  return (
    <>
      <Drawer
        open
        onOpenChange={(o) => !o && !busy && onClose()}
        title={isNew ? "Add coverage" : `${benefitLabel(benefit.category)} · ${benefit.source}`}
        description={
          !isNew && benefit.origin === "pdf-import"
            ? "Imported from a statement. Edits are kept until the next import of the same policy overwrites them."
            : "An insurance policy or employer benefit."
        }
        width="max-w-lg"
        footer={
          <>
            <Button icon={<Save />} loading={busy === "save"} disabled={busy === "delete"} onClick={save}>
              {isNew ? "Add coverage" : "Save changes"}
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={onClose}>
              Cancel
            </Button>
            {!isNew ? (
              <Button variant="danger-ghost" size="sm" className="ml-auto" icon={<Trash2 />} disabled={!!busy} onClick={() => setConfirm(true)}>
                Delete
              </Button>
            ) : null}
          </>
        }
      >
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <FormSection title="Coverage">
            <Field label="Category" required>
              <select className={selectCls} value={f.category} onChange={(e) => set({ category: e.target.value })}>
                {BENEFIT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {benefitLabel(c)}
                    {BENEFIT_LABELS[c]?.he ? ` — ${BENEFIT_LABELS[c].he}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {risk !== f.category ? (
              <p className="-mt-1 text-xs text-muted-foreground">Compared with other “{riskLabel(risk).toLowerCase()}” cover.</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Person covered" required>
                <select className={selectCls} value={f.owner} onChange={(e) => set({ owner: e.target.value, linkedSavingsAccountId: "" })}>
                  {ownerOptions.length === 0 ? <option value="">Add members in Profile first</option> : null}
                  {ownerOptions.map((o) => (
                    <option key={o} value={o}>
                      {memberName(o, members)}
                    </option>
                  ))}
                  <option value={JOINT_OWNER}>Joint / family</option>
                </select>
              </Field>
              <Field label="Country">
                <select
                  className={selectCls}
                  value={f.country}
                  onChange={(e) => {
                    const c = e.target.value;
                    const cur = c === "IL" ? "ILS" : "USD";
                    set({ country: c, ...(isNew ? { coverageCurrency: cur, costCurrency: cur } : {}) });
                  }}
                >
                  <option value="US">US</option>
                  <option value="IL">Israel</option>
                </select>
              </Field>
            </div>
            <Field label="Provider / employer plan" required>
              <input className={inputCls} placeholder="e.g. NICE — MetLife basic life" value={f.source} onChange={(e) => set({ source: e.target.value })} />
            </Field>
            {ownerAccounts.length > 0 ? (
              <Field label="Inside a savings policy?">
                <select className={selectCls} value={f.linkedSavingsAccountId} onChange={(e) => set({ linkedSavingsAccountId: e.target.value })}>
                  <option value="">No — standalone</option>
                  {ownerAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.provider} · {typeLabel(a.type)}
                      {a.policyLast4 ? ` ••${a.policyLast4}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </FormSection>
          <FormSection title="Amounts">
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field label="Cover amount">
                <input className={cn(inputCls, "num")} inputMode="decimal" placeholder="e.g. 500000" value={f.coverageAmount} onChange={(e) => set({ coverageAmount: e.target.value })} />
              </Field>
              <Field label="Currency">
                <select className={selectCls} value={f.coverageCurrency} onChange={(e) => set({ coverageCurrency: e.target.value })}>
                  <option value="USD">USD</option>
                  <option value="ILS">ILS</option>
                </select>
              </Field>
              <Field label="Monthly cost">
                <input className={cn(inputCls, "num")} inputMode="decimal" placeholder="0 if employer-paid" value={f.monthlyCost} onChange={(e) => set({ monthlyCost: e.target.value })} />
              </Field>
              <Field label="Currency">
                <select className={selectCls} value={f.costCurrency} onChange={(e) => set({ costCurrency: e.target.value })}>
                  <option value="USD">USD</option>
                  <option value="ILS">ILS</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paid by">
                <select className={selectCls} value={f.payer} onChange={(e) => set({ payer: e.target.value })}>
                  <option value="">—</option>
                  {BENEFIT_PAYERS.map((p) => (
                    <option key={p} value={p}>
                      {PAYER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ends">
                <input type="date" className={inputCls} value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
              </Field>
            </div>
            <Field label="Beneficiary">
              <input className={inputCls} placeholder="e.g. Dana" value={f.beneficiary} onChange={(e) => set({ beneficiary: e.target.value })} />
            </Field>
          </FormSection>
          <FormSection title="Notes">
            <textarea
              className={cn(inputCls, "min-h-20 resize-y")}
              placeholder="e.g. Ends if leaving NICE; portable at extra cost"
              value={f.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </FormSection>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Drawer>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this coverage?"
        description={
          benefit?.origin === "pdf-import"
            ? "It came from a statement import, so importing the same statement again will add it back."
            : "This can’t be undone."
        }
        confirmLabel="Delete coverage"
        busy={busy === "delete"}
        onConfirm={doDelete}
      />
    </>
  );
}

