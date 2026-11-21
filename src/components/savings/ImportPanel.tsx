"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileJson, FileUp, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Kpi } from "@/components/ui/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImportResult } from "@/lib/savings-data";
import { cn } from "@/lib/utils";
import { api, errMsg } from "./api";
import { fmtMonth, money, typeLabel } from "./format";
import { He, Notice } from "./ui";

interface PreviewPerson {
  key: string;
  name: string | null;
  nameHe: string | null;
  asOf: string | null;
  products: { type: string; typeHe: string | null; provider: string; balance: number | null }[];
}

interface Preview {
  people: PreviewPerson[];
  currency: string;
  agentNotes: number;
}

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[,\s%₪$]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Light client-side check so obvious mistakes show before uploading. */
function previewDoc(text: string): { preview?: Preview; doc?: unknown; error?: string } {
  if (!text.trim()) return {};
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { error: `Not valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { error: "Expected a JSON object with “asOf” and “people”." };
  const d = doc as Record<string, unknown>;
  if (!Array.isArray(d.people) || d.people.length === 0) return { error: "No “people” array found." };
  if (!d.asOf || typeof d.asOf !== "object") return { error: "Missing “asOf” (statement date per person)." };
  const asOf = d.asOf as Record<string, unknown>;
  const people: PreviewPerson[] = [];
  for (const raw of d.people) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const key = typeof p.key === "string" ? p.key : "?";
    const products = Array.isArray(p.products) ? p.products : [];
    people.push({
      key,
      name: typeof p.nameEn === "string" ? p.nameEn : null,
      nameHe: typeof p.nameHe === "string" ? p.nameHe : null,
      asOf: typeof asOf[key] === "string" ? (asOf[key] as string) : null,
      products: products.map((x) => {
        const q = (x ?? {}) as Record<string, unknown>;
        return {
          type: typeof q.type === "string" ? q.type : "other",
          typeHe: typeof q.typeHe === "string" ? q.typeHe : null,
          provider: typeof q.provider === "string" ? q.provider : "—",
          balance: toNum(q.balance),
        };
      }),
    });
  }
  return {
    doc,
    preview: {
      people,
      currency: typeof d.currency === "string" ? d.currency : "ILS",
      agentNotes: Array.isArray(d.agentNotes) ? d.agentNotes.length : 0,
    },
  };
}

export default function ImportPanel({ initialText, initialResult }: { initialText?: string; initialResult?: ImportResult }) {
  const preview = initialText !== undefined || initialResult !== undefined;
  const [text, setText] = React.useState(initialText ?? "");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(initialResult ?? null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const parsed = React.useMemo(() => previewDoc(text), [text]);

  async function readFile(file: File) {
    setError(null);
    setResult(null);
    if (file.size > 5_000_000) return setError("That file is larger than 5 MB — is it the extractor JSON?");
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function runImport() {
    if (!parsed.doc) return;
    setError(null);
    if (preview) return setError("Preview mode — nothing was imported.");
    setBusy(true);
    try {
      const r = await api<ImportResult>("/api/savings/import", { method: "POST", body: parsed.doc });
      setResult(r);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const productCount = parsed.preview?.people.reduce((s, p) => s + p.products.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import statements"
        description="Load the JSON produced by the statement extractor (Israeli pension, manager’s insurance, study-fund and provident-fund reports). Accounts are matched by person, provider, type and policy last-4, so re-importing updates rather than duplicates."
      />

      {result ? (
        <ResultView
          result={result}
          onAgain={() => {
            setResult(null);
            setText("");
            setFileName(null);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle as="h2">Extractor JSON</CardTitle>
              <CardDescription>Drop the file, choose it, or paste its contents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void readFile(f);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
                  dragging ? "border-primary bg-primary-subtle" : "border-border-strong bg-subtle/50"
                )}
              >
                <Upload className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm text-foreground-secondary">
                  {fileName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <FileJson className="size-4 text-primary" aria-hidden />
                      <span className="font-medium text-foreground">{fileName}</span>
                    </span>
                  ) : (
                    "Drag a .json file here"
                  )}
                </p>
                <Button size="sm" variant="secondary" icon={<FileUp />} onClick={() => fileRef.current?.click()}>
                  Choose file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Choose extractor JSON file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void readFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="relative">
                <label htmlFor="import-json" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Or paste JSON
                </label>
                <textarea
                  id="import-json"
                  spellCheck={false}
                  className="num h-64 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-data text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-accent-amber/25"
                  placeholder={'{\n  "asOf": { "asaf": "2026-06" },\n  "currency": "ILS",\n  "people": [ … ]\n}'}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setFileName(null);
                    setResult(null);
                  }}
                />
                {text ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="absolute right-2 top-7"
                    icon={<X />}
                    onClick={() => {
                      setText("");
                      setFileName(null);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              {parsed.error ? <Notice tone="danger">{parsed.error}</Notice> : null}
              {error ? <Notice tone="danger" title="Import failed">{error}</Notice> : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle as="h2">What will be imported</CardTitle>
              <CardDescription>
                {parsed.preview
                  ? `${parsed.preview.people.length} ${parsed.preview.people.length === 1 ? "person" : "people"} · ${productCount} products · amounts in ${parsed.preview.currency}`
                  : "A summary appears here once the JSON is loaded."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsed.preview ? (
                <>
                  {parsed.preview.people.map((p) => (
                    <div key={p.key} className="rounded-lg border border-border">
                      <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-3 py-2">
                        <span className="font-medium text-foreground">{p.name ?? p.key}</span>
                        <He className="text-sm">{p.nameHe}</He>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {p.asOf ? `statement ${fmtMonth(p.asOf.length === 7 ? `${p.asOf}-01` : p.asOf)}` : (
                            <span className="text-warning">no date in asOf</span>
                          )}
                        </span>
                      </div>
                      <ul className="divide-y divide-border text-sm">
                        {p.products.map((x, i) => (
                          <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-foreground">{x.provider}</span>{" "}
                              <span className="text-xs text-muted-foreground">{typeLabel(x.type)}</span>
                            </span>
                            <span className="num text-foreground-secondary">
                              {x.balance != null ? money(x.balance, parsed.preview!.currency) : "—"}
                            </span>
                          </li>
                        ))}
                        {p.products.length === 0 ? <li className="px-3 py-2 text-xs text-muted-foreground">No products</li> : null}
                      </ul>
                    </div>
                  ))}
                  {parsed.preview.agentNotes > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {parsed.preview.agentNotes} extractor note{parsed.preview.agentNotes === 1 ? "" : "s"} included.
                    </p>
                  ) : null}
                </>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Accounts are created or updated (only newer statements move the headline balance).</li>
                  <li>• Each statement date adds a point to the balance history.</li>
                  <li>• Insurance inside policies becomes coverage on the Benefits page.</li>
                  <li>• People are added to the profile; values you entered are never overwritten.</li>
                </ul>
              )}
              <Button className="w-full" icon={<Upload />} disabled={!parsed.doc} loading={busy} onClick={runImport}>
                Import {productCount > 0 ? `${productCount} products` : ""}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResultView({ result, onAgain }: { result: ImportResult; onAgain: () => void }) {
  return (
    <div className="space-y-6">
      <Notice tone={result.warnings.length ? "warning" : "success"} title="Import complete">
        {result.warnings.length
          ? `Imported with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"} — review them below.`
          : "Everything was imported cleanly."}
      </Notice>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Accounts created" value={result.accountsCreated} />
        <Kpi label="Accounts updated" value={result.accountsUpdated} />
        <Kpi label="History points" value={result.snapshotsWritten} hint="balance snapshots written" />
        <Kpi label="Coverages" value={result.benefitsCreated + result.benefitsUpdated} hint={`${result.benefitsCreated} new · ${result.benefitsUpdated} updated`} />
      </div>
      {result.membersAdded.length > 0 ? (
        <Card variant="subtle" className="flex flex-wrap items-center gap-2 p-4 text-sm">
          <span className="text-foreground-secondary">Added to the household profile:</span>
          {result.membersAdded.map((m) => (
            <Badge key={m} variant="info">
              {m}
            </Badge>
          ))}
          <Link href="/savings/profile" className="ml-auto font-medium text-primary underline-offset-4 hover:underline">
            Complete their details
          </Link>
        </Card>
      ) : null}
      {result.warnings.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle as="h2" className="flex items-center gap-2">
              Warnings <Badge variant="warning">{result.warnings.length}</Badge>
            </CardTitle>
            <CardDescription>Fix these on the account if needed — the import still went through.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-foreground-secondary">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/savings">
            View accounts <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/savings/benefits">Review coverage</Link>
        </Button>
        <Button variant="ghost" onClick={onAgain}>
          Import another file
        </Button>
      </div>
    </div>
  );
}
