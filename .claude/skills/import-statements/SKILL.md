---
name: import-statements
description: Turn financial statement PDFs (Israeli pension / manager's insurance / hishtalmut / gemel consolidated reports in Hebrew, US 401(k) statements, employer benefits enrollment summaries, RSU/ESPP stock-plan statements, or any other savings/insurance statement) into a validated household-bundle JSON and load it into the Hamo Home Equity savings module. Use when the user asks to "import these statements", "load these PDFs", "read my pension report", "update my savings from this statement", or drops statement PDFs in the project.
---

# Import statements (PDF → household bundle → /api/savings/import)

You are the extractor. There is no in-app LLM: you read the PDFs here, on the
user's Claude subscription, write a JSON bundle, validate it with the repo's
own schema, and load it. Full format reference, upsert rules and
troubleshooting: `docs/savings/pdf-import.md`. Read it the first time you run
this skill in a session.

Supporting files in this folder:
- `extraction-guide.md` — per-document field mapping, Hebrew glossary, domain primer, pitfalls. **Read it before extracting.**
- `examples.json` — one synthetic, schema-valid bundle per document type. Copy the shape, never the numbers.

## 0. Ground rules

- **Privacy.** Never write a national ID (ת.ז / ת"ז / מספר זהות) or an SSN/ITIN anywhere: not in names, notes, `details`, or a field of its own. Full policy and account numbers ARE allowed: put them in `policyNumber` in full. Some Israeli pension account numbers are "<9-digit ID>-<suffix>" (e.g. `0xxxxxxxx-2`): keep that as the `policyNumber`, but never write the bare 9-digit ID by itself. The validator enforces this.
- **Never commit** PDFs or bundles. Write output only under `private-data/` (gitignored). Root-level statement PDFs matching the patterns in `.gitignore` are ignored, but if the user's file names differ, suggest moving them into `private-data/`.
- **Never invent numbers.** If a value isn't printed, use `null` and say so in `notes` / `details` / `agentNotes`. Derived values (e.g. monthly from per-paycheck) are fine when the basis is written next to them.
- **Ask, don't guess, about ownership** when the document doesn't name the person and the user didn't say.

## 1. Find the inputs

1. List candidate PDFs: `ls *.pdf private-data/*.pdf 2>/dev/null` (or the paths the user gave).
2. For each, decide the document type (see `extraction-guide.md` §1) and the owner key.

Owner keys (household members; `joint` for family-tier or shared). **Get the real
keys from the app's household profile before writing anything:**

```bash
curl -sS "$SAVINGS_BASE_URL/api/savings/profile" -H "Authorization: Bearer $SAVINGS_INGEST_TOKEN"   # members[].key
```

(or have the user open `/savings/profile`). If that isn't available, **ask the
user** for each person's key. Never hardcode or guess real keys, and never copy
the placeholder keys below into a real bundle.

Placeholder keys used in this skill's docs and `examples.json`:

| key | who |
|---|---|
| `alex` | adult (e.g. the US employee) |
| `dana` | adult (spouse) |
| `joint` | family-tier plans, joint accounts (always valid) |
| `noa`, `eli`, `maya` | children |

If a new person appears, add them to `profile.members` with a new lowercase key and tell the user.

## 2. Read each PDF

Text first, images when the layout is ambiguous:

```bash
pdfinfo "file.pdf"                                   # page count
pdftotext -layout "file.pdf" - | less                # or: > /tmp/x.txt then Read it
pdftotext -layout -f 3 -l 3 "file.pdf" -             # one page
```

Hebrew reports are RTL: `pdftotext -layout` often prints table columns in
reverse order and can reverse digit groups or split numbers across columns.
Whenever a table's column mapping is not obvious, or numbers don't reconcile,
render the page and look at it:

```bash
mkdir -p "$TMPDIR/pages" && pdftoppm -r 110 -png -f 3 -l 3 "file.pdf" "$TMPDIR/pages/p"
```

then Read the PNG (`$TMPDIR/pages/p-03.png` or `p-3.png`). Prefer the image when text and image disagree.
Large documents: work page by page; you don't need every chart page.

## 3. Write the bundle

One bundle per PDF, at `private-data/<owner>-<doctype>-<yyyy-mm>.bundle.json`
(e.g. `private-data/dana-il-report-2026-09.bundle.json`). Shape:

```json
{
  "israel":   { "asOf": {"<owner>": "YYYY-MM[-DD]"}, "currency": "ILS", "people": [ ... ], "agentNotes": [ ... ] },
  "accounts": [ /* US / other savings accounts: createSavingsAccountSchema */ ],
  "benefits": [ /* insurance & employer benefits: createBenefitSchema */ ],
  "profile":  { "members": [ ... ] }
}
```

Every part is optional. Use:
- `israel` for Israeli consolidated reports (products with their coverages; standalone term life goes in as a product with balance 0 and becomes a benefit).
- `accounts` for 401(k), IRA, brokerage, RSU/ESPP, cash, or anything else with a balance.
- `benefits` for employer benefits and insurance that isn't inside an Israeli product.
- `profile.members` only for people (names, birth dates, roles) you actually saw or the user told you.

Reconcile before saving: products should add up to the report's headline total
(state the check in `summary.reconciliation` or `agentNotes`). Explain every
gap, artifact or assumption in `notes` / `agentNotes`.

## 4. Validate (must pass before loading)

```bash
npx tsx scripts/savings/validate-bundle.ts private-data/<file>.bundle.json
```

- `PRIVACY` findings: fix the source of the leak, or re-run with `--fix` to scrub in place.
- `SCHEMA: FAIL`: fix the listed paths (enums, numbers as numbers, dates ≤ 20 chars, owner keys `[a-z0-9_-]`).
- `WARNINGS`: read every one. Benefits upsert on owner+category+source, so two different covers from the same carrier and category need distinct `source` strings, e.g. `"employer:Acme / Sample Life Co (basic AD&D)"` vs `"… (voluntary AD&D)"`.

Several PDFs → validate them together and write one merged file to load:

```bash
npx tsx scripts/savings/validate-bundle.ts private-data/a.bundle.json private-data/b.bundle.json --merge private-data/merged-<yyyy-mm-dd>.bundle.json
```

## 5. Show the user, then load

Summarize what you extracted (per owner: accounts, balances, coverages, and
warnings/low-confidence items) and ask before loading. Then either:

**(a) Upload in the browser:** the user opens `/savings/import` and drops the
`.bundle.json` (or pastes it). Good when no token is configured.

**(b) Post directly** (needs `SAVINGS_INGEST_TOKEN` in the shell; see the doc for setup):

```bash
npx tsx scripts/savings/post-bundle.ts private-data/<file>.bundle.json            # production
npx tsx scripts/savings/post-bundle.ts private-data/<file>.bundle.json http://localhost:3000
```

If it says Deployment Protection intercepted the request, `VERCEL_PROTECTION_BYPASS`
must be set too. Report the import result (created/updated counts, warnings)
back to the user and point them at `/savings` and `/savings/benefits`.
