# Filed tax returns → advisor context — design

Date: 2026-11-27 · Status: draft for approval

This document is committed: it contains no household figures, names,
addresses or identifiers. Real values live only in the gitignored
`private-data/` and the database.

## Intent

Load the household's filed tax returns (last two years, then each new year) so
the advisor knows what was **actually declared**: income, per-property rental
income and expenses, depreciation, deductions, credits, carryovers and foreign
reporting. Today it infers these from the app's books, and a first look at a
filed return showed several of its conclusions are wrong (e.g. depreciation it
says is unclaimed, foreign reporting it says is unconfirmed, a business and a
property the app doesn't know about, wages far from its assumption).

## Goals

- One structured, validated **tax-return record per year and jurisdiction** in
  the app's DB.
- The advisor gets the returns in every snapshot (local and cloud runs), treats
  the filed return as ground truth over the app's books, and flags
  disagreements as findings (data fixes or "ask the CPA" items).
- A read-only **Tax returns** page: per-year summary plus a per-property
  "declared vs. app books" comparison.
- Repeatable: next year's return loads the same way.

## Non-goals

- Storing PDFs anywhere other than the user's machine.
- In-app upload or extraction (the app never calls a paid LLM).
- Preparing or amending returns; computing tax.
- Israeli returns for now (the `jurisdiction` field leaves room).

## Anti-goals

- **Any PII leaving the user's machine** — in the DB, repo, advisor snapshot
  or any request: no SSN/ITIN, EIN, preparer PTIN, dates of birth, e-file
  PINs or signatures, bank account or routing numbers (including the direct
  deposit page), foreign account numbers, or names of dependents beyond the
  household member keys the app already holds. People are referred to only by
  member key (`asaf`, `einat`, `joint`, child keys). The extractor never
  copies raw page text into the record; it writes only the figures and
  labels listed below. The ingest validator rejects SSN/ITIN/EIN patterns,
  long digit strings and date-of-birth-like fields anywhere in text.
- Advice that contradicts the filed return without saying so.
- Invented numbers: a line not printed on the return is `null`.

## Constraints

- Extraction runs in Claude Code on the user's subscription, like
  `import-statements`. PDFs and intermediate JSON stay under gitignored
  `private-data/`.
- Self-healing DDL like the other modules (`savings-schema.ts`).
- Ingest is bearer-token authenticated (`SAVINGS_INGEST_TOKEN`); the page is
  cookie-authenticated.
- The advisor context is already large; tax data goes in as a compact summary,
  not worksheet dumps.

## Approaches considered

1. **Import skill + DB record + advisor snapshot + read-only page** — *chosen
   by the user*. Every advisor run sees it; only extracted figures are stored.
2. In-app PDF upload to blob storage, extraction still in Claude Code —
   phone-friendly, but full returns would sit in cloud storage.
3. Local markdown notes in `private-data/advisor/` — fastest, but cloud runs
   and the app never see it.

## Design

### Data model — `TaxReturn`

One row per `(accountId, taxYear, jurisdiction)`, unique; re-import replaces
it. Columns: `id, accountId, taxYear, jurisdiction ("US-federal" | "US-GA"),
filingStatus, preparer (firm name), source (file name), partial (bool), data
JSONB, createdAt, updatedAt`.

`data`, validated by zod in `src/lib/tax-return-schema.ts`:

- `summary` — wages, interest, dividends (ordinary/qualified), capital
  gain/loss, Schedule C, Form 4797, Schedule E total, other income, total
  income, adjustments, AGI, standard or itemized (taxes, interest,
  contributions, total), QBI, taxable income, tax, credits (foreign tax,
  child care, other), SE tax, additional Medicare, NIIT, other taxes, total
  tax, withholding, estimated payments, total payments, refund/owed, bracket.
- `rentals[]` — per Schedule E property: address as printed, matched
  `propertyId` (or `null` + note), days rented, rents, every expense line,
  net, and from the depreciation report: basis, land, method,
  placed-in-service date, prior and current depreciation.
- `passiveLosses` — Form 8582 allowed/suspended totals and per-activity
  carryforwards.
- `business[]` — Schedule C owner, activity, receipts, expenses, net, and the
  8829 home-office deduction.
- `capitalGains` — short/long net and carryover; 4797 sales summary.
- `foreign` — Form 1116 credit by basket and carryovers; 8938/FBAR filed,
  account count, aggregate max value, and institution + type + owner + max
  value per account — **no account numbers**.
- `hsa`, `childCare`, `childTaxCredit`, `amt` — key lines only.
- `carryovers[]` — the "carryovers to next year" page.
- `state` (for `US-GA` rows) — AGI, adjustments, taxable income, tax,
  credits, withholding, refund/owed, estimated vouchers.
- `notes[]` — anything unplaced, plus assumptions.

The validator rejects SSN/ITIN patterns and long bare digit strings in text.

### Import path

- Skill `.claude/skills/import-tax-return/` (SKILL.md, a form/line extraction
  guide, a synthetic example): `pdftotext -layout` → locate forms by page
  header → extract → write `private-data/tax/<year>-<jurisdiction>.json` →
  validate with the repo schema (`scripts/validate-tax-return.ts`) → POST.
- `POST /api/savings/tax-returns` (bearer) validates and upserts;
  `GET /api/savings/tax-returns` (cookie) feeds the page.
- A return's two-year comparison fills the prior year's `summary` as a
  `partial` row when that year's full return isn't loaded.

### Advisor

- `buildAdvisorSnapshot` gains `taxReturns`: per year the summary, declared
  rental figures, passive-loss and other carryovers, foreign-tax and
  reporting status, Schedule C, state summary — plus a computed
  `reconciliation[]` per rental: declared vs. app books for that year (rent,
  interest, depreciation, total expenses) with differences.
- `ADVISOR_SYSTEM` and the run-advisor skill: the filed return is ground
  truth for what was declared; don't recommend claiming what was claimed; use
  declared income for brackets, withholding and suspended losses; turn
  reconciliation gaps into data-fix or "ask the CPA" items; never reproduce
  account numbers.

### UI

- `/savings/tax` ("Tax returns" tab in the Savings nav): year picker, summary
  tiles (AGI, total tax, effective rate, refund/owed), sections for income,
  deductions, credits, carryovers, foreign reporting, and a rentals table
  with a "declared vs. books" difference column. Empty state says how to load
  a return. Existing design kit and tokens only.

### Backfilling property books from Schedule E

The Properties module only has books from January 2026, so prior years are
filled from the filed returns (the user's choice):

- On ingest of a full `US-federal` return, each Schedule E property matched to
  an app property gets one `PropertyTransaction` per non-zero Schedule E line
  (rents, each expense category, mortgage interest, taxes, insurance,
  depreciation), mapped to the Properties Schedule E catalog keys, dated
  December 31 of the tax year, described as "<year> Schedule E — from filed
  return".
- These rows carry a source tag (e.g. `taxReturn:<year>`). Re-ingesting a year
  replaces **only** that year's tax-return rows; statement-imported and
  hand-entered transactions are never touched. (The existing
  `/api/admin/import-property` replaces all of a property's transactions, so
  it is **not** reused.)
- Multi-unit buildings reported as one Schedule E property are split across the
  unit records evenly (or by the rent ratio if the return shows per-unit
  rent), with the split noted in the description.
- Schedule E properties with no app property (e.g. one sold earlier) are not
  created; they're listed in the record's `notes` and on the page.
- From the depreciation report / Form 4562, the property's tax-basis section is
  filled where empty (cost basis, land, placed-in-service date, method), never
  overwriting values the user entered.
- No SQL is run by hand; the load happens through the ingest endpoint.

With books for the same years, `reconciliation[]` compares declared vs. books
for each year; for rows that came from the return itself it's trivially equal,
so the useful comparison is the latest declared year vs. the current year's
annualized books (run-rate), labeled as such.

## Decided by the user

- Approach 1.
- Load the last two years (2024 and 2025); both full returns are available as PDFs.
- Backfill 2024 and 2025 rents and costs into the property books from the
  returns.
- No SSN or other PII is transferred anywhere.

## Left to the builder

- Exact zod shapes and field names within the outline.
- Property matching (normalized street number + name; multi-unit buildings
  map to the building).
- Page layout details.
- Reconciliation computed at snapshot time (preferred) vs stored.

## Calls made without asking (check these)

- No PDFs stored; only extracted figures.
- Foreign accounts: institution, type, owner and max value stored; account
  numbers never.
- State return stored as its own row rather than nested. Both years' returns
  contain only federal + Georgia (checked), so `jurisdiction` stays the closed
  set `US-federal | US-GA`.
- Re-importing a year overwrites it. Neither return is amended (checked); an
  `amended` flag is stored for the future, and a `partial` row (from a
  two-year comparison) never overwrites a full return.
- The two layouts differ (2025 has per-property depreciation reports; 2024
  carries depreciation on Forms 4562), so the extraction guide covers both.
