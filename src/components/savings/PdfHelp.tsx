import { FileText, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Static help for /savings/import: PDFs are read by Claude Code (the
// import-statements skill), not by the web app. See docs/savings/pdf-import.md.

const DOCS_BASE = "https://github.com/asafhamo55-coder/trading-diary/blob/claude/trading-journal-platform-euynZ/docs/savings";

export default function PdfHelp() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden /> Have PDFs?
          </CardTitle>
          <CardDescription>
            Statements are read by Claude Code on your computer, not uploaded here. It turns them into the JSON this page imports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground-secondary">
            <li>
              Put the PDFs in the project&apos;s <code className="font-data text-xs">private-data/</code> folder (it is never committed).
            </li>
            <li>
              In Claude Code, in the project, say:{" "}
              <span className="inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 font-data text-xs text-foreground">
                <Terminal className="size-3" aria-hidden /> import these statements
              </span>
            </li>
            <li>It reads each PDF, writes a checked bundle file, shows you what it found and asks before loading.</li>
            <li>Load it by dropping the <code className="font-data text-xs">.bundle.json</code> above, or let Claude Code post it directly (needs the ingest token).</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Works with Israeli consolidated savings reports (Hebrew), US 401(k) statements, employer benefits summaries and RSU/ESPP statements; anything else is
            read on a best-effort basis.{" "}
            <a href={`${DOCS_BASE}/pdf-import.md`} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
              Full guide
            </a>
          </p>
        </CardContent>
      </Card>

      <Card variant="subtle" className="lg:col-span-2">
        <CardHeader>
          <CardTitle as="h2">How import works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-foreground-secondary">
            <li>• Accounts match on person + provider + type + last 4 digits of the policy number, so re-importing updates instead of duplicating.</li>
            <li>• Each statement date adds a history point; only a newer statement moves the headline balance.</li>
            <li>• Insurance inside Israeli products becomes coverage on the Benefits page; benefits match on person + category + source.</li>
            <li>• People are added to the profile; Israeli reports never overwrite what you entered.</li>
            <li>• National ID and SSN numbers are never stored; policy numbers may be kept in full.</li>
          </ul>
          <p className="mt-3 text-xs">
            <a href={`${DOCS_BASE}/pdf-import.md#7-matching-and-upsert-rules`} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
              Matching rules
            </a>
            {" · "}
            <a href={`${DOCS_BASE}/pdf-import.md#4-bundle-format-reference`} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
              JSON format
            </a>
            {" · "}
            <a href={`${DOCS_BASE}/README.md`} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
              Savings module overview
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
