"use client";

import * as React from "react";
import { Check, CircleAlert, Copy, ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useDisplayCurrency } from "@/components/ui/currency";
import { Field, inputCls } from "@/components/properties/shared";
import { formatShortDate } from "@/lib/property-attention";

/* ── Small display pieces ────────────────────────────────────────────── */

/** Every portal link renders as this button. */
export function LoginButton({ href, label = "Log in" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong bg-surface px-2.5 text-xs font-medium text-foreground no-underline transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** An account / loan / policy number with a copy button. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span className="num truncate">{value}</span>
      <Tooltip content={copied ? "Copied" : `Copy ${label.toLowerCase()}`}>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked: the value is still selectable */
            }
          }}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </Tooltip>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </span>
  );
}

/* ── Field specs: one description drives both the form and the view ─── */

export type FieldType =
  | "text"
  | "number"
  | "year"
  | "money"
  | "percent"
  | "date"
  | "url"
  | "select"
  | "checkbox"
  | "textarea"
  | "dates"
  | "email"
  | "tel";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly { value: string; label: string }[];
  /** Show a copy button next to the value. */
  copy?: boolean;
  /** Grid columns in the form (out of 6). Default 2. */
  span?: 1 | 2 | 3 | 4 | 6;
  placeholder?: string;
  required?: boolean;
  /** Hide in the view when this returns false (e.g. ARM-only fields). */
  showIf?: (values: Record<string, unknown>) => boolean;
}

export type Values = Record<string, unknown>;

type FormState = Record<string, string | boolean>;

export function toFormState(fields: FieldSpec[], values: Values | null | undefined): FormState {
  const out: FormState = {};
  for (const f of fields) {
    const v = values?.[f.key];
    if (f.type === "checkbox") out[f.key] = v === true;
    else if (f.type === "dates") out[f.key] = Array.isArray(v) ? v.join(", ") : "";
    else out[f.key] = v == null ? "" : String(v);
  }
  return out;
}

export function fromFormState(fields: FieldSpec[], state: FormState): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = state[f.key];
    if (f.type === "checkbox") out[f.key] = v === true;
    else if (f.type === "number" || f.type === "year" || f.type === "money" || f.type === "percent") {
      const s = String(v ?? "").replace(/[$,%\s]/g, "");
      out[f.key] = s === "" ? null : Number(s);
    } else if (f.type === "dates") {
      out[f.key] = String(v ?? "")
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else out[f.key] = String(v ?? "");
  }
  return out;
}

const INPUT_TYPE: Partial<Record<FieldType, string>> = {
  number: "number",
  year: "number",
  money: "number",
  percent: "number",
  date: "date",
  url: "url",
  email: "email",
  tel: "tel",
};

const SPAN: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
};

export function FieldsForm({
  fields,
  state,
  onChange,
  idPrefix,
}: {
  fields: FieldSpec[];
  state: FormState;
  onChange: (next: FormState) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
      {fields.filter((f) => (f.showIf ? f.showIf(state) : true)).map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const set = (v: string | boolean) => onChange({ ...state, [f.key]: v });
        if (f.type === "checkbox") {
          return (
            <label key={f.key} htmlFor={id} className={cn("flex items-center gap-2 text-sm text-foreground sm:pt-6", SPAN[f.span ?? 2])}>
              <input
                id={id}
                type="checkbox"
                checked={state[f.key] === true}
                onChange={(e) => set(e.target.checked)}
                className="size-4 accent-[var(--ring)]"
              />
              {f.label}
            </label>
          );
        }
        return (
          <div key={f.key} className={SPAN[f.span ?? 2]}>
            <Field label={f.label + (f.type === "percent" ? " (%)" : "")} required={f.required}>
              {f.type === "select" ? (
                <select id={id} value={String(state[f.key] ?? "")} onChange={(e) => set(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={id}
                  rows={2}
                  value={String(state[f.key] ?? "")}
                  onChange={(e) => set(e.target.value)}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              ) : (
                <input
                  id={id}
                  type={INPUT_TYPE[f.type] ?? "text"}
                  step={f.type === "percent" ? "0.001" : f.type === "money" ? "0.01" : f.type === "number" ? "any" : undefined}
                  min={f.type === "money" ? 0 : undefined}
                  required={f.required}
                  value={String(state[f.key] ?? "")}
                  onChange={(e) => set(e.target.value)}
                  placeholder={f.placeholder ?? (f.type === "dates" ? "2027-04-10, 2027-12-10" : f.type === "url" ? "https://" : undefined)}
                  className={inputCls}
                />
              )}
            </Field>
          </div>
        );
      })}
    </div>
  );
}

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

export function useFormatValue() {
  const { money } = useDisplayCurrency();
  return React.useCallback(
    (f: FieldSpec, v: unknown): React.ReactNode => {
      if (isEmpty(v)) return null;
      switch (f.type) {
        case "money":
          return <span className="num">{money(Number(v))}</span>;
        case "percent":
          return <span className="num">{Number(v).toFixed(3).replace(/\.?0+$/, "")}%</span>;
        case "number":
          return <span className="num">{Number(v).toLocaleString("en-US")}</span>;
        case "year":
          return <span className="num">{String(v)}</span>;
        case "date":
          return formatShortDate(String(v));
        case "dates":
          return (v as string[]).map(formatShortDate).join(" · ");
        case "url":
          return <LoginButton href={String(v)} />;
        case "checkbox":
          return v === true ? "Yes" : "No";
        case "select":
          return f.options?.find((o) => o.value === v)?.label ?? String(v);
        case "email":
          return (
            <a href={`mailto:${String(v)}`} className="text-primary hover:underline">
              {String(v)}
            </a>
          );
        case "tel":
          return (
            <a href={`tel:${String(v)}`} className="num text-primary hover:underline">
              {String(v)}
            </a>
          );
        default:
          return f.copy ? <CopyValue value={String(v)} label={f.label} /> : String(v);
      }
    },
    [money]
  );
}

/** Filled fields as a definition list; blanks are left out. */
export function FieldsView({ fields, values, className }: { fields: FieldSpec[]; values: Values; className?: string }) {
  const fmt = useFormatValue();
  const shown = fields.filter((f) => (f.showIf ? f.showIf(values) : true) && !isEmpty(values[f.key]) && !(f.type === "checkbox" && values[f.key] === null));
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {shown.map((f) => (
        <div key={f.key} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className="mt-0.5 min-w-0 break-words text-sm text-foreground">{fmt(f, values[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Section shell ───────────────────────────────────────────────────── */

export function SectionCard({
  id,
  icon,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary [&_svg]:size-4" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="px-5 pb-5 sm:px-6">{children}</div>
    </section>
  );
}

/** "Nothing here yet" inside a section, with the one next step. */
export function SectionEmpty({ text, action }: { text: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-subtle/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
      <CircleAlert className="size-4 shrink-0" aria-hidden /> {error}
    </div>
  );
}

export function FormActions({ saving, onCancel, submitLabel = "Save" }: { saving: boolean; onCancel: () => void; submitLabel?: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        <X className="size-4" aria-hidden />
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}

export function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <Pencil className="size-3.5" aria-hidden />
      Edit
    </Button>
  );
}

export function AddButton({ onClick, label, variant = "outline" }: { onClick: () => void; label: string; variant?: "outline" | "primary" }) {
  return (
    <Button variant={variant} size="sm" onClick={onClick}>
      <Plus className="size-4" aria-hidden />
      {label}
    </Button>
  );
}

export function DeleteButton({ onClick, label, busy }: { onClick: () => void; label: string; busy?: boolean }) {
  return (
    <Tooltip content="Delete">
      <Button variant="danger-ghost" size="icon-sm" onClick={onClick} aria-label={label} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
      </Button>
    </Tooltip>
  );
}

/** Parse an API error body into one line. */
export async function apiError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}
