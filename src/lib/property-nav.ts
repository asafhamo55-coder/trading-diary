// Hamo Properties — the property list in the shared sidebar. Pure: the API
// route shapes properties into items, the sidebar groups items into a tree.

import { buildingKey, propertyTitle, stripUnitDesignator, unitLabelOf } from "./property";

/** One active property, as /api/properties/nav returns it. */
export interface PropertyNavItem {
  id: string;
  title: string;
  /** Building name, set only when another active property shares the building. */
  building?: string;
  /** Unit designator within that building ("2", "4B"). */
  unit?: string;
  usage: string;
}

export type PropertyNavNode =
  | { kind: "property"; item: PropertyNavItem }
  | { kind: "building"; title: string; units: PropertyNavItem[] };

/**
 * Active properties → sidebar items. Archived ones are dropped; units of a
 * multi-unit building carry the building's name and their unit label.
 */
export function toPropertyNavItems(
  properties: {
    id: string;
    nickname?: string | null;
    address: string;
    street: string | null;
    unit: string | null;
    city?: string | null;
    state: string | null;
    zip: string | null;
    usage: string;
    archivedAt: Date | string | null;
  }[]
): PropertyNavItem[] {
  const active = properties.filter((p) => !p.archivedAt);
  const counts = new Map<string, number>();
  const keys = active.map((p) => {
    const k = buildingKey(p);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    return k;
  });
  // One name per building, from its first unit, so units whose addresses are
  // recorded in different shapes still nest under the same heading.
  const names = new Map<string, string>();
  return active.map((p, i) => {
    const title = propertyTitle(p);
    const item: PropertyNavItem = { id: p.id, title, usage: p.usage };
    if ((counts.get(keys[i]) ?? 0) > 1) {
      if (!names.has(keys[i])) {
        names.set(keys[i], stripUnitDesignator((p.street ?? "").trim() || p.address.split(",")[0] || title));
      }
      item.building = names.get(keys[i]);
      item.unit = unitLabelOf(p) ?? undefined;
    }
    return item;
  });
}

/**
 * Items → sidebar tree, sorted: the primary residence first, then by title.
 * Units sharing a `building` nest under it (sorted by unit, numbers in order).
 */
export function groupPropertyNav(items: PropertyNavItem[]): PropertyNavNode[] {
  const nodes: PropertyNavNode[] = [];
  const buildings = new Map<string, Extract<PropertyNavNode, { kind: "building" }>>();
  for (const item of items) {
    if (!item.building) {
      nodes.push({ kind: "property", item });
      continue;
    }
    let b = buildings.get(item.building);
    if (!b) {
      b = { kind: "building", title: item.building, units: [] };
      buildings.set(item.building, b);
      nodes.push(b);
    }
    b.units.push(item);
  }
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  for (const b of buildings.values()) {
    b.units.sort((a, c) => collator.compare(a.unit ?? a.title, c.unit ?? c.title));
  }
  const rank = (n: PropertyNavNode) => (n.kind === "property" && n.item.usage === "residence" ? 0 : 1);
  const label = (n: PropertyNavNode) => (n.kind === "property" ? n.item.title : n.title);
  return nodes.sort((a, b) => rank(a) - rank(b) || collator.compare(label(a), label(b)));
}

/** Label for a unit inside its building ("Unit 2"), or the title as a fallback. */
export function unitNavLabel(item: PropertyNavItem): string {
  return item.unit ? `Unit ${item.unit}` : item.title;
}
