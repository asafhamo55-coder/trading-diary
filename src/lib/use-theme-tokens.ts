"use client";

import { useEffect, useState } from "react";

/**
 * Resolved design-token colours for canvas renderers (ECharts) that cannot
 * read CSS variables. Re-reads when <html>'s theme class changes, so a
 * chart repaints on light/dark switch.
 */
export interface ThemeTokens {
  mode: "light" | "dark";
  background: string;
  surface: string;
  elevated: string;
  border: string;
  borderStrong: string;
  foreground: string;
  foregroundSecondary: string;
  muted: string;
  primary: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  violet: string;
}

const VARS: Record<Exclude<keyof ThemeTokens, "mode">, string> = {
  background: "--background",
  surface: "--surface",
  elevated: "--elevated",
  border: "--border",
  borderStrong: "--border-strong",
  foreground: "--foreground",
  foregroundSecondary: "--foreground-secondary",
  muted: "--muted-foreground",
  primary: "--primary",
  accent: "--accent",
  success: "--success",
  danger: "--danger",
  warning: "--warning",
  info: "--info",
  violet: "--violet",
};

/** Dark defaults (this app's default theme) for the server render. */
const FALLBACK: ThemeTokens = {
  mode: "dark",
  background: "#0A0F1A",
  surface: "#111827",
  elevated: "#182235",
  border: "#243045",
  borderStrong: "#334155",
  foreground: "#F1F5F9",
  foregroundSecondary: "#CBD5E1",
  muted: "#94A3B8",
  primary: "#60A5FA",
  accent: "#FDB022",
  success: "#4ACB8B",
  danger: "#F97B70",
  warning: "#FDB022",
  info: "#5CB5FD",
  violet: "#AE96FB",
};

function read(): ThemeTokens {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const out = { ...FALLBACK, mode: root.classList.contains("light") ? "light" : "dark" } as ThemeTokens;
  for (const [k, v] of Object.entries(VARS)) {
    const val = cs.getPropertyValue(v).trim();
    if (val) (out as unknown as Record<string, string>)[k] = val;
  }
  return out;
}

export function useThemeTokens(): ThemeTokens {
  const [tokens, setTokens] = useState<ThemeTokens>(FALLBACK);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens(read());
    const obs = new MutationObserver(() => setTokens(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return tokens;
}
