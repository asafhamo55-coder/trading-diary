"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { sectionFilled, type ProfileSection } from "@/lib/property-profile";
import {
  AddButton,
  DeleteButton,
  EditButton,
  FieldsForm,
  FieldsView,
  FormActions,
  FormError,
  SectionCard,
  SectionEmpty,
  apiError,
  fromFormState,
  toFormState,
  type FieldSpec,
  type Values,
} from "./RecordKit";

/**
 * One single-value section of the record (insurance, property tax, …):
 * an empty state that invites filling it in, a read view, and an edit form.
 * Saving replaces the section through PATCH /api/properties/[id]/profile.
 */
export function ProfileSectionCard({
  propertyId,
  section,
  id,
  icon,
  title,
  description,
  fields,
  values,
  emptyText,
  extra,
}: {
  propertyId: string;
  section: Exclude<ProfileSection, "systems">;
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  fields: FieldSpec[];
  values: Values | undefined;
  emptyText: string;
  /** Derived figures shown under the fields (read view only). */
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [state, setState] = React.useState(() => toFormState(fields, values));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const filled = sectionFilled(values);

  const start = () => {
    setState(toFormState(fields, values));
    setError(null);
    setEditing(true);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: fromFormState(fields, state) }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Couldn't save"));
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      id={id}
      icon={icon}
      title={title}
      description={description}
      actions={!editing && filled ? <EditButton onClick={start} label={`Edit ${title.toLowerCase()}`} /> : null}
    >
      {editing ? (
        <form onSubmit={save} className="space-y-4">
          <FieldsForm fields={fields} state={state} onChange={setState} idPrefix={id} />
          <FormError error={error} />
          <FormActions saving={saving} onCancel={() => setEditing(false)} />
        </form>
      ) : filled ? (
        <div className="space-y-4">
          <FieldsView fields={fields} values={values ?? {}} />
          {extra}
        </div>
      ) : (
        <SectionEmpty text={emptyText} action={<AddButton onClick={start} label={`Add ${title === title.toUpperCase() ? title : title.toLowerCase()}`} />} />
      )}
    </SectionCard>
  );
}

/** How a list persists: the record tables, or an array inside the profile. */
export interface ListPersistence {
  create: (data: Values) => Promise<Response>;
  update: (itemId: string, data: Values) => Promise<Response>;
  remove: (itemId: string) => Promise<Response>;
}

export function recordListPersistence(propertyId: string, list: string): ListPersistence {
  const base = `/api/properties/${propertyId}/record/${list}`;
  const json = (method: string, data: Values) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return {
    create: (data) => fetch(base, json("POST", data)),
    update: (itemId, data) => fetch(`${base}/${itemId}`, json("PATCH", data)),
    remove: (itemId) => fetch(`${base}/${itemId}`, { method: "DELETE" }),
  };
}

/**
 * A list section (loans, improvements, maintenance, documents, utilities,
 * major systems): one row per item with edit / delete, an add form, and an
 * empty state.
 */
export function RecordListCard<T extends { id: string }>({
  id,
  icon,
  title,
  description,
  fields,
  items,
  persistence,
  emptyText,
  addLabel,
  itemTitle,
  renderItem,
  summary,
  defaults,
  layout = "rows",
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  fields: FieldSpec[];
  items: T[];
  persistence: ListPersistence;
  emptyText: string;
  addLabel: string;
  /** Accessible name for an item ("First mortgage · Example Bank"). */
  itemTitle: (item: T) => string;
  /** Custom read view of an item; defaults to the filled fields. */
  renderItem?: (item: T) => React.ReactNode;
  /** Shown above the items (totals). */
  summary?: React.ReactNode;
  /** Initial values for a new item. */
  defaults?: Values;
  layout?: "rows" | "cards";
}) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | "new" | null>(null);
  const [state, setState] = React.useState(() => toFormState(fields, defaults));
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const startNew = () => {
    setState(toFormState(fields, defaults));
    setError(null);
    setEditingId("new");
  };
  const startEdit = (item: T) => {
    setState(toFormState(fields, item as unknown as Values));
    setError(null);
    setEditingId(item.id);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = fromFormState(fields, state);
      const res = editingId === "new" ? await persistence.create(data) : await persistence.update(editingId!, data);
      if (!res.ok) throw new Error(await apiError(res, "Couldn't save"));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: T) {
    if (!window.confirm(`Delete ${itemTitle(item)}?`)) return;
    setBusyId(item.id);
    try {
      const res = await persistence.remove(item.id);
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const form = (
    <form onSubmit={save} className="space-y-4 rounded-lg border border-border bg-subtle/40 p-4">
      <FieldsForm fields={fields} state={state} onChange={setState} idPrefix={`${id}-${editingId}`} />
      <FormError error={error} />
      <FormActions saving={saving} onCancel={() => setEditingId(null)} submitLabel={editingId === "new" ? "Add" : "Save"} />
    </form>
  );

  return (
    <SectionCard
      id={id}
      icon={icon}
      title={title}
      description={description}
      actions={items.length > 0 && editingId === null ? <AddButton onClick={startNew} label={addLabel} /> : null}
    >
      <div className="space-y-3">
        {summary && items.length > 0 ? summary : null}
        {items.length === 0 && editingId !== "new" ? (
          <SectionEmpty text={emptyText} action={<AddButton onClick={startNew} label={addLabel} />} />
        ) : null}
        {items.length > 0 ? (
          <ul className={cn(layout === "cards" ? "grid grid-cols-1 gap-3 lg:grid-cols-2" : "divide-y divide-border rounded-lg border border-border")}>
            {items.map((item) =>
              editingId === item.id ? (
                <li key={item.id} className={layout === "cards" ? "lg:col-span-2" : "p-2"}>
                  {form}
                </li>
              ) : (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start justify-between gap-3",
                    layout === "cards" ? "rounded-lg border border-border p-4" : "px-4 py-3"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {renderItem ? renderItem(item) : <FieldsView fields={fields} values={item as unknown as Values} />}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <EditButton onClick={() => startEdit(item)} label={`Edit ${itemTitle(item)}`} />
                    <DeleteButton onClick={() => remove(item)} label={`Delete ${itemTitle(item)}`} busy={busyId === item.id} />
                  </div>
                </li>
              )
            )}
          </ul>
        ) : null}
        {editingId === "new" ? form : null}
      </div>
    </SectionCard>
  );
}
