"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "theme-mode-v1";

function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (mode === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(prefersDark ? "dark" : "light");
  } else {
    root.classList.add(mode);
  }
}

export default function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const [mode, setMode] = useState<Mode>("dark");
  const [mounted, setMounted] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
      const initial: Mode =
        saved === "light" || saved === "dark" || saved === "system"
          ? saved
          : "dark";
      setMode(initial);
      applyMode(initial);
    } catch {
      applyMode("dark");
    }
    setMounted(true);
  }, []);

  // Re-evaluate "system" when the OS preference changes
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  function pick(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyMode(next);
  }

  if (!mounted) {
    // Avoid hydration mismatch — render a placeholder of the same size
    return (
      <div
        className={cn(
          "h-9 rounded-lg border border-[var(--border)] bg-[var(--muted)]",
          collapsed ? "w-9" : "w-full"
        )}
        aria-hidden
      />
    );
  }

  const options: { value: Mode; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="w-4 h-4" />, label: "Light" },
    { value: "dark", icon: <Moon className="w-4 h-4" />, label: "Dark" },
    { value: "system", icon: <Monitor className="w-4 h-4" />, label: "Auto" },
  ];

  if (collapsed) {
    const current = options.find((o) => o.value === mode) ?? options[1];
    const next: Mode =
      mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    return (
      <button
        onClick={() => pick(next)}
        className="flex items-center justify-center w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)]"
        title={`Theme: ${current.label} — click to switch`}
      >
        {current.icon}
      </button>
    );
  }

  const activeIndex = options.findIndex((o) => o.value === mode);

  return (
    <div className="relative flex rounded-xl border border-[var(--border)] bg-[var(--muted)] p-1">
      {/* Sliding indicator */}
      <span
        className="absolute top-1 bottom-1 rounded-lg bg-[var(--card)] shadow-sm ring-1 ring-[var(--border)] transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        aria-hidden
      />
      {options.map((o) => {
        const active = o.value === mode;
        return (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            className={cn(
              "pressable relative z-10 flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              active ? "text-accent-blue" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
            title={`Switch to ${o.label.toLowerCase()} mode`}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
