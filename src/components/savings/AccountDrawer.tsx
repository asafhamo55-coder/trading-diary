"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Save, Trash2 } from "lucide-react";
import { Field, inputCls } from "@/components/properties/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JOINT_OWNER, type HouseholdMember, type SavingsAccountLite } from "@/lib/savings";
import { cn } from "@/lib/utils";
import { defaultLoginUrl } from "@/lib/provider-links";
import { api, errMsg } from "./api";
import {
  TYPE_GROUPS,
  defaultCountryFor,
  fmtDate,
  memberName,
  money,
  numToField,
  parseNum,
  typeLabel,
  typeLabelHe,
} from "./format";
import { ConfirmDialog, Drawer, FormSection, Notice, selectCls } from "./ui";

type Snap = { asOf: string; balance: number };

interface FormState {
  owner: string;
  country: string;
  type: string;
  provider: string;
  planName: string;
  policyNumber: string;
  loginUrl: string;
  status: string;
  currency: string;
  balance: string;
  balanceAsOf: string;
  track: string;
  feeDepositPct: string;
  feeAccumulationPct: string;
  monthlyDepositEmployee: string;
  monthlyDepositEmployer: string;
  monthlyDepositSeverance: string;
  monthlyDepositTotal: string;
  insuredSalary: string;
  liquidityDate: string;
  projectedMonthlyPension: string;
  // details.*
  openDate: string;
  conversionFactor: string;
  notes: string;
  rsuTicker: string;
  rsuVestedShares: string;
  rsuUnvestedShares: string;
  rsuUnvestedValue: string;
  rsuNextVestDate: string;
}

const STATUS_OPTIONS = ["active", "inactive", "paid-up", "frozen", "closed"];

const NUMERIC_KEYS = [
  "balance",
  "feeDepositPct",
  "feeAccumulationPct",
  "monthlyDepositEmployee",
  "monthlyDepositEmployer",
  "monthlyDepositSeverance",
  "monthlyDepositTotal",
  "insuredSalary",
  "projectedMonthlyPension",
] as const;
const TEXT_KEYS = ["owner", "country", "type", "provider", "planName", "loginUrl", "status", "currency", "track"] as const;
const DATE_KEYS = ["balanceAsOf", "liquidityDate"] as const;

const str = (v: unknown) => (v == null ? "" : String(v));

function toForm(a: SavingsAccountLite | null, defaults: { owner: string; type?: string }): FormState {
  const d = (a?.details ?? {}) as Record<string, unknown>;
  const type = a?.type ?? defaults.type ?? "pension";
  const country = a?.country ?? defaultCountryFor(type);
  return {
    owner: a?.owner ?? defaults.owner,
    country,
    type,
    provider: a?.provider ?? "",
    planName: a?.planName ?? "",
    policyNumber: a?.policyNumber ?? "",
    loginUrl: a?.loginUrl ?? "",
    status: a?.status ?? (a ? "" : "active"),
    currency: a?.currency ?? (country === "US" ? "USD" : "ILS"),
    balance: numToField(a?.balance),
    balanceAsOf: a?.balanceAsOf ?? (a ? "" : new Date().toISOString().slice(0, 10)),
    track: a?.track ?? "",
    feeDepositPct: numToField(a?.feeDepositPct),
    feeAccumulationPct: numToField(a?.feeAccumulationPct),
    monthlyDepositEmployee: numToField(a?.monthlyDepositEmployee),
    monthlyDepositEmployer: numToField(a?.monthlyDepositEmployer),
    monthlyDepositSeverance: numToField(a?.monthlyDepositSeverance),
    monthlyDepositTotal: numToField(a?.monthlyDepositTotal),
    insuredSalary: numToField(a?.insuredSalary),
    liquidityDate: a?.liquidityDate ?? "",
    projectedMonthlyPension: numToField(a?.projectedMonthlyPension),
    openDate: str(d.openDate),
    conversionFactor: str(d.conversionFactor),
    notes: str(d.notes),
    rsuTicker: str(d.ticker),
    rsuVestedShares: str(d.vestedShares),
    rsuUnvestedShares: str(d.unvestedShares),
    rsuUnvestedValue: str(d.unvestedValue),
    rsuNextVestDate: str(d.nextVestDate),
  };
}

/** Merge the form's detail fields into the account's existing `details` JSON. */
function buildDetails(f: FormState, base: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  const out: Record<string, unknown> = { ...(base ?? {}) };
  const setStr = (k: string, v: string) => {
    if (v.trim()) out[k] = v.trim();
    else delete out[k];
  };
  const setNum = (k: string, v: string) => {
    const n = parseNum(v);
    if (n != null && Number.isFinite(n)) out[k] = n;
    else delete out[k];
  };
  setStr("openDate", f.openDate);
  setNum("conversionFactor", f.conversionFactor);
  setStr("notes", f.notes);
  if (f.type === "rsu") {
    setStr("ticker", f.rsuTicker.toUpperCase());
    setNum("vestedShares", f.rsuVestedShares);
    setNum("unvestedShares", f.rsuUnvestedShares);
    setNum("unvestedValue", f.rsuUnvestedValue);
    setStr("nextVestDate", f.rsuNextVestDate);
  }
  return Object.keys(out).length ? out : null;
}

const LABELS: Record<string, string> = {
  balance: "Balance",
  feeDepositPct: "Deposit fee %",
  feeAccumulationPct: "Accumulation fee %",
  monthlyDepositEmployee: "Employee deposit",
  monthlyDepositEmployer: "Employer deposit",
  monthlyDepositSeverance: "Severance deposit",
  monthlyDepositTotal: "Total monthly deposit",
  insuredSalary: "Insured salary",
  projectedMonthlyPension: "Projected monthly pension",
};

export function AccountDrawer({
  open,
  onOpenChange,
  account,
  snapshots,
  members,
  defaultOwner,
  onChanged,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → add a new account. */
  account: SavingsAccountLite | null;
  snapshots?: Snap[];
  members: HouseholdMember[];
  defaultOwner: string;
  /** Called after any successful save / archive / delete. */
  onChanged: (msg: string) => void;
  /** Preview mode: disable network writes. */
  readOnly?: boolean;
}) {
  const isNew = !account;
  const [form, setForm] = React.useState<FormState>(() => toForm(account, { owner: defaultOwner }));
  const [busy, setBusy] = React.useState<null | "save" | "archive" | "delete">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onTypeChange = (type: string) => {
    setForm((f) => {
      if (!isNew) return { ...f, type };
      const country = defaultCountryFor(type);
      return { ...f, type, country, currency: country === "US" ? "USD" : "ILS" };
    });
  };

  const ownerOptions = React.useMemo(() => {
    const opts = members.map((m) => ({ key: m.key, label: memberName(m.key, members), child: m.role === "child" }));
    if (form.owner && form.owner !== JOINT_OWNER && !opts.some((o) => o.key === form.owner)) {
      opts.push({ key: form.owner, label: memberName(form.owner, members), child: false });
    }
    return opts;
  }, [members, form.owner]);

  function validate(): string | null {
    if (!form.owner) return "Choose who owns this account.";
    if (!form.provider.trim()) return "Provider is required.";
    if (form.balance.trim() === "") return "Balance is required (use 0 if unknown).";
    for (const k of NUMERIC_KEYS) {
      const n = parseNum(form[k]);
      if (n != null && Number.isNaN(n)) return `${LABELS[k]} must be a number.`;
      if (n != null && n < 0 && k !== "balance") return `${LABELS[k]} can't be negative.`;
    }
    const dep = parseNum(form.feeDepositPct);
    if (dep != null && dep > 10) return "Deposit fee % looks too high (max 10%).";
    const acc = parseNum(form.feeAccumulationPct);
    if (acc != null && acc > 5) return "Accumulation fee % looks too high (max 5%).";
    return null;
  }

  function payload(): Record<string, unknown> {
    const full: Record<string, unknown> = {};
    for (const k of TEXT_KEYS) full[k] = form[k].trim() || null;
    for (const k of NUMERIC_KEYS) full[k] = parseNum(form[k]);
    for (const k of DATE_KEYS) full[k] = form[k] || null;
    full.details = buildDetails(form, account?.details);
    if (form.policyNumber.trim()) full.policyNumber = form.policyNumber.trim();
    if (isNew) return full;
    // PATCH only what changed (a balance change also writes a history snapshot).
    const orig = toForm(account, { owner: defaultOwner });
    const origFull: Record<string, unknown> = {};
    for (const k of TEXT_KEYS) origFull[k] = orig[k].trim() || null;
    for (const k of NUMERIC_KEYS) origFull[k] = parseNum(orig[k]);
    for (const k of DATE_KEYS) origFull[k] = orig[k] || null;
    origFull.details = account?.details ?? null;
    const diff: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(full)) {
      if (JSON.stringify(v) !== JSON.stringify(origFull[k])) diff[k] = v;
    }
    return diff;
  }

  async function save() {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    const body = payload();
    if (!isNew && Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    if (readOnly) return setError("Preview mode — changes are not saved.");
    setBusy("save");
    try {
      if (isNew) {
        await api("/api/savings/accounts", { method: "POST", body });
        onChanged(`Added ${form.provider.trim()}`);
      } else {
        await api(`/api/savings/accounts/${account.id}`, { method: "PATCH", body });
        onChanged(`Saved ${form.provider.trim()}`);
      }
      onOpenChange(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchive() {
    if (!account) return;
    if (readOnly) return setError("Preview mode — changes are not saved.");
    setBusy("archive");
    setError(null);
    try {
      const archived = !account.archivedAt;
      await api(`/api/savings/accounts/${account.id}`, { method: "PATCH", body: { archived } });
      onChanged(archived ? `Archived ${account.provider}` : `Restored ${account.provider}`);
      onOpenChange(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!account) return;
    if (readOnly) {
      setConfirmDelete(false);
      return setError("Preview mode — changes are not saved.");
    }
    setBusy("delete");
    try {
      await api(`/api/savings/accounts/${account.id}`, { method: "DELETE" });
      setConfirmDelete(false);
      onChanged(`Deleted ${account.provider}`);
      onOpenChange(false);
    } catch (e) {
      setConfirmDelete(false);
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  const t = form.type;
  const isIL = form.country === "IL";
  const hasDeposits = !["cash", "brokerage", "rsu", "other"].includes(t);
  const isPensionLike = ["pension", "managers_insurance", "gemel"].includes(t);
  const cur = form.currency === "USD" ? "$" : "₪";

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!busy) onOpenChange(o);
        }}
        title={isNew ? "Add account" : account.provider}
        description={
          isNew ? (
            "Add a pension, study fund, 401(k), RSU plan, brokerage or cash account."
          ) : (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {typeLabel(account.type)}
              {typeLabelHe(account.type) ? (
                <span dir="rtl" lang="he">
                  · {typeLabelHe(account.type)}
                </span>
              ) : null}
              {account.archivedAt ? <Badge variant="neutral">Archived</Badge> : null}
              {account.source && account.source !== "manual" ? (
                <Badge variant="info">From {account.source === "pdf-import" ? "statement import" : account.source}</Badge>
              ) : null}
            </span>
          )
        }
        footer={
          <>
            <Button icon={<Save />} loading={busy === "save"} disabled={!!busy && busy !== "save"} onClick={save}>
              {isNew ? "Add account" : "Save changes"}
            </Button>
            <Button variant="secondary" disabled={!!busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!isNew ? (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={account.archivedAt ? <ArchiveRestore /> : <Archive />}
                  loading={busy === "archive"}
                  disabled={!!busy && busy !== "archive"}
                  onClick={toggleArchive}
                >
                  {account.archivedAt ? "Restore" : "Archive"}
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  icon={<Trash2 />}
                  disabled={!!busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </div>
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

          <FormSection title="Account">
            <Field label="Type" required>
              <select className={selectCls} value={form.type} onChange={(e) => onTypeChange(e.target.value)}>
                {TYPE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.types.map((ty) => (
                      <option key={ty} value={ty}>
                        {typeLabel(ty)}
                        {typeLabelHe(ty) ? ` — ${typeLabelHe(ty)}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Owner" required>
                <select className={selectCls} value={form.owner} onChange={(e) => set("owner", e.target.value)}>
                  {ownerOptions.length === 0 ? <option value="">Add members in Profile first</option> : null}
                  {ownerOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                      {o.child ? " (child)" : ""}
                    </option>
                  ))}
                  <option value={JOINT_OWNER}>Joint</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <select className={selectCls} value={form.country} onChange={(e) => set("country", e.target.value)}>
                    <option value="IL">Israel</option>
                    <option value="US">US</option>
                  </select>
                </Field>
                <Field label="Currency">
                  <select className={selectCls} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                    <option value="ILS">ILS ₪</option>
                    <option value="USD">USD $</option>
                  </select>
                </Field>
              </div>
              <Field label={isIL ? "Provider (e.g. Migdal, Altshuler)" : "Provider (e.g. Fidelity, Schwab)"} required>
                <input className={inputCls} value={form.provider} onChange={(e) => set("provider", e.target.value)} />
              </Field>
              <Field label="Plan name">
                <input className={inputCls} value={form.planName} onChange={(e) => set("planName", e.target.value)} />
              </Field>
              <Field label="Policy / account no.">
                <input
                  className={inputCls}
                  value={form.policyNumber}
                  autoComplete="off"
                  placeholder={account?.policyLast4 && !account.policyNumber ? `Ends ••${account.policyLast4} — enter the full number` : "Full policy / account number"}
                  onChange={(e) => set("policyNumber", e.target.value)}
                />
              </Field>
              <Field label="Login page">
                <input
                  className={inputCls}
                  type="url"
                  value={form.loginUrl}
                  autoComplete="off"
                  placeholder={defaultLoginUrl(form.provider) ?? "https://…"}
                  onChange={(e) => set("loginUrl", e.target.value)}
                />
              </Field>
              <Field label="Status">
                <input
                  className={inputCls}
                  list="savings-status-options"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                />
                <datalist id="savings-status-options">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Balance"
            description={!isNew ? "Changing the balance or its date also adds a point to the balance history." : undefined}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t === "rsu" ? "Vested value" : "Balance"} (${cur})`} required>
                <input
                  className={cn(inputCls, "num")}
                  inputMode="decimal"
                  value={form.balance}
                  onChange={(e) => set("balance", e.target.value)}
                />
              </Field>
              <Field label="As of">
                <input
                  type="date"
                  className={inputCls}
                  value={form.balanceAsOf}
                  onChange={(e) => set("balanceAsOf", e.target.value)}
                />
              </Field>
            </div>
            {t !== "cash" && t !== "rsu" ? (
              <Field label="Investment track">
                <input
                  className={inputCls}
                  placeholder={isIL ? "e.g. מסלול מניות / age-based" : "e.g. Target date 2045"}
                  value={form.track}
                  onChange={(e) => set("track", e.target.value)}
                />
              </Field>
            ) : null}
          </FormSection>

          {t === "rsu" ? (
            <FormSection title="Equity grant" description="Unvested shares are not counted in net worth.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Ticker">
                  <input className={inputCls} value={form.rsuTicker} placeholder="NICE" onChange={(e) => set("rsuTicker", e.target.value)} />
                </Field>
                <Field label="Vested shares">
                  <input className={cn(inputCls, "num")} inputMode="decimal" value={form.rsuVestedShares} onChange={(e) => set("rsuVestedShares", e.target.value)} />
                </Field>
                <Field label="Unvested shares">
                  <input className={cn(inputCls, "num")} inputMode="decimal" value={form.rsuUnvestedShares} onChange={(e) => set("rsuUnvestedShares", e.target.value)} />
                </Field>
                <Field label={`Unvested value (${cur})`}>
                  <input className={cn(inputCls, "num")} inputMode="decimal" value={form.rsuUnvestedValue} onChange={(e) => set("rsuUnvestedValue", e.target.value)} />
                </Field>
                <Field label="Next vest date">
                  <input type="date" className={inputCls} value={form.rsuNextVestDate} onChange={(e) => set("rsuNextVestDate", e.target.value)} />
                </Field>
              </div>
            </FormSection>
          ) : null}

          {t !== "cash" && t !== "rsu" ? (
            <FormSection title="Fees" description="Deposit fee is charged on each deposit; accumulation fee on the balance each year.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deposit fee %">
                  <input className={cn(inputCls, "num")} inputMode="decimal" placeholder="e.g. 1.5" value={form.feeDepositPct} onChange={(e) => set("feeDepositPct", e.target.value)} />
                </Field>
                <Field label="Accumulation fee %">
                  <input className={cn(inputCls, "num")} inputMode="decimal" placeholder="e.g. 0.25" value={form.feeAccumulationPct} onChange={(e) => set("feeAccumulationPct", e.target.value)} />
                </Field>
              </div>
            </FormSection>
          ) : null}

          {hasDeposits ? (
            <FormSection title="Monthly deposits" description={`Per month, in ${form.currency}. Leave the split empty if you only know the total.`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Employee">
                  <input className={cn(inputCls, "num")} inputMode="decimal" value={form.monthlyDepositEmployee} onChange={(e) => set("monthlyDepositEmployee", e.target.value)} />
                </Field>
                <Field label="Employer">
                  <input className={cn(inputCls, "num")} inputMode="decimal" value={form.monthlyDepositEmployer} onChange={(e) => set("monthlyDepositEmployer", e.target.value)} />
                </Field>
                {isIL ? (
                  <Field label="Severance">
                    <input className={cn(inputCls, "num")} inputMode="decimal" value={form.monthlyDepositSeverance} onChange={(e) => set("monthlyDepositSeverance", e.target.value)} />
                  </Field>
                ) : null}
                <Field label="Total">
                  <input className={cn(inputCls, "num")} inputMode="decimal" value={form.monthlyDepositTotal} onChange={(e) => set("monthlyDepositTotal", e.target.value)} />
                </Field>
              </div>
            </FormSection>
          ) : null}

          {isPensionLike || t === "hishtalmut" || t === "gemel_investment" || t === "savings_policy" ? (
            <FormSection title="Plan details">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Open date">
                  <input type="date" className={inputCls} value={form.openDate} onChange={(e) => set("openDate", e.target.value)} />
                </Field>
                {t === "hishtalmut" ? (
                  <Field label="Liquidity date">
                    <input type="date" className={inputCls} value={form.liquidityDate} onChange={(e) => set("liquidityDate", e.target.value)} />
                  </Field>
                ) : null}
                {isPensionLike ? (
                  <>
                    <Field label={`Insured salary (${cur})`}>
                      <input className={cn(inputCls, "num")} inputMode="decimal" value={form.insuredSalary} onChange={(e) => set("insuredSalary", e.target.value)} />
                    </Field>
                    <Field label={`Projected monthly pension (${cur})`}>
                      <input className={cn(inputCls, "num")} inputMode="decimal" value={form.projectedMonthlyPension} onChange={(e) => set("projectedMonthlyPension", e.target.value)} />
                    </Field>
                    <Field label="Conversion factor (מקדם המרה)">
                      <input className={cn(inputCls, "num")} inputMode="decimal" placeholder="e.g. 200" value={form.conversionFactor} onChange={(e) => set("conversionFactor", e.target.value)} />
                    </Field>
                  </>
                ) : null}
              </div>
              {t === "hishtalmut" ? (
                <p className="text-xs text-muted-foreground">
                  If the statement doesn’t print a liquidity date, it’s derived as open date + 6 years.
                </p>
              ) : null}
            </FormSection>
          ) : null}

          <FormSection title="Notes">
            <textarea
              className={cn(inputCls, "min-h-20 resize-y")}
              placeholder="Anything the advisor should know (e.g. employer stops contributing in 2027)."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </FormSection>

          {!isNew && snapshots && snapshots.length > 0 ? (
            <FormSection title="Balance history">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {[...snapshots]
                  .reverse()
                  .slice(0, 12)
                  .map((s) => (
                    <li key={s.asOf} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{fmtDate(s.asOf)}</span>
                      <span className="num text-foreground">{money(s.balance, account.currency)}</span>
                    </li>
                  ))}
              </ul>
            </FormSection>
          ) : null}
          {/* Lets Enter submit the form. */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${account?.provider ?? "account"}?`}
        description={
          <>
            This permanently removes the account and its balance history. Coverages linked to it are kept but unlinked.
            <br />
            <span className="text-foreground-secondary">To hide it but keep the history, archive it instead.</span>
          </>
        }
        confirmLabel="Delete account"
        busy={busy === "delete"}
        onConfirm={doDelete}
      />
    </>
  );
}
