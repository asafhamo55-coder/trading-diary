"use client";

import * as React from "react";
import {
  Banknote,
  Briefcase,
  Calculator,
  FileText,
  Hammer,
  Landmark,
  LayoutList,
  PlugZap,
  Ruler,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { useDisplayCurrency } from "@/components/ui/currency";
import {
  DEFAULT_DEPRECIATION_METHOD,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  IMPROVEMENT_CATEGORIES,
  LOAN_KINDS,
  LOAN_KIND_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  SYSTEM_KINDS,
  SYSTEM_LABELS,
  UTILITY_KINDS,
  UTILITY_LABELS,
  depreciationSummary,
  loanDerived,
  type PropertyDocumentDTO,
  type PropertyImprovementDTO,
  type PropertyLoanDTO,
  type PropertyMaintenanceDTO,
  type PropertyRecord,
  type PropertySystem,
  type PropertyUtilityDTO,
} from "@/lib/property-profile";
import { formatShortDate } from "@/lib/property-attention";
import { CopyValue, FieldsView, LoginButton, type FieldSpec, type Values } from "./RecordKit";
import { ProfileSectionCard, RecordListCard, recordListPersistence, type ListPersistence } from "./RecordCards";

const opts = <K extends string>(keys: readonly K[], labels: Record<K, string>) =>
  keys.map((k) => ({ value: k, label: labels[k] }));

/* ── Field specs ─────────────────────────────────────────────────────── */

const FACTS: FieldSpec[] = [
  { key: "propertyType", label: "Property type", type: "select", options: opts(PROPERTY_TYPES, PROPERTY_TYPE_LABELS) },
  { key: "beds", label: "Beds", type: "number", span: 1 },
  { key: "baths", label: "Baths", type: "number", span: 1 },
  { key: "sqft", label: "Living area (sq ft)", type: "number" },
  { key: "lotSqft", label: "Lot size (sq ft)", type: "number" },
  { key: "yearBuilt", label: "Year built", type: "year" },
  { key: "apn", label: "Parcel / APN", type: "text", copy: true },
];

const HOA: FieldSpec[] = [
  { key: "name", label: "HOA name", type: "text", span: 3 },
  { key: "monthlyDues", label: "Monthly dues", type: "money" },
  { key: "dueDay", label: "Due day of month", type: "number", span: 1 },
  { key: "contact", label: "Contact", type: "text" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "portalUrl", label: "Portal", type: "url", span: 6 },
];

const INSURANCE: FieldSpec[] = [
  { key: "carrier", label: "Carrier", type: "text" },
  { key: "policyNumber", label: "Policy number", type: "text", copy: true },
  { key: "portalUrl", label: "Portal", type: "url" },
  { key: "annualPremium", label: "Annual premium", type: "money" },
  { key: "renewalDate", label: "Renewal date", type: "date" },
  { key: "deductible", label: "Deductible", type: "money" },
  { key: "dwellingCoverage", label: "Dwelling coverage", type: "money" },
  { key: "liabilityCoverage", label: "Liability coverage", type: "money" },
  { key: "agentName", label: "Agent", type: "text" },
  { key: "agentPhone", label: "Agent phone", type: "tel" },
  { key: "agentEmail", label: "Agent email", type: "email" },
  { key: "umbrella", label: "Umbrella policy", type: "checkbox" },
  { key: "umbrellaCarrier", label: "Umbrella carrier", type: "text", showIf: (v) => v.umbrella === true },
];

const PROPERTY_TAX: FieldSpec[] = [
  { key: "county", label: "County", type: "text" },
  { key: "accountNumber", label: "Tax account / parcel no.", type: "text", copy: true },
  { key: "portalUrl", label: "Portal", type: "url" },
  { key: "assessedValue", label: "Assessed value", type: "money" },
  { key: "assessedYear", label: "Assessment year", type: "year" },
  { key: "annualTax", label: "Annual tax", type: "money" },
  { key: "dueDates", label: "Due dates", type: "dates", span: 6 },
  { key: "lastAppealDate", label: "Last appeal", type: "date" },
  { key: "nextAppealDeadline", label: "Next appeal deadline", type: "date" },
];

const MANAGEMENT: FieldSpec[] = [
  {
    key: "mode",
    label: "Managed by",
    type: "select",
    options: [
      { value: "self", label: "Self-managed" },
      { value: "manager", label: "Property manager" },
    ],
  },
  { key: "company", label: "Company", type: "text", showIf: (v) => v.mode !== "self" },
  { key: "contact", label: "Contact", type: "text", showIf: (v) => v.mode !== "self" },
  { key: "email", label: "Email", type: "email", showIf: (v) => v.mode !== "self" },
  { key: "phone", label: "Phone", type: "tel", showIf: (v) => v.mode !== "self" },
  {
    key: "feeType",
    label: "Fee type",
    type: "select",
    options: [
      { value: "percent", label: "% of rent" },
      { value: "flat", label: "Flat monthly" },
    ],
    showIf: (v) => v.mode !== "self",
  },
  { key: "feeValue", label: "Fee (% or $/mo)", type: "number", showIf: (v) => v.mode !== "self" },
  { key: "portalUrl", label: "Owner portal", type: "url", span: 6, showIf: (v) => v.mode !== "self" },
];

const TAX_BASIS: FieldSpec[] = [
  { key: "closingCosts", label: "Closing costs", type: "money" },
  { key: "landValue", label: "Land value", type: "money" },
  { key: "buildingValue", label: "Building value", type: "money" },
  { key: "allocationSource", label: "Land / building split source", type: "text", span: 4, placeholder: "County assessment ratio" },
  { key: "placedInService", label: "Placed in service", type: "date" },
  { key: "method", label: "Depreciation method", type: "text", span: 4, placeholder: DEFAULT_DEPRECIATION_METHOD },
  { key: "costSegStudy", label: "Cost segregation study done", type: "checkbox" },
  { key: "costSegNotes", label: "Cost segregation notes", type: "textarea", span: 6, showIf: (v) => v.costSegStudy === true },
];

const LOAN: FieldSpec[] = [
  { key: "kind", label: "Loan", type: "select", options: opts(LOAN_KINDS, LOAN_KIND_LABELS) },
  { key: "lender", label: "Lender", type: "text" },
  { key: "servicer", label: "Servicer", type: "text" },
  { key: "loanNumber", label: "Loan number", type: "text", copy: true },
  { key: "portalUrl", label: "Portal", type: "url" },
  { key: "servicerPhone", label: "Servicer phone", type: "tel" },
  { key: "originalAmount", label: "Original amount", type: "money" },
  { key: "startDate", label: "Start date", type: "date" },
  { key: "termMonths", label: "Term (months)", type: "number" },
  { key: "interestRate", label: "Interest rate", type: "percent" },
  {
    key: "rateType",
    label: "Rate type",
    type: "select",
    options: [
      { value: "fixed", label: "Fixed" },
      { value: "arm", label: "Adjustable (ARM)" },
    ],
  },
  { key: "armResetDate", label: "Next reset", type: "date", showIf: (v) => v.rateType === "arm" },
  { key: "armIndex", label: "Index", type: "text", showIf: (v) => v.rateType === "arm" },
  { key: "armMargin", label: "Margin", type: "percent", showIf: (v) => v.rateType === "arm" },
  { key: "monthlyPI", label: "Monthly P&I", type: "money" },
  { key: "escrowMonthly", label: "Escrow (tax + ins.) /mo", type: "money" },
  { key: "pmiMonthly", label: "PMI /mo", type: "money" },
  { key: "pmiRemovalDate", label: "PMI removable from", type: "date" },
  { key: "maturityDate", label: "Maturity date", type: "date" },
  { key: "balance", label: "Current balance", type: "money" },
  { key: "balanceAsOf", label: "Balance as of", type: "date" },
  { key: "active", label: "Active (counts toward the mortgage balance)", type: "checkbox", span: 4 },
  { key: "notes", label: "Notes", type: "textarea", span: 6 },
];

const IMPROVEMENT: FieldSpec[] = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "description", label: "Description", type: "text", span: 4, required: true },
  { key: "amount", label: "Amount", type: "money", required: true },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: IMPROVEMENT_CATEGORIES.map((c) => ({ value: c, label: c === "improvement" ? "Improvement (capitalized)" : "Repair (expensed)" })),
  },
  { key: "notes", label: "Notes", type: "text" },
];

const SYSTEM: FieldSpec[] = [
  { key: "kind", label: "System", type: "select", options: opts(SYSTEM_KINDS, SYSTEM_LABELS), required: true },
  { key: "label", label: "Details", type: "text", span: 4, placeholder: "Make / model" },
  { key: "installYear", label: "Install year", type: "year" },
  { key: "warrantyEnd", label: "Warranty ends", type: "date" },
  { key: "lastService", label: "Last service", type: "date" },
  { key: "notes", label: "Notes", type: "text", span: 6 },
];

const DOCUMENT: FieldSpec[] = [
  { key: "type", label: "Type", type: "select", options: opts(DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS) },
  { key: "title", label: "Name", type: "text", span: 4, required: true },
  { key: "url", label: "Link (e.g. Google Drive)", type: "url", span: 4, required: true },
  { key: "date", label: "Date", type: "date" },
];

const UTILITY: FieldSpec[] = [
  { key: "kind", label: "Utility", type: "select", options: opts(UTILITY_KINDS, UTILITY_LABELS), required: true },
  { key: "provider", label: "Provider", type: "text" },
  {
    key: "paidBy",
    label: "Paid by",
    type: "select",
    options: [
      { value: "tenant", label: "Tenant" },
      { value: "owner", label: "Owner" },
    ],
  },
  { key: "accountNumber", label: "Account number", type: "text", copy: true, span: 3 },
  { key: "portalUrl", label: "Portal", type: "url", span: 3 },
];

/* ── Record sections ─────────────────────────────────────────────────── */

export const RECORD_NAV = [
  { id: "facts", label: "Facts" },
  { id: "loans", label: "Loans" },
  { id: "insurance", label: "Insurance" },
  { id: "property-tax", label: "Property tax" },
  { id: "hoa", label: "HOA" },
  { id: "management", label: "Management" },
  { id: "utilities", label: "Utilities" },
  { id: "tax-basis", label: "Tax basis" },
  { id: "improvements", label: "Improvements" },
  { id: "maintenance", label: "Maintenance" },
  { id: "documents", label: "Documents" },
] as const;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-subtle/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num truncate text-sm font-semibold text-foreground">{children}</p>
    </div>
  );
}

function monthsLabel(m: number | null): string {
  if (m == null) return "—";
  const y = Math.floor(m / 12);
  const r = m % 12;
  return [y ? `${y} yr` : "", r ? `${r} mo` : ""].filter(Boolean).join(" ") || "Paid off";
}

/** Systems live in the profile JSON as an array: persist by rewriting it. */
function systemsPersistence(propertyId: string, items: PropertySystem[]): ListPersistence {
  const put = (next: PropertySystem[]) =>
    fetch(`/api/properties/${propertyId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "systems", data: { items: next } }),
    });
  return {
    create: (data) => put([...items, data as unknown as PropertySystem]),
    update: (id, data) => put(items.map((s, i) => (String(i) === id ? (data as unknown as PropertySystem) : s))),
    remove: (id) => put(items.filter((_, i) => String(i) !== id)),
  };
}

export function PropertyRecordSections({
  propertyId,
  record,
  purchasePrice,
  today,
  expenseOptions,
}: {
  propertyId: string;
  record: PropertyRecord;
  purchasePrice: number | null;
  today: string;
  /** Expense entries a maintenance item can link to. */
  expenseOptions: { value: string; label: string }[];
}) {
  const { money } = useDisplayCurrency();
  const p = record.profile;
  const dep = depreciationSummary(p.taxBasis, record.improvements);
  const systems = (p.systems?.items ?? []).map((s, i) => ({ ...s, id: String(i) }));
  const activeLoans = record.loans.filter((l) => l.active);
  const loanBalance = activeLoans.reduce((s, l) => s + (l.balance ?? 0), 0);

  const maintenanceFields: FieldSpec[] = [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "vendor", label: "Vendor", type: "text" },
    { key: "system", label: "System", type: "select", options: opts(SYSTEM_KINDS, SYSTEM_LABELS) },
    { key: "cost", label: "Cost", type: "money" },
    { key: "transactionId", label: "Linked expense entry", type: "select", options: expenseOptions, span: 4 },
    { key: "notes", label: "Notes", type: "textarea", span: 6 },
  ];

  return (
    <div className="space-y-4">
      <nav aria-label="Property record sections" className="-mx-1 overflow-x-auto scrollbar-none">
        <ul className="flex min-w-max items-center gap-1.5 px-1">
          {RECORD_NAV.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-sm text-foreground-secondary no-underline transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <ProfileSectionCard
        propertyId={propertyId}
        section="facts"
        id="facts"
        icon={<Ruler />}
        title="Facts"
        description="Type, size and parcel"
        fields={FACTS}
        values={p.facts as Values | undefined}
        emptyText="Add the basics: type, beds and baths, size, year built and the parcel number."
      />

      <RecordListCard<PropertyLoanDTO>
        id="loans"
        icon={<Landmark />}
        title="Mortgage and loans"
        description="First mortgage, HELOC and other loans. Active balances set the property's mortgage figure."
        fields={LOAN}
        items={record.loans}
        persistence={recordListPersistence(propertyId, "loans")}
        emptyText="No loans on file. Add the mortgage to track its balance, rate and payment."
        addLabel="Add loan"
        defaults={{ kind: record.loans.length ? "heloc" : "first", rateType: "fixed", active: true }}
        itemTitle={(l) => `${LOAN_KIND_LABELS[l.kind]}${l.lender ? ` · ${l.lender}` : ""}`}
        summary={
          activeLoans.length > 1 ? (
            <p className="text-sm text-muted-foreground">
              {activeLoans.length} active loans · <span className="num font-medium text-foreground">{money(loanBalance)}</span> total balance
            </p>
          ) : null
        }
        renderItem={(l) => {
          const d = loanDerived(l, today);
          return (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {LOAN_KIND_LABELS[l.kind]}
                  {l.lender ? <span className="font-normal text-muted-foreground"> · {l.lender}</span> : null}
                </h3>
                {l.rateType === "arm" ? <Badge variant="warning">ARM</Badge> : <Badge variant="neutral">Fixed</Badge>}
                {!l.active ? <StatusPill tone="neutral" label="Paid off / inactive" /> : null}
                {l.portalUrl ? <LoginButton href={l.portalUrl} /> : null}
              </div>
              {l.loanNumber ? (
                <p className="text-sm text-foreground-secondary">
                  Loan no. <CopyValue value={l.loanNumber} label="Loan number" />
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={l.balanceAsOf ? `Balance · ${formatShortDate(l.balanceAsOf)}` : "Balance"}>{money(l.balance)}</Stat>
                <Stat label="Your rate">{l.interestRate != null ? `${l.interestRate}%` : "—"}</Stat>
                <Stat label="Monthly payment">{money(d.totalMonthlyPayment)}</Stat>
                <Stat label="Remaining">{monthsLabel(d.remainingMonths)}</Stat>
              </div>
              <FieldsView
                className="lg:grid-cols-4"
                fields={LOAN.filter((f) => !["kind", "lender", "loanNumber", "portalUrl", "balance", "balanceAsOf", "interestRate", "rateType", "active"].includes(f.key))}
                values={{ ...(l as unknown as Values), maturityDate: d.maturityDate }}
              />
              {d.interestYtd != null ? (
                <p className="text-xs text-muted-foreground">
                  Interest paid this year (estimate): <span className="num font-medium text-foreground">{money(d.interestYtd)}</span>
                </p>
              ) : null}
            </div>
          );
        }}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProfileSectionCard
          propertyId={propertyId}
          section="insurance"
          id="insurance"
          icon={<ShieldCheck />}
          title="Insurance"
          fields={INSURANCE}
          values={p.insurance as Values | undefined}
          emptyText="Add the policy: carrier, policy number, premium, renewal date and coverage."
        />
        <ProfileSectionCard
          propertyId={propertyId}
          section="tax"
          id="property-tax"
          icon={<Banknote />}
          title="Property tax"
          fields={PROPERTY_TAX}
          values={p.tax as Values | undefined}
          emptyText="Add the county account, assessed value, annual tax and due dates."
        />
        <ProfileSectionCard
          propertyId={propertyId}
          section="hoa"
          id="hoa"
          icon={<Users />}
          title="HOA"
          fields={HOA}
          values={p.hoa as Values | undefined}
          emptyText="No HOA on file. Add one if the property has association dues."
        />
        <ProfileSectionCard
          propertyId={propertyId}
          section="management"
          id="management"
          icon={<Briefcase />}
          title="Management"
          fields={MANAGEMENT}
          values={p.management as Values | undefined}
          emptyText="Self-managed or a property manager? Add the company, fee and portal."
        />
      </div>

      <RecordListCard<PropertyUtilityDTO>
        id="utilities"
        icon={<PlugZap />}
        title="Utilities"
        fields={UTILITY}
        items={record.utilities}
        persistence={recordListPersistence(propertyId, "utilities")}
        emptyText="Add electric, gas, water, sewer, trash and internet accounts, and who pays each."
        addLabel="Add utility"
        defaults={{ paidBy: "tenant" }}
        itemTitle={(u) => UTILITY_LABELS[u.kind]}
        renderItem={(u) => (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <span className="w-20 font-medium text-foreground">{UTILITY_LABELS[u.kind]}</span>
            <span className="min-w-0 text-foreground-secondary">{u.provider ?? "—"}</span>
            {u.accountNumber ? <CopyValue value={u.accountNumber} label={`${UTILITY_LABELS[u.kind]} account number`} /> : null}
            <Badge variant={u.paidBy === "owner" ? "warning" : "neutral"}>{u.paidBy === "owner" ? "Owner pays" : "Tenant pays"}</Badge>
            {u.portalUrl ? <LoginButton href={u.portalUrl} /> : null}
          </div>
        )}
      />

      <ProfileSectionCard
        propertyId={propertyId}
        section="taxBasis"
        id="tax-basis"
        icon={<Calculator />}
        title="Tax basis and depreciation"
        description={`Purchase price ${purchasePrice != null ? money(purchasePrice) : "not set"} (edit it under Value & appreciation)`}
        fields={TAX_BASIS}
        values={p.taxBasis as Values | undefined}
        emptyText="Add closing costs and the land / building split to compute depreciation."
        extra={
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Depreciable basis">{money(dep.depreciableBasis)}</Stat>
            <Stat label="Annual depreciation">{money(dep.annualDepreciation)}</Stat>
            <Stat label="Improvements">{money(dep.improvementsTotal)}</Stat>
            <Stat label="Method">{p.taxBasis?.method ?? "27.5-yr SL"}</Stat>
          </div>
        }
      />

      <RecordListCard<PropertyImprovementDTO>
        id="improvements"
        icon={<Hammer />}
        title="Improvements and capex"
        description="Improvements add to the depreciable basis; repairs are expensed."
        fields={IMPROVEMENT}
        items={record.improvements}
        persistence={recordListPersistence(propertyId, "improvements")}
        emptyText="Log capital improvements (new roof, remodel) and larger repairs."
        addLabel="Add improvement"
        defaults={{ category: "improvement", date: today }}
        itemTitle={(i) => i.description}
        renderItem={(i) => (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-foreground">{i.description}</span>
              <span className="text-muted-foreground"> · {formatShortDate(i.date)}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge variant={i.category === "improvement" ? "info" : "neutral"}>{i.category === "improvement" ? "Improvement" : "Repair"}</Badge>
              <span className="num font-semibold text-foreground">{money(i.amount)}</span>
            </span>
          </div>
        )}
      />

      <div id="maintenance" className="scroll-mt-20 space-y-4">
        <RecordListCard<PropertySystem & { id: string }>
          id="systems"
          icon={<LayoutList />}
          title="Major systems"
          description="Roof, HVAC, water heater, appliances"
          fields={SYSTEM}
          items={systems}
          persistence={systemsPersistence(propertyId, p.systems?.items ?? [])}
          emptyText="Track install years, warranties and service dates for the big-ticket systems."
          addLabel="Add system"
          itemTitle={(s) => SYSTEM_LABELS[s.kind]}
          renderItem={(s) => (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                {SYSTEM_LABELS[s.kind]}
                {s.label ? <span className="font-normal text-muted-foreground"> · {s.label}</span> : null}
              </h3>
              <FieldsView fields={SYSTEM.filter((f) => f.key !== "kind" && f.key !== "label")} values={s as unknown as Values} className="lg:grid-cols-4" />
            </div>
          )}
        />
        <RecordListCard<PropertyMaintenanceDTO>
          id="maintenance-log"
          icon={<Wrench />}
          title="Maintenance log"
          fields={maintenanceFields}
          items={record.maintenance}
          persistence={recordListPersistence(propertyId, "maintenance")}
          emptyText="Log service visits and repairs: date, vendor, cost and notes."
          addLabel="Add visit"
          defaults={{ date: today }}
          itemTitle={(m) => `${m.vendor ?? "Visit"} on ${formatShortDate(m.date)}`}
          renderItem={(m) => (
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span>
                  <span className="font-medium text-foreground">{m.vendor ?? "Service visit"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatShortDate(m.date)}
                    {m.system ? ` · ${SYSTEM_LABELS[m.system]}` : ""}
                  </span>
                </span>
                {m.cost != null ? <span className="num font-semibold text-foreground">{money(m.cost)}</span> : null}
              </div>
              {m.notes ? <p className="text-muted-foreground">{m.notes}</p> : null}
              {m.transactionId ? <Badge variant="neutral">Linked to an expense entry</Badge> : null}
            </div>
          )}
        />
      </div>

      <RecordListCard<PropertyDocumentDTO>
        id="documents"
        icon={<FileText />}
        title="Documents"
        description="Links only (for example Google Drive). Nothing is uploaded here."
        fields={DOCUMENT}
        items={record.documents}
        persistence={recordListPersistence(propertyId, "documents")}
        emptyText="Link the deed, closing statement, leases, insurance declarations, appraisal and tax bills."
        addLabel="Add link"
        defaults={{ type: "other" }}
        itemTitle={(d) => d.title}
        renderItem={(d) => (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-foreground">{d.title}</span>
              <span className="text-muted-foreground">
                {" "}
                · {DOCUMENT_TYPE_LABELS[d.type]}
                {d.date ? ` · ${formatShortDate(d.date)}` : ""}
              </span>
            </span>
            <LoginButton href={d.url} label="Open" />
          </div>
        )}
      />
    </div>
  );
}
