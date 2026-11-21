"use client";

import * as React from "react";
import type { PropertyNavItem } from "@/lib/property-nav";

/**
 * The sidebar's property list. Shown at once from sessionStorage, then
 * refreshed in the background when older than a minute, so navigation never
 * waits on it. Pages that add or archive a property call
 * `notifyPropertiesChanged()` to force a fresh fetch.
 */

const KEY = "property-nav-v1";
const MAX_AGE_MS = 60_000;
const CHANGED_EVENT = "properties-changed";

interface Cached {
  at: number;
  items: PropertyNavItem[];
}

function readCache(): Cached | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    return Array.isArray(parsed?.items) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(items: PropertyNavItem[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items } satisfies Cached));
  } catch {
    /* storage unavailable: the list just refetches next time */
  }
}

export function notifyPropertiesChanged() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function usePropertyNav(): PropertyNavItem[] | null {
  const [items, setItems] = React.useState<PropertyNavItem[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async (force: boolean) => {
      try {
        const res = await fetch("/api/properties/nav", {
          credentials: "same-origin",
          cache: force ? "reload" : "default",
        });
        if (!res.ok) return;
        const data = (await res.json()) as PropertyNavItem[];
        if (cancelled || !Array.isArray(data)) return;
        writeCache(data);
        setItems(data);
      } catch {
        /* offline or signed out: keep whatever is shown */
      }
    };

    const cached = readCache();
    if (cached) setItems(cached.items);
    if (!cached || Date.now() - cached.at > MAX_AGE_MS) void load(false);

    const onChanged = () => void load(true);
    window.addEventListener(CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGED_EVENT, onChanged);
    };
  }, []);

  return items;
}
