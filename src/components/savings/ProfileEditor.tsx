"use client";

import * as React from "react";
import { Baby, Plus, RefreshCw, Save, Sparkles, Trash2, User, Users } from "lucide-react";
import { Field, inputCls } from "@/components/properties/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_USD_ILS_RATE,
  ageAt,
  CONTACT_ROLES,
  type ContactRole,
  type HouseholdContact,
  type HouseholdGoals,
  type HouseholdMember,
  type SavingsAccountLite,
} from "@/lib/savings";
import type { HouseholdProfileDTO } from "@/lib/savings-data";
import { cn } from "@/lib/utils";
import { api, errMsg } from "./api";
import { fmtDate, memberName, numToField, parseNum } from "./format";
import { useDisplayCurrency } from "@/components/ui/currency";
import { ConfirmDialog, Notice, selectCls } from "./ui";
import { useFlash } from "./useFlash";

// ── Form model ─────────────────────────────────────────────────────

interface MemberRow {
  uid: string; // client-only row id
  isNew: boolean;
  key: string;
  name: string;
  nameHe: string;
  role: "adult" | "child";
  birthDate: string;
  targetRetirementAge: string;
  employment: string;
  residence: string;
}

interface PurchaseRow {
  uid: string;
  label: string;
  amount: string;
  currency: "ILS" | "USD";
  targetYear: string;
}

interface ContactRow {
  uid: string;
  id: string;
  name: string;
  role: ContactRole;
  country: "IL" | "US";
  email: string;
  phone: string;
  language: "he" | "en";
  notes: string;
}

const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  insurance_agent: "Insurance agent (סוכן ביטוח)",
  pension_agent: "Pension agent (סוכן פנסיוני)",
  cpa: "CPA / accountant",
  hr_benefits: "HR / benefits",
  provider: "Provider (fund / plan)",
  property_manager: "Property manager",
  other: "Other",
};

interface ProfileForm {
  members: MemberRow[];
  contacts: ContactRow[];
  retirementIncome: string;
  retirementCurrency: "ILS" | "USD";
  purchases: PurchaseRow[];
  relocationPlan: string;
  relocationCountry: string;
  relocationYear: string;
  childrenEducation: string;
  otherGoals: string;
  goalsText: string;
  riskPreset: string;
  riskNotes: string;
  usdIlsRate: string;
}

const RISK_PRESETS = [
  { value: "conservative", label: "Conservative", hint: "Protect capital; accept lower growth." },
  { value: "moderate", label: "Moderate", hint: "Balanced; some ups and downs are fine." },
  { value: "growth", label: "Growth", hint: "Mostly equities; ride out drops for long-run returns." },
  { value: "aggressive", label: "Aggressive", hint: "Maximum growth; large swings are OK." },
] as const;

let uidCounter = 0;
const uid = () => `r${++uidCounter}`;

function parseRisk(s: string | null): { preset: string; notes: string } {
  if (!s) return { preset: "", notes: "" };
  const lower = s.toLowerCase();
  const p = RISK_PRESETS.find((r) => lower.startsWith(r.value));
  if (!p) return { preset: "", notes: s };
  return { preset: p.value, notes: s.slice(p.value.length).replace(/^\s*[—:-]\s*/, "") };
}

function toForm(p: HouseholdProfileDTO): ProfileForm {
  const g: HouseholdGoals = p.goals ?? {};
  const risk = parseRisk(p.riskTolerance);
  const members = [...p.members].sort((a, b) => (a.role === b.role ? 0 : a.role === "adult" ? -1 : 1));
  return {
    members: members.map((m) => ({
      uid: uid(),
      isNew: false,
      key: m.key,
      name: m.name ?? "",
      nameHe: m.nameHe ?? "",
      role: m.role,
      birthDate: m.birthDate ?? "",
      targetRetirementAge: numToField(m.targetRetirementAge),
      employment: m.employment ?? "",
      residence: m.residence ?? "",
    })),
    contacts: (p.contacts ?? []).map((c) => ({
      uid: uid(),
      id: c.id,
      name: c.name,
      role: c.role,
      country: c.country,
      email: c.email ?? "",
      phone: c.phone ?? "",
      language: c.language,
      notes: c.notes ?? "",
    })),
    retirementIncome: numToField(g.retirementTargetMonthlyIncome),
    retirementCurrency: g.retirementTargetCurrency ?? "ILS",
    purchases: (g.plannedPurchases ?? []).map((x) => ({
      uid: uid(),
      label: x.label,
      amount: numToField(x.amount),
      currency: x.currency ?? "ILS",
      targetYear: numToField(x.targetYear),
    })),
    relocationPlan: g.relocation?.plan ?? "",
    relocationCountry: g.relocation?.country ?? "",
    relocationYear: numToField(g.relocation?.targetYear),
    childrenEducation: g.childrenEducation ?? "",
    otherGoals: g.other ?? "",
    goalsText: p.goalsText ?? "",
    riskPreset: risk.preset,
    riskNotes: risk.notes,
    usdIlsRate: numToField(p.usdIlsRate),
  };
}

const t = (s: string) => (s.trim() ? s.trim() : null);

function slugKey(name: string, taken: Set<string>): string {
  let base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  if (!base) base = "member";
  let k = base;
  let i = 2;
  while (taken.has(k)) k = `${base}_${i++}`;
  return k;
}

/** Validate and convert to the PUT /api/savings/profile body. */
function toPayload(f: ProfileForm): { body?: Record<string, unknown>; error?: string } {
  const keys = new Set<string>();
  const members: HouseholdMember[] = [];
  for (const m of f.members) {
    const label = m.name || m.nameHe || m.key || "A member";
    if (!m.name.trim() && !m.nameHe.trim()) return { error: "Every member needs a name." };
    if (!/^[a-z0-9_-]+$/i.test(m.key)) return { error: `${label}: the ID may only use letters, digits, - or _.` };
    if (keys.has(m.key)) return { error: `Two members share the ID “${m.key}”.` };
    keys.add(m.key);
    let tra: number | null = null;
    if (m.role === "adult" && m.targetRetirementAge.trim()) {
      const n = parseNum(m.targetRetirementAge);
      if (n == null || !Number.isInteger(n) || n < 40 || n > 90) return { error: `${label}: target retirement age must be 40–90.` };
      tra = n;
    }
    members.push({
      key: m.key,
      name: t(m.name),
      nameHe: t(m.nameHe),
      role: m.role,
      birthDate: m.birthDate || null,
      ...(m.role === "adult"
        ? { targetRetirementAge: tra, employment: t(m.employment), residence: t(m.residence) }
        : { residence: t(m.residence) }),
    });
  }
  const num = (s: string, what: string, opts: { int?: boolean; min?: number; max?: number } = {}) => {
    const n = parseNum(s);
    if (n == null) return { v: null };
    if (Number.isNaN(n)) return { error: `${what} must be a number.` };
    if (opts.int && !Number.isInteger(n)) return { error: `${what} must be a whole number.` };
    if (opts.min != null && n < opts.min) return { error: `${what} must be at least ${opts.min}.` };
    if (opts.max != null && n > opts.max) return { error: `${what} must be at most ${opts.max}.` };
    return { v: n };
  };
  const income = num(f.retirementIncome, "Retirement income", { min: 0 });
  if (income.error) return { error: income.error };
  const relYear = num(f.relocationYear, "Relocation year", { int: true, min: 2000, max: 2100 });
  if (relYear.error) return { error: relYear.error };
  const rate = num(f.usdIlsRate, "USD/ILS rate", { min: 1, max: 10 });
  if (rate.error) return { error: rate.error };
  const purchases = [];
  for (const p of f.purchases) {
    if (!p.label.trim() && !p.amount.trim() && !p.targetYear.trim()) continue;
    if (!p.label.trim()) return { error: "Each planned purchase needs a description." };
    const amt = num(p.amount, `“${p.label}” amount`, { min: 0 });
    if (amt.error) return { error: amt.error };
    const yr = num(p.targetYear, `“${p.label}” year`, { int: true, min: 2000, max: 2100 });
    if (yr.error) return { error: yr.error };
    purchases.push({ label: p.label.trim(), amount: amt.v, currency: p.currency, targetYear: yr.v });
  }
  const hasRelocation = f.relocationPlan.trim() || f.relocationCountry.trim() || relYear.v != null;
  const goals: HouseholdGoals = {
    retirementTargetMonthlyIncome: income.v,
    retirementTargetCurrency: f.retirementCurrency,
    plannedPurchases: purchases,
    relocation: hasRelocation
      ? { plan: t(f.relocationPlan), country: t(f.relocationCountry), targetYear: relYear.v }
      : null,
    childrenEducation: t(f.childrenEducation),
    other: t(f.otherGoals),
  };
  const contacts: HouseholdContact[] = [];
  const contactIds = new Set<string>();
  for (const c of f.contacts) {
    if (!c.name.trim()) return { error: "Every contact needs a name." };
    if (c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) return { error: `${c.name}: the email address doesn’t look right.` };
    let id = c.id || slugKey(c.name, contactIds);
    if (contactIds.has(id)) id = slugKey(`${id}-2`, contactIds);
    contactIds.add(id);
    contacts.push({
      id,
      name: c.name.trim(),
      role: c.role,
      country: c.country,
      email: t(c.email),
      phone: t(c.phone),
      language: c.language,
      notes: t(c.notes),
    });
  }
  const risk = f.riskPreset
    ? `${f.riskPreset}${f.riskNotes.trim() ? ` — ${f.riskNotes.trim()}` : ""}`
    : t(f.riskNotes);
  return {
    body: {
      members,
      goals,
      goalsText: t(f.goalsText),
      riskTolerance: risk ? risk.slice(0, 200) : null,
      usdIlsRate: rate.v,
      contacts,
    },
  };
}

// ── Component ──────────────────────────────────────────────────────

export default function ProfileEditor({
  initial,
  initialAccounts,
}: {
  initial?: HouseholdProfileDTO;
  initialAccounts?: SavingsAccountLite[];
}) {
  const preview = !!initial;
  const [saved, setSaved] = React.useState<HouseholdProfileDTO | null>(initial ?? null);
  const [form, setForm] = React.useState<ProfileForm | null>(initial ? toForm(initial) : null);
  const [accounts, setAccounts] = React.useState<SavingsAccountLite[]>(initialAccounts ?? []);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);
  const { flash, node: flashNode } = useFlash();
  const liveFx = useDisplayCurrency();

  const load = React.useCallback(async () => {
    if (preview) return;
    setLoadError(null);
    try {
      const [p, a] = await Promise.all([
        api<HouseholdProfileDTO>("/api/savings/profile"),
        api<SavingsAccountLite[]>("/api/savings/accounts?includeArchived=1").catch(() => [] as SavingsAccountLite[]),
      ]);
      setSaved(p);
      setForm(toForm(p));
      setAccounts(a);
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, [preview]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="space-y-6">
        <ProfileHeader />
        <Notice tone="danger" title="Couldn’t load the profile">
          <p>{loadError}</p>
          <Button className="mt-3" size="sm" variant="secondary" icon={<RefreshCw />} onClick={() => void load()}>
            Try again
          </Button>
        </Notice>
      </div>
    );
  }
  if (!form || !saved) {
    return (
      <div className="space-y-6" aria-busy="true">
        <ProfileHeader />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const baseline = JSON.stringify(toPayload(toForm(saved)).body ?? null);
  const parsed = toPayload(form);
  const dirty = parsed.body ? JSON.stringify(parsed.body) !== baseline : true;
  const now = new Date();

  const update = (patch: Partial<ProfileForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const updateMember = (u: string, patch: Partial<MemberRow>) =>
    setForm((f) => {
      if (!f) return f;
      return {
        ...f,
        members: f.members.map((m) => {
          if (m.uid !== u) return m;
          const next = { ...m, ...patch };
          // New members get an ID derived from their name until saved.
          if (m.isNew && patch.name !== undefined) {
            const taken = new Set(f.members.filter((x) => x.uid !== u).map((x) => x.key));
            next.key = slugKey(patch.name, taken);
          }
          return next;
        }),
      };
    });
  const addMember = (role: "adult" | "child") =>
    setForm((f) => {
      if (!f) return f;
      const taken = new Set(f.members.map((x) => x.key));
      const row: MemberRow = {
        uid: uid(),
        isNew: true,
        key: slugKey(role === "child" ? "child" : "member", taken),
        name: "",
        nameHe: "",
        role,
        birthDate: "",
        targetRetirementAge: "",
        employment: "",
        residence: "",
      };
      return { ...f, members: [...f.members, row] };
    });
  const removeMember = (u: string) => setForm((f) => (f ? { ...f, members: f.members.filter((m) => m.uid !== u) } : f));
  const updateContact = (u: string, patch: Partial<ContactRow>) =>
    setForm((f) => (f ? { ...f, contacts: f.contacts.map((c) => (c.uid === u ? { ...c, ...patch } : c)) } : f));
  const addContact = () =>
    update({
      contacts: [
        ...form.contacts,
        { uid: uid(), id: "", name: "", role: "insurance_agent", country: "IL", email: "", phone: "", language: "he", notes: "" },
      ],
    });
  const updatePurchase = (u: string, patch: Partial<PurchaseRow>) =>
    setForm((f) => (f ? { ...f, purchases: f.purchases.map((p) => (p.uid === u ? { ...p, ...patch } : p)) } : f));

  async function save() {
    const r = toPayload(form!);
    if (r.error) return setError(r.error);
    setError(null);
    if (preview) return setError("Preview mode — changes are not saved.");
    setSaving(true);
    try {
      const p = await api<HouseholdProfileDTO>("/api/savings/profile", { method: "PUT", body: r.body });
      setSaved(p);
      setForm(toForm(p));
      flash("Profile saved");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const adults = form.members.filter((m) => m.role === "adult");
  const kids = form.members.filter((m) => m.role === "child");
  const ownedCount = (key: string) => accounts.filter((a) => a.owner === key).length;

  return (
    <div className="space-y-6 pb-20">
      <ProfileHeader
        updatedAt={saved.updatedAt}
        actions={
          <Button icon={<Save />} loading={saving} disabled={!dirty} onClick={save}>
            Save profile
          </Button>
        }
      />

      <Card variant="subtle" className="flex gap-3 p-4 sm:p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-fg">
          <Sparkles className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-foreground">This is what the AI advisor plans around</p>
          <p className="mt-0.5 text-foreground-secondary">
            Ages and target retirement ages set the time horizon; residence and the relocation plan decide which tax rules
            apply (Israel, US, or both); goals and risk tolerance shape the recommendations. Blank fields are treated as
            unknown and the advisor will say what it assumed.
          </p>
        </div>
      </Card>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {/* Members */}
      <Card>
        <CardHeader
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<User />} onClick={() => addMember("adult")}>
                Add adult
              </Button>
              <Button size="sm" variant="secondary" icon={<Baby />} onClick={() => addMember("child")}>
                Add child
              </Button>
            </div>
          }
        >
          <CardTitle as="h2" className="flex items-center gap-1.5">
            Household members <InfoTip tip="profile.members" />
          </CardTitle>
          <CardDescription>The ID links each person to their accounts and coverages; it can’t change after saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.members.length === 0 ? (
            <EmptyState
              variant="compact"
              icon={<Users />}
              title="No household members yet"
              description="Add the adults and children. Importing statements also adds the people found in them."
            />
          ) : null}
          {adults.length > 0 ? (
            <MemberGroup title="Adults">
              {adults.map((m) => (
                <MemberEditor
                  key={m.uid}
                  m={m}
                  now={now}
                  onChange={(p) => updateMember(m.uid, p)}
                  onRemove={() => (m.isNew ? removeMember(m.uid) : setRemoving(m))}
                />
              ))}
            </MemberGroup>
          ) : null}
          {kids.length > 0 ? (
            <MemberGroup title="Children">
              {kids.map((m) => (
                <MemberEditor
                  key={m.uid}
                  m={m}
                  now={now}
                  onChange={(p) => updateMember(m.uid, p)}
                  onRemove={() => (m.isNew ? removeMember(m.uid) : setRemoving(m))}
                />
              ))}
            </MemberGroup>
          ) : null}
        </CardContent>
      </Card>

      {/* Goals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-1.5">
            Retirement <InfoTip tip="profile.retirement" />
          </CardTitle>
            <CardDescription>The monthly income you want in retirement, in today’s money.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="Target monthly income">
                <input
                  className={cn(inputCls, "num")}
                  inputMode="decimal"
                  placeholder="e.g. 30000"
                  value={form.retirementIncome}
                  onChange={(e) => update({ retirementIncome: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <select
                  className={selectCls}
                  value={form.retirementCurrency}
                  onChange={(e) => update({ retirementCurrency: e.target.value as "ILS" | "USD" })}
                >
                  <option value="ILS">ILS ₪</option>
                  <option value="USD">USD $</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-1.5">
            Risk tolerance <InfoTip tip="profile.risk" />
          </CardTitle>
            <CardDescription>How much short-term loss you can live with for long-term growth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div role="radiogroup" aria-label="Risk tolerance" className="grid grid-cols-2 gap-2">
              {RISK_PRESETS.map((r) => {
                const on = form.riskPreset === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ riskPreset: on ? "" : r.value })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "border-primary bg-primary-subtle" : "border-border hover:border-border-strong hover:bg-subtle"
                    )}
                  >
                    <span className={cn("block text-sm font-medium", on ? "text-primary" : "text-foreground")}>{r.label}</span>
                    <span className="block text-xs text-muted-foreground">{r.hint}</span>
                  </button>
                );
              })}
            </div>
            <Field label="Notes">
              <input
                className={inputCls}
                placeholder="e.g. Alex more aggressive than Dana; keep 1 year of expenses in cash"
                value={form.riskNotes}
                onChange={(e) => update({ riskNotes: e.target.value })}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus />}
              onClick={() =>
                update({ purchases: [...form.purchases, { uid: uid(), label: "", amount: "", currency: "ILS", targetYear: "" }] })
              }
            >
              Add purchase
            </Button>
          }
        >
          <CardTitle as="h2" className="flex items-center gap-1.5">
            Planned purchases <InfoTip tip="profile.purchases" />
          </CardTitle>
          <CardDescription>Big-ticket items the plan has to fund — a home, a car, a wedding, a sabbatical.</CardDescription>
        </CardHeader>
        <CardContent>
          {form.purchases.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
              No planned purchases.
            </p>
          ) : (
            <ul className="space-y-3">
              {form.purchases.map((p) => (
                <li
                  key={p.uid}
                  className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_6rem_auto] sm:border-0 sm:p-0"
                >
                  <div className="col-span-2 sm:col-span-1">
                    <Field label="What">
                      <input className={inputCls} value={p.label} placeholder="e.g. Apartment for Noa" onChange={(e) => updatePurchase(p.uid, { label: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Amount">
                    <input className={cn(inputCls, "num")} inputMode="decimal" value={p.amount} onChange={(e) => updatePurchase(p.uid, { amount: e.target.value })} />
                  </Field>
                  <Field label="Currency">
                    <select className={selectCls} value={p.currency} onChange={(e) => updatePurchase(p.uid, { currency: e.target.value as "ILS" | "USD" })}>
                      <option value="ILS">ILS</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                  <Field label="Year">
                    <input className={cn(inputCls, "num")} inputMode="numeric" placeholder="2030" value={p.targetYear} onChange={(e) => updatePurchase(p.uid, { targetYear: e.target.value })} />
                  </Field>
                  <Button
                    variant="danger-ghost"
                    size="icon"
                    aria-label={`Remove ${p.label || "purchase"}`}
                    onClick={() => update({ purchases: form.purchases.filter((x) => x.uid !== p.uid) })}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card id="contacts" className="scroll-mt-20">
        <CardHeader
          actions={
            <Button size="sm" variant="secondary" icon={<Plus />} onClick={addContact}>
              Add contact
            </Button>
          }
        >
          <CardTitle as="h2">Agents & contacts</CardTitle>
          <CardDescription>
            Who acts for you — insurance and pension agents, the CPA, HR, the property manager. The advisor addresses its
            ready-to-send emails to them (Hebrew for Israeli contacts, English for US ones).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {form.contacts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
              No contacts yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {form.contacts.map((c) => (
                <li key={c.uid} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)_5rem_5.5rem_minmax(0,1.6fr)_minmax(0,1fr)_auto]">
                  <div className="col-span-2 lg:col-span-1">
                    <Field label="Name">
                      <input className={inputCls} value={c.name} onChange={(e) => updateContact(c.uid, { name: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Field label="Role">
                      <select className={selectCls} value={c.role} onChange={(e) => updateContact(c.uid, { role: e.target.value as ContactRole })}>
                        {CONTACT_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {CONTACT_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Country">
                    <select
                      className={selectCls}
                      value={c.country}
                      onChange={(e) => {
                        const country = e.target.value as "IL" | "US";
                        updateContact(c.uid, { country, language: country === "IL" ? "he" : "en" });
                      }}
                    >
                      <option value="IL">IL</option>
                      <option value="US">US</option>
                    </select>
                  </Field>
                  <Field label="Language">
                    <select className={selectCls} value={c.language} onChange={(e) => updateContact(c.uid, { language: e.target.value as "he" | "en" })}>
                      <option value="he">עברית</option>
                      <option value="en">English</option>
                    </select>
                  </Field>
                  <div className="col-span-2 lg:col-span-1">
                    <Field label="Email">
                      <input className={inputCls} type="email" dir="ltr" value={c.email} onChange={(e) => updateContact(c.uid, { email: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Phone">
                    <input className={inputCls} type="tel" dir="ltr" value={c.phone} onChange={(e) => updateContact(c.uid, { phone: e.target.value })} />
                  </Field>
                  <Button
                    variant="danger-ghost"
                    size="icon"
                    aria-label={`Remove ${c.name || "contact"}`}
                    onClick={() => update({ contacts: form.contacts.filter((x) => x.uid !== c.uid) })}
                  >
                    <Trash2 />
                  </Button>
                  <div className="col-span-2 lg:col-span-7">
                    <Field label="Notes">
                      <input className={inputCls} value={c.notes} placeholder="e.g. handles the manager's-insurance policies" onChange={(e) => updateContact(c.uid, { notes: e.target.value })} />
                    </Field>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-1.5">
            Relocation <InfoTip tip="profile.relocation" />
          </CardTitle>
            <CardDescription>A planned move changes which accounts are tax-efficient and which currency to hold.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Plan">
              <textarea
                className={cn(inputCls, "min-h-20 resize-y")}
                placeholder="e.g. Return to Israel when Maya finishes high school"
                value={form.relocationPlan}
                onChange={(e) => update({ relocationPlan: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="To country">
                <input className={inputCls} placeholder="IL" value={form.relocationCountry} onChange={(e) => update({ relocationCountry: e.target.value })} />
              </Field>
              <Field label="Target year">
                <input className={cn(inputCls, "num")} inputMode="numeric" placeholder="2031" value={form.relocationYear} onChange={(e) => update({ relocationYear: e.target.value })} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-1.5">
            Children’s education <InfoTip tip="profile.education" />
          </CardTitle>
            <CardDescription>Army service, university in Israel or the US, who pays for what.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className={cn(inputCls, "min-h-[8.5rem] resize-y")}
              placeholder="e.g. Noa: army until 2028 then Technion; Eli: maybe US college 2028; Maya: undecided"
              value={form.childrenEducation}
              onChange={(e) => update({ childrenEducation: e.target.value })}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-1.5">
            Anything else <InfoTip tip="profile.other" />
          </CardTitle>
          <CardDescription>Other goals, constraints and context — in your own words.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field label="Other goals">
            <textarea
              className={cn(inputCls, "min-h-28 resize-y")}
              placeholder="e.g. Help parents; retire Dana early; sabbatical in 2029"
              value={form.otherGoals}
              onChange={(e) => update({ otherGoals: e.target.value })}
            />
          </Field>
          <Field label="Notes for the advisor">
            <textarea
              className={cn(inputCls, "min-h-28 resize-y")}
              placeholder="e.g. NICE RSUs are concentrated — open to diversifying; expecting an inheritance"
              value={form.goalsText}
              onChange={(e) => update({ goalsText: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-1.5">
            Exchange rate <InfoTip tip="profile.fx" />
          </CardTitle>
          <CardDescription>
            Used to add ILS and USD balances together and for the $ / ₪ switch. Leave blank to use the live
            Bank of Israel representative rate
            {liveFx.source === "live" ? ` (now ${liveFx.rate.toFixed(3)} · ${liveFx.provenance})` : ""}, refreshed every
            few hours; if that&apos;s unreachable, USD_ILS_RATE or {DEFAULT_USD_ILS_RATE} is used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Field label="ILS per 1 USD">
              <input
                className={cn(inputCls, "num")}
                inputMode="decimal"
                placeholder={liveFx.source === "live" ? liveFx.rate.toFixed(3) : String(DEFAULT_USD_ILS_RATE)}
                value={form.usdIlsRate}
                onChange={(e) => update({ usdIlsRate: e.target.value })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar when there are unsaved changes */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:left-sidebar md:sidebar-collapsed:left-sidebar-collapsed">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="min-w-0 flex-1 truncate text-sm text-foreground-secondary">You have unsaved changes</p>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => setForm(toForm(saved))}>
              Discard
            </Button>
            <Button size="sm" icon={<Save />} loading={saving} onClick={save}>
              Save profile
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing ? removing.name || removing.nameHe || removing.key : ""}?`}
        description={
          removing && ownedCount(removing.key) > 0 ? (
            <>
              {ownedCount(removing.key)} account{ownedCount(removing.key) === 1 ? "" : "s"} belong to “{removing.key}”. They are
              kept, but will show under an unknown owner until you reassign them. Takes effect when you save.
            </>
          ) : (
            "They’ll be removed from the household when you save."
          )
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing) removeMember(removing.uid);
          setRemoving(null);
        }}
      />
      {flashNode}
    </div>
  );
}

function ProfileHeader({ updatedAt, actions }: { updatedAt?: string | null; actions?: React.ReactNode }) {
  return (
    <PageHeader
      title="Household profile & goals"
      description="Who’s in the household, when you want to retire, what you’re saving for, and how much risk you’re comfortable with."
      meta={updatedAt ? <Badge variant="neutral">Updated {fmtDate(updatedAt.slice(0, 10))}</Badge> : null}
      actions={actions}
    />
  );
}

function MemberGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MemberEditor({
  m,
  now,
  onChange,
  onRemove,
}: {
  m: MemberRow;
  now: Date;
  onChange: (patch: Partial<MemberRow>) => void;
  onRemove: () => void;
}) {
  const age = ageAt(m.birthDate || null, now);
  const adult = m.role === "adult";
  const display = m.name || m.nameHe || "New member";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            adult ? "bg-primary-subtle text-primary" : "bg-accent-subtle text-accent-fg"
          )}
          aria-hidden
        >
          {display.trim()[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {memberName(m.key, [{ key: m.key, name: m.name, nameHe: m.nameHe, role: m.role }])}
            {age != null ? <span className="num ml-2 text-sm font-normal text-muted-foreground">age {age}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            ID{" "}
            {m.isNew ? (
              <input
                aria-label="Member ID"
                className="num ml-1 w-32 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs text-foreground focus:border-accent-amber focus:outline-none"
                value={m.key}
                onChange={(e) => onChange({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
              />
            ) : (
              <code className="num text-foreground-secondary">{m.key}</code>
            )}
            {!adult && age != null && age < 18 ? ` · turns 18 in ${new Date(m.birthDate).getUTCFullYear() + 18}` : ""}
          </p>
        </div>
        <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove ${display}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      <div className={cn("grid grid-cols-2 gap-3", adult ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-4")}>
        <Field label="Name" required>
          <input className={inputCls} value={m.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Hebrew name">
          <input dir="rtl" lang="he" className={inputCls} value={m.nameHe} onChange={(e) => onChange({ nameHe: e.target.value })} />
        </Field>
        <Field label="Birth date">
          <input type="date" className={inputCls} value={m.birthDate} onChange={(e) => onChange({ birthDate: e.target.value })} />
        </Field>
        {adult ? (
          <>
            <Field label="Target retirement age">
              <input
                className={cn(inputCls, "num")}
                inputMode="numeric"
                placeholder={`${DEFAULT_RETIREMENT_AGE} if blank`}
                value={m.targetRetirementAge}
                onChange={(e) => onChange({ targetRetirementAge: e.target.value })}
              />
            </Field>
            <Field label="Employment">
              <input
                className={inputCls}
                placeholder="e.g. NICE (employee)"
                value={m.employment}
                onChange={(e) => onChange({ employment: e.target.value })}
              />
            </Field>
          </>
        ) : null}
        <Field label="Residence">
          <select className={selectCls} value={m.residence} onChange={(e) => onChange({ residence: e.target.value })}>
            <option value="">—</option>
            <option value="US">United States</option>
            <option value="IL">Israel</option>
            {m.residence && m.residence !== "US" && m.residence !== "IL" ? <option value={m.residence}>{m.residence}</option> : null}
          </select>
        </Field>
      </div>
    </div>
  );
}
