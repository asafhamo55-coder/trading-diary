"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

/** A transient "Saved" message, shown as a small toast at the bottom. */
export function useFlash() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = React.useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const node = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
      {msg ? (
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-sm font-medium text-foreground shadow-lg animate-fade-in">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          {msg}
        </div>
      ) : null}
    </div>
  );
  return { flash, node };
}
