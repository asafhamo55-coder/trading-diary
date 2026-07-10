"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  X,
  Mail,
  Phone,
  Pencil,
  LogOut,
  CircleAlert,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, SectionHeader, inputCls } from "@/components/properties/shared";
import {
  isCurrentTenant,
  sortTenantsByRecency,
  type TenantDTO,
} from "@/lib/property";

interface FormState {
  name: string;
  email: string;
  phone: string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: string;
  securityDeposit: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  leaseStart: "",
  leaseEnd: "",
  monthlyRent: "",
  securityDeposit: "",
  notes: "",
};

export default function TenantsSection({
  propertyId,
  tenants,
  today,
}: {
  propertyId: string;
  tenants: TenantDTO[];
  today: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const sorted = sortTenantsByRecency(tenants);
  const current = sorted.filter((t) => isCurrentTenant(t, today));
  const past = sorted.filter((t) => !isCurrentTenant(t, today));

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(t: TenantDTO) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      email: t.email ?? "",
      phone: t.phone ?? "",
      leaseStart: t.leaseStart,
      leaseEnd: t.leaseEnd ?? "",
      monthlyRent: t.monthlyRent != null ? String(t.monthlyRent) : "",
      securityDeposit: t.securityDeposit != null ? String(t.securityDeposit) : "",
      notes: t.notes ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      leaseStart: form.leaseStart,
      leaseEnd: form.leaseEnd || null,
      monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : null,
      securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : null,
      notes: form.notes || null,
    };
    try {
      const url = editingId
        ? `/api/properties/${propertyId}/tenants/${editingId}`
        : `/api/properties/${propertyId}/tenants`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save tenant");
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tenant");
    } finally {
      setSaving(false);
    }
  }

  async function endLease(t: TenantDTO) {
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaseEnd: today }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTenant(id: string) {
    const res = await fetch(`/api/properties/${propertyId}/tenants/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader
          icon={<Users className="w-3.5 h-3.5 text-accent-amber" />}
          title="Tenants"
          meta={`${current.length} current · ${past.length} past`}
        />
        {!showForm && (
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add tenant
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 rounded-xl border border-[var(--border)] border-t-2 border-t-accent-amber/40 bg-[var(--card)] p-4 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
              {editingId ? "Edit tenant" : "New tenant"}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowForm(false)}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                className={inputCls}
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@email.com"
                className={inputCls}
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className={inputCls}
              />
            </Field>
            <Field label="Monthly rent (optional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyRent}
                onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
                placeholder="2000"
                className={inputCls}
              />
            </Field>
            <Field label="Lease start" required>
              <input
                required
                type="date"
                value={form.leaseStart}
                onChange={(e) => setForm({ ...form, leaseStart: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Lease end (blank = current)">
              <input
                type="date"
                value={form.leaseEnd}
                onChange={(e) => setForm({ ...form, leaseEnd: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Security deposit (optional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.securityDeposit}
                onChange={(e) =>
                  setForm({ ...form, securityDeposit: e.target.value })
                }
                placeholder="2000"
                className={inputCls}
              />
            </Field>
            <Field label="Notes (optional)">
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. renewed 1-year lease"
                className={inputCls}
              />
            </Field>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
              <CircleAlert className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Save changes" : "Add tenant"}
            </Button>
          </div>
        </form>
      )}

      {sorted.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="mb-3 flex items-center justify-center w-12 h-12 rounded-xl bg-accent-amber/10 ring-1 ring-inset ring-accent-amber/20">
            <Users className="w-6 h-6 text-accent-amber" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-[var(--foreground)] mb-1">
            No tenants yet
          </h4>
          <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-4">
            Add the current tenant, or backfill past ones to keep a leasing
            history.
          </p>
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add tenant
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {current.length > 0 && (
            <TenantGroup
              title="Current"
              tenants={current}
              today={today}
              onEdit={openEdit}
              onEndLease={endLease}
              onDelete={deleteTenant}
            />
          )}
          {past.length > 0 && (
            <div className={cn(current.length > 0 && "border-t border-[var(--border)] pt-5")}>
              <TenantGroup
                title="Past tenants"
                tenants={past}
                today={today}
                onEdit={openEdit}
                onEndLease={endLease}
                onDelete={deleteTenant}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TenantGroup({
  title,
  tenants,
  today,
  onEdit,
  onEndLease,
  onDelete,
}: {
  title: string;
  tenants: TenantDTO[];
  today: string;
  onEdit: (t: TenantDTO) => void;
  onEndLease: (t: TenantDTO) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {tenants.map((t) => {
          const active = isCurrentTenant(t, today);
          return (
            <div
              key={t.id}
              className="rounded-xl border border-[var(--border)] p-4 group hover:border-[var(--muted-foreground)]/30 hover:bg-[var(--muted)]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5",
                        active
                          ? "bg-profit/15 text-profit"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      )}
                    >
                      {active ? "Current" : "Past"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1 font-data tabular-nums">
                    {t.leaseStart} → {t.leaseEnd ?? "ongoing"}
                    {t.monthlyRent != null && (
                      <span className="ml-2">· {formatCurrency(t.monthlyRent)}/mo</span>
                    )}
                  </p>
                  {(t.email || t.phone) && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted-foreground)]">
                      {t.email && (
                        <a
                          href={`mailto:${t.email}`}
                          className="inline-flex items-center gap-1 hover:text-[var(--foreground)]"
                        >
                          <Mail className="w-3 h-3" />
                          {t.email}
                        </a>
                      )}
                      {t.phone && (
                        <a
                          href={`tel:${t.phone}`}
                          className="inline-flex items-center gap-1 hover:text-[var(--foreground)]"
                        >
                          <Phone className="w-3 h-3" />
                          {t.phone}
                        </a>
                      )}
                    </div>
                  )}
                  {t.securityDeposit != null && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      Deposit held: {formatCurrency(t.securityDeposit)}
                    </p>
                  )}
                  {t.notes && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">
                      {t.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {active && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEndLease(t)}
                      title="End lease (mark moved out today)"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onEdit(t)}
                    title="Edit tenant"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="icon-sm"
                    onClick={() => onDelete(t.id)}
                    title="Delete tenant"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
