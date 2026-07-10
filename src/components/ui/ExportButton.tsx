"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2, FileDown, Check } from "lucide-react";

/** Escape a value for CSV (quote if it contains a comma, quote, or newline). */
export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header row + data rows. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\n");
}

export default function ExportButton({
  filename,
  title,
  buildCsv,
  label = "Export",
}: {
  filename: string;
  title: string;
  buildCsv: () => string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function download() {
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function share() {
    const csv = buildCsv();
    try {
      const file = new File([csv], filename, { type: "text/csv" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title });
      } else if (navigator.share) {
        await navigator.share({ title, text: csv.slice(0, 4000) });
      } else {
        await navigator.clipboard.writeText(csv);
      }
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* user cancelled */
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="pressable inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[color:var(--ring)]/40 transition-colors"
      >
        {shared ? <Check className="w-4 h-4 text-[#00D68F]" /> : <Download className="w-4 h-4" />}
        {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-50 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl py-1">
          <button
            onClick={download}
            className="pressable flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Download CSV
          </button>
          {canShare && (
            <button
              onClick={share}
              className="pressable flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
