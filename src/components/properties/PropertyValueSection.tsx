"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Home, Loader2, Pencil, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { computeAppreciation } from "@/lib/property";

interface ValueInfo {
  purchasePrice: number | null;
  downPayment: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  valueAsOf: string | null;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

export default function PropertyValueSection({
  propertyId,
  property,
  today,
}: {
  propertyId: string;
  property: ValueInfo;
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    purchasePrice: property.purchasePrice != null ? String(property.purchasePrice) : "",
    downPayment: property.downPayment != null ? String(property.downPayment) : "",
    purchaseDate: property.purchaseDate ?? "",
    currentValue: property.currentValue != null ? String(property.currentValue) : "",
    valueAsOf: property.valueAsOf ?? "",
  });

  const appr = computeAppreciation(property);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
          downPayment: form.downPayment ? Number(form.downPayment) : null,
          purchaseDate: form.purchaseDate || null,
          currentValue: form.currentValue ? Number(form.currentValue) : null,
          valueAsOf: form.valueAsOf || (form.currentValue ? today : null),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Failed to save");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-[#FFB547]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Value & appreciation</h3>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="pressable inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <Pencil className="w-3.5 h-3.5" />
            {property.currentValue == null ? "Add estimate" : "Update"}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Purchase price">
              <input type="number" min="0" step="1000" value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                placeholder="450000" className={inputCls} />
            </Field>
            <Field label="Down payment">
              <input type="number" min="0" step="1000" value={form.downPayment}
                onChange={(e) => setForm({ ...form, downPayment: e.target.value })}
                placeholder="90000" className={inputCls} />
            </Field>
            <Field label="Purchase date">
              <input type="date" value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className={inputCls} />
            </Field>
            <Field label="Current value (Zestimate)">
              <input type="number" min="0" step="1000" value={form.currentValue}
                onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                placeholder="600000" className={inputCls} />
            </Field>
            <Field label="Estimate as of">
              <input type="date" value={form.valueAsOf}
                onChange={(e) => setForm({ ...form, valueAsOf: e.target.value })}
                className={inputCls} />
            </Field>
          </div>
          {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className="pressable inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button type="submit" disabled={saving}
              className="pressable inline-flex items-center gap-2 rounded-lg bg-[#FFB547] px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      ) : property.currentValue == null ? (
        <p className="text-sm text-[var(--muted-foreground)] py-1">
          Add the purchase price and the current Zestimate to see your appreciation and yearly return.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Purchase → current */}
          <div className="flex items-center gap-3">
            <ValueBox label="Bought for" value={property.purchasePrice} sub={property.purchaseDate ?? undefined} />
            <span className="text-[var(--muted-foreground)]">→</span>
            <ValueBox label="Now worth" value={property.currentValue} sub={property.valueAsOf ?? undefined} accent />
          </div>

          {appr && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric
                label="Total gain"
                value={formatCurrency(appr.gain)}
                tone={appr.gain >= 0 ? "pos" : "neg"}
                icon={appr.gain >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              />
              <Metric label="Total appreciation" value={pct(appr.totalPct)} tone={appr.totalPct >= 0 ? "pos" : "neg"} />
              <Metric
                label="Yearly appreciation"
                value={pct(appr.annualizedPct)}
                tone={appr.annualizedPct >= 0 ? "pos" : "neg"}
                sub={appr.years >= 0.1 ? `over ${appr.years.toFixed(1)} yrs` : undefined}
                highlight
              />
              {appr.returnOnDownPct != null && (
                <Metric
                  label="Return on down pmt"
                  value={pct(appr.returnOnDownPct)}
                  tone={appr.returnOnDownPct >= 0 ? "pos" : "neg"}
                  sub="from appreciation"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#FFB547]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function ValueBox({ label, value, sub, accent }: { label: string; value: number | null; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("flex-1 rounded-xl border p-3", accent ? "border-[#FFB547]/40 bg-[#FFB547]/5" : "border-[var(--border)]")}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-bold font-data text-[var(--foreground)]">{value != null ? formatCurrency(value) : "—"}</p>
      {sub && <p className="text-[11px] text-[var(--muted-foreground)] font-data">{sub}</p>}
    </div>
  );
}

function Metric({
  label, value, tone, sub, icon, highlight,
}: {
  label: string; value: string; tone: "pos" | "neg"; sub?: string; icon?: React.ReactNode; highlight?: boolean;
}) {
  const color = tone === "pos" ? "text-[#00D68F]" : "text-[#FF4D6A]";
  return (
    <div className={cn("rounded-xl border p-3", highlight ? "border-[#FFB547]/40 bg-[#FFB547]/5" : "border-[var(--border)]")}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">{label}</p>
      <p className={cn("text-base font-bold font-data flex items-center gap-1", color)}>
        {icon}{value}
      </p>
      {sub && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
    </div>
  );
}
