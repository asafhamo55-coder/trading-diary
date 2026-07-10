"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { accountTypeShort, type HomeAccountDTO } from "@/lib/home";

const ACCENT = "#00D68F";

interface ImportResult {
  rowCount: number;
  added: number;
  duplicates: number;
  needsReview: number;
}

export default function ImportDialog({
  accounts,
  onClose,
}: {
  accounts: HomeAccountDTO[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [homeAccountId, setHomeAccountId] = useState(accounts[0]?.id ?? "");
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit() {
    setError(null);
    if (!homeAccountId) return setError("Add an account first");
    if (!csv.trim()) return setError("Choose a CSV file or paste its contents");
    setImporting(true);
    try {
      const res = await fetch("/api/home/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeAccountId, csv, filename: filename || "statement.csv" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Import failed");
      setResult(data as ImportResult);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `${ACCENT}1A` }}>
              <Upload className="w-4 h-4" style={{ color: ACCENT }} />
            </span>
            Import statement
          </h3>
          <button onClick={onClose} className="pressable p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl bg-[#00D68F]/10 px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-[#00D68F]" />
              <span className="font-semibold text-[#00D68F]">Imported successfully</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <ResultTile label="Added" value={result.added} accent="#00D68F" />
              <ResultTile label="Duplicates skipped" value={result.duplicates} />
              <ResultTile label="Need review" value={result.needsReview} accent={result.needsReview > 0 ? "#FFB547" : undefined} />
            </div>
            {result.needsReview > 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {result.needsReview} transaction{result.needsReview !== 1 ? "s" : ""} couldn&apos;t be
                auto-categorized — resolve them in the Review queue.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setResult(null);
                  setCsv("");
                  setFilename("");
                }}
                className="pressable text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2 transition-colors"
              >
                Import another
              </button>
              <button
                onClick={onClose}
                className="pressable rounded-lg px-4 py-2 text-sm font-semibold text-[#0C0F14] shadow-sm transition-[filter] hover:brightness-105"
                style={{ background: ACCENT }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">Into account</span>
              <select
                value={homeAccountId}
                onChange={(e) => setHomeAccountId(e.target.value)}
                className={inputCls}
              >
                {accounts.length === 0 && <option value="">No accounts — add one first</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {accountTypeShort(a.type)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">CSV file</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "pressable w-full flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors",
                  filename
                    ? "border-[#00D68F]/50 bg-[#00D68F]/5 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[#00D68F]/40 hover:text-[var(--foreground)]"
                )}
              >
                <FileText className={cn("w-4 h-4 shrink-0", filename && "text-[#00D68F]")} />
                <span className="truncate">{filename || "Choose a .csv statement export…"}</span>
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--muted-foreground)]">or paste CSV text</summary>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={6}
                placeholder="Date,Description,Amount&#10;06/03/2026,TRADER JOE'S,-42.19"
                className={`${inputCls} mt-2 font-mono text-xs`}
              />
            </details>

            <p className="text-xs text-[var(--muted-foreground)]">
              Works with Bank of America (checking &amp; card) and American Express CSV exports.
              Card-payment transfers are auto-excluded so nothing is double-counted; re-importing the
              same month is safe (duplicates are skipped).
            </p>

            {error && (
              <p className="flex items-center gap-1.5 text-sm text-[#FF4D6A]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="pressable text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2 transition-colors">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={importing}
                className="pressable inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#0C0F14] shadow-sm transition-[filter] hover:brightness-105 disabled:opacity-60"
                style={{ background: ACCENT }}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <p
        className="text-xl font-bold font-data tracking-tight"
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {value}
      </p>
      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors focus:outline-none focus:border-[#00D68F] focus:ring-2 focus:ring-[#00D68F]/20";
