"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, Loader2, FileText, CheckCircle2 } from "lucide-react";
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
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Upload className="w-4 h-4" style={{ color: ACCENT }} />
            Import statement
          </h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#00D68F]">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Imported</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <ResultTile label="Added" value={result.added} />
              <ResultTile label="Duplicates skipped" value={result.duplicates} />
              <ResultTile label="Need review" value={result.needsReview} />
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
                className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2"
              >
                Import another
              </button>
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14]"
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
                className="w-full flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--muted-foreground)] hover:border-[color:var(--border)] transition-colors"
              >
                <FileText className="w-4 h-4" />
                {filename || "Choose a .csv statement export…"}
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

            {error && <p className="text-sm text-[#FF4D6A]">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-3 py-2">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0C0F14] disabled:opacity-60"
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

function ResultTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className="text-xl font-bold font-data text-[var(--foreground)]">{value}</p>
      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[#00D68F]";
