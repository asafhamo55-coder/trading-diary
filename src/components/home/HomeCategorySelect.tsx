"use client";

import type { HomeCategoryTree, PropertyOption } from "@/lib/home";

export interface Selection {
  categoryId: string | null;
  propertyId: string | null;
}

const PROP_PREFIX = "property:";

/**
 * Grouped select over the two-level category tree plus a "Property expenses"
 * group (attribute a Home expense to a Hamo Properties property). A category
 * and a property are mutually exclusive — picking one clears the other.
 */
export default function HomeCategorySelect({
  tree,
  properties,
  categoryId,
  propertyId,
  onSelect,
  className,
  placeholder = "Uncategorized",
}: {
  tree: HomeCategoryTree[];
  properties: PropertyOption[];
  categoryId: string | null;
  propertyId: string | null;
  onSelect: (sel: Selection) => void;
  className?: string;
  placeholder?: string;
}) {
  const value = propertyId ? `${PROP_PREFIX}${propertyId}` : categoryId ?? "";
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) onSelect({ categoryId: null, propertyId: null });
        else if (v.startsWith(PROP_PREFIX))
          onSelect({ categoryId: null, propertyId: v.slice(PROP_PREFIX.length) });
        else onSelect({ categoryId: v, propertyId: null });
      }}
      className={className}
    >
      <option value="">{placeholder}</option>
      {tree.map((parent) => (
        <optgroup key={parent.id} label={parent.name}>
          <option value={parent.id}>{parent.name} (general)</option>
          {parent.children.map((c) => (
            <option key={c.id} value={c.id}>
              {parent.name} › {c.name}
            </option>
          ))}
        </optgroup>
      ))}
      {properties.length > 0 && (
        <optgroup label="Property expenses">
          {properties.map((p) => (
            <option key={p.id} value={`${PROP_PREFIX}${p.id}`}>
              {p.title}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
