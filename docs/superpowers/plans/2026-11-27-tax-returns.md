# Filed Tax Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load filed US federal + Georgia returns (2024, 2025) as validated records, backfill those years' property books from Schedule E, feed both to the advisor, and show them on a read-only page.

**Architecture:** Claude Code extracts each PDF into JSON under `private-data/tax/` (skill), validates it with the repo's zod schema, and POSTs it to a bearer-token route that upserts a `TaxReturn` row and rewrites that year's tax-return-sourced `PropertyTransaction`s. The advisor snapshot gains a compact `taxReturns` block plus a computed declared-vs-books reconciliation. A `/savings/tax` page renders the records.

**Tech Stack:** Next.js (repo version — read `node_modules/next/dist/docs/` before route/page code), Prisma + Postgres with self-healing DDL, zod, vitest, `pdftotext -layout`.

**Spec:** `docs/superpowers/specs/2026-11-27-tax-returns-design.md`

## Global Constraints

- No PII leaves the machine: no SSN/ITIN, EIN, PTIN, dates of birth, e-file PINs/signatures, bank account or routing numbers, foreign account numbers, dependents' names. People are member keys only (`asaf`, `einat`, `joint`, child keys).
- No household figures, names, addresses or identifiers in committed files (tests and examples use synthetic values).
- PDFs and extracted JSON only under gitignored `private-data/`; PDFs are never uploaded.
- A line not printed on the return is `null`; never invent numbers.
- `jurisdiction` is exactly `"US-federal" | "US-GA"`.
- Re-import of `(accountId, taxYear, jurisdiction)` replaces the row; a `partial` row never overwrites a full one.
- Backfilled transactions: dated `<year>-12-31`, `source = "taxReturn:<year>"`, description `"<year> Schedule E — from filed return"`; re-ingest deletes/rewrites only rows with that source.
- Tax-basis fill is fill-if-empty only.
- No hard-coded structural colors; use the design-system tokens and existing kit (`Card`, `Kpi`, `PageHeader`).
- After each verified task: commit; after the final task: push + `vercel --prod`.

## Review Focus

- Free-text fields (`notes`, labels, `address`) smuggling an SSN/EIN/account number → ingest must reject (test in Task 1).
- Re-ingesting 2025 after 2026 statement imports → only `taxReturn:2025` rows change; statement rows survive (test in Task 3).
- A Schedule E property with no app match (e.g. one sold) → no transactions created, listed in `unmatched` (test in Task 3).
- One Schedule E column for a two-unit building → split across both unit records, totals preserved to the cent (test in Task 3).
- Negative Schedule E values (net losses) and zero lines → no zero-amount rows; losses stay in `net`, every line amount is positive with type from category (test in Task 3).

---

### Task 1: Tax-return schema and PII guard

**Files:**
- Create: `src/lib/tax-return-schema.ts`
- Test: `tests/lib/tax-return-schema.test.ts`

**Interfaces:**
- Produces:
  - `taxReturnInputSchema` (zod) → `TaxReturnInput = { taxYear: number; jurisdiction: "US-federal" | "US-GA"; filingStatus: string | null; preparer: string | null; source: string | null; partial: boolean; amended: boolean; data: TaxReturnData }`
  - `TaxReturnData` with sections per spec: `summary`, `rentals: ScheduleERental[]`, `passiveLosses`, `business[]`, `capitalGains`, `foreign`, `hsa`, `childCare`, `childTaxCredit`, `amt`, `carryovers[]`, `state`, `notes: string[]` — every money field `number | null`, every section optional/nullable.
  - `ScheduleERental = { address: string; propertyId: string | null; unitIds: string[] | null; daysRented: number | null; lines: Partial<Record<ScheduleELineKey, number | null>>; net: number | null; depreciation: { basis: number | null; land: number | null; method: string | null; placedInService: string | null; prior: number | null; current: number | null } | null }`
  - `ScheduleELineKey` = the `PROPERTY_CATEGORIES` keys from `src/lib/property.ts` (`RENT`, `OTHER_INCOME`, `ADVERTISING` … `DEPRECIATION`, `OTHER`).
  - `findPii(value: unknown): string[]` — JSON paths of offending strings.
  - `parseTaxReturn(raw: unknown): TaxReturnInput` — throws `TaxReturnError` listing zod issues and PII paths.

- [ ] **Step 1: Write failing tests**
  - `accepts a minimal federal return` — `{taxYear: 2025, jurisdiction: "US-federal", data: {summary: {agi: 100000}}}` parses; missing sections become `null`/`[]`.
  - `rejects an unknown jurisdiction` — `"US-AL"` throws.
  - `rejects an SSN anywhere` — `notes: ["see 123-45-6789"]` throws with path `data.notes.0`.
  - `rejects EIN and long digit strings in text` — `"12-3456789"` and `"Acct 123456789012"` in `rentals[0].address` throw.
  - `allows numbers in numeric fields and short digits in addresses` — `address: "1104 Example Cir"`, `lines.RENT: 15400` parse.
  - `rejects a dateOfBirth-like key` — any key matching `/birth|dob|ssn|routing|accountNumber/i` throws.
- [ ] **Step 2: Run** `npx vitest run tests/lib/tax-return-schema.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the schema and guards. PII regexes: SSN/ITIN `\b\d{3}-\d{2}-\d{4}\b`, EIN `\b\d{2}-\d{7}\b`, bare `\d{9,}`; key denylist as in the test.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** `feat: tax return schema with PII guard`.

### Task 2: Storage (TaxReturn table, transaction source column, data layer)

**Files:**
- Modify: `prisma/schema.prisma` (add `TaxReturn`; add `source String?` to `PropertyTransaction`)
- Modify: `src/lib/savings-schema.ts` (DDL for `TaxReturn` + unique index `(accountId, taxYear, jurisdiction)`)
- Modify: `src/lib/property-schema.ts` (`ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "source" TEXT`)
- Create: `src/lib/tax-return-data.ts`
- Test: `tests/lib/tax-return-data.test.ts` (pure helper only)

**Interfaces:**
- Consumes: `TaxReturnInput` (Task 1).
- Produces:
  - `TaxReturnDTO = TaxReturnInput & { id: string; updatedAt: string }`
  - `shouldReplace(existing: { partial: boolean } | null, incoming: { partial: boolean }): boolean` — false only when existing is full and incoming is partial.
  - `upsertTaxReturn(input: TaxReturnInput): Promise<{ row: TaxReturnDTO; replaced: boolean; skipped: boolean }>`
  - `listTaxReturns(): Promise<TaxReturnDTO[]>` (newest year first; federal before GA)

- [ ] **Step 1: Failing test** `shouldReplace`: null→true; partial→full true; full→full true; full→partial false.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** schema/DDL/data layer using the savings module's `withHeal`/`accountId` pattern; run `npx prisma generate`.
- [ ] **Step 4: Run** tests + `npx tsc --noEmit -p .` — PASS, no errors.
- [ ] **Step 5: Commit** `feat: TaxReturn storage and transaction source column`.

### Task 3: Schedule E → property books backfill

**Files:**
- Create: `src/lib/tax-return-backfill.ts`
- Test: `tests/lib/tax-return-backfill.test.ts`

**Interfaces:**
- Consumes: `ScheduleERental`, `TaxReturnInput` (Task 1); property list from `getProperties()` (`src/lib/property-data.ts`).
- Produces:
  - `matchRentals(rentals: ScheduleERental[], properties: { id: string; address: string; unit: string | null }[]): { rental: ScheduleERental; propertyIds: string[] }[]` + `unmatched: string[]` — honors explicit `propertyId`/`unitIds`, else normalized street number + street name; multi-unit buildings return all unit ids.
  - `scheduleEToTransactions(rental: ScheduleERental, year: number, propertyIds: string[], unitRents?: Record<string, number>): NewTx[]` where `NewTx = { propertyId; date: Date; year; month: 12; type: "INCOME" | "EXPENSE"; category; amount; description; source }`.
  - `backfillPropertyBooks(ret: TaxReturnInput): Promise<{ created: number; deleted: number; unmatched: string[]; basisFilled: string[] }>` — in one `$transaction`: delete `source = "taxReturn:<year>"` rows for matched properties, insert new rows, fill empty `taxBasis` fields (`landValue`, `buildingValue` = basis − land, `placedInService`, `method`) on the profile.

- [ ] **Step 1: Failing tests**
  - `maps each non-zero line to one row` — `{RENT: 15400, REPAIRS: 660, MORTGAGE_INTEREST: 10802, ADVERTISING: 0}` → 3 rows, RENT type INCOME, others EXPENSE, date `2025-12-31`, source `taxReturn:2025`.
  - `splits a building evenly across units, preserving cents` — RENT 10001 over 2 units → 5000.50 + 5000.50; 3 units of 100 → amounts sum to exactly 100.00.
  - `splits by unit rent when given` — unitRents `{u1: 1400, u2: 1100}`, RENT 30000 → 16800 / 13200.
  - `negative or null lines create no rows` — `{OTHER: -50, LEGAL: null}` → 0 rows.
  - `matchRentals` — `"1104 EXAMPLE CIRCLE NW"` matches app `"1104 Example Cir NW"`; an address with no app property lands in `unmatched`; explicit `propertyId` wins.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Normalize: uppercase, strip punctuation, map `CIRCLE→CIR, COURT→CT, ROAD→RD, DRIVE→DR, STREET→ST`, compare number + first street word. Even split: floor to cents, add the remainder cents to the first unit.
- [ ] **Step 4: Run** tests — PASS.
- [ ] **Step 5: Commit** `feat: backfill property books from Schedule E`.

### Task 4: Ingest and read API

**Files:**
- Create: `src/app/api/savings/tax-returns/route.ts`

**Interfaces:**
- Consumes: `parseTaxReturn` (T1), `upsertTaxReturn`/`listTaxReturns` (T2), `backfillPropertyBooks` (T3), `checkSavingsToken` (`src/lib/ingest-auth.ts`), cookie check as in `src/app/api/savings/advisor/actions/route.ts`.
- Produces: `POST` (bearer) body = `TaxReturnInput` → `{ row, replaced, skipped, backfill }`; 422 on `TaxReturnError` with its message; backfill only for full `US-federal`. `GET` (cookie) → `{ returns: TaxReturnDTO[] }`.

- [ ] **Step 1:** Implement the route following the advisor ingest route's structure.
- [ ] **Step 2: Verify** `npx tsc --noEmit -p . && npx eslint src/app/api/savings/tax-returns` — clean.
- [ ] **Step 3: Commit** `feat: tax return ingest and read API`.

### Task 5: Advisor integration

**Files:**
- Create: `src/lib/tax-return-advisor.ts`
- Modify: `src/lib/advisor.ts` (`buildAdvisorSnapshot` input `taxReturns?: TaxReturnDTO[]`; snapshot field; `ADVISOR_SYSTEM` rules; the snapshot description line)
- Modify: `src/app/api/savings/advisor/context/route.ts`, `src/app/api/savings/advisor/route.ts` (load `listTaxReturns()`)
- Modify: `.claude/skills/run-advisor/SKILL.md` (taxReturns section)
- Test: `tests/lib/tax-return-advisor.test.ts`

**Interfaces:**
- Consumes: `TaxReturnDTO` (T2); `PropertyWithTx` (`src/lib/property-data.ts`).
- Produces:
  - `compactTaxReturns(returns: TaxReturnDTO[]): AdvisorTaxReturn[]` — per year: summary, per-rental declared lines + depreciation + `propertyId`, passive losses, carryovers, foreign (no institutions' identifiers beyond name/type/owner/max), business, state; drops `notes` longer than 300 chars.
  - `reconcileRentals(returns: TaxReturnDTO[], properties: PropertyWithTx[], today: string): RentalReconciliation[]` = `{ propertyId; declaredYear; declared: { rent; interest; depreciation; totalExpenses }; booksRunRate: { months; rent; interest; depreciation; totalExpenses }; diffs: { field; declared; runRate; pct }[] }` comparing the latest full federal year against the current year's non-`taxReturn:` books annualized (`× 12 / months elapsed`); `diffs` only where |pct| ≥ 25% and |abs| ≥ $500.

- [ ] **Step 1: Failing tests**
  - `compactTaxReturns keeps the latest two years, newest first`.
  - `reconcile annualizes current-year books` — 6 months of rent 1000/mo vs declared 12000 → no diff; declared interest 20000 vs run-rate 9000 → diff on `interest`.
  - `reconcile ignores taxReturn-sourced rows`.
  - `reconcile skips properties without a declared rental`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**, then add to `ADVISOR_SYSTEM`: the filed return is ground truth for what was declared; never recommend claiming something it already claims (depreciation, FTC, HSA, home office); use declared wages/AGI/bracket, withholding vs total tax, suspended passive losses and carryovers; turn `reconciliation.diffs` into data-fix or "ask the CPA" items; never output account numbers. Mirror it in the run-advisor skill's step 1 field list and step 3 bullets.
- [ ] **Step 4: Run** tests + `npx vitest run` (whole suite) + tsc — PASS.
- [ ] **Step 5: Commit** `feat: advisor reads filed tax returns`.

### Task 6: Tax returns page

**Files:**
- Create: `src/app/savings/tax/page.tsx`, `src/components/savings/TaxReturnsClient.tsx`
- Modify: `src/lib/nav.ts` (Savings pages: `{ label: "Tax returns", href: "/savings/tax", icon: Receipt }` before Import)

**Interfaces:**
- Consumes: `listTaxReturns()` (server component), `reconcileRentals` (T5), `useDisplayCurrency`.
- Produces: page with year picker (years present), Kpi tiles (AGI, total tax, effective rate = total tax ÷ AGI, refund/owed), sections income / deductions / credits & taxes / carryovers / foreign reporting (institution, type, owner, max value) / rentals table (address, matched property link or "not in app", rent, expenses, depreciation, net, run-rate diff), and GA summary. Empty state: "No tax returns loaded yet. In Claude Code, ask to import your tax return PDFs."

- [ ] **Step 1:** Implement following `src/app/savings/benefits/page.tsx` structure.
- [ ] **Step 2: Verify** tsc + eslint clean; `npm run build` succeeds.
- [ ] **Step 3: Commit** `feat: tax returns page`.

### Task 7: Import skill and validator script

**Files:**
- Create: `.claude/skills/import-tax-return/SKILL.md`, `.claude/skills/import-tax-return/extraction-guide.md`, `.claude/skills/import-tax-return/example.json` (synthetic, schema-valid)
- Create: `scripts/validate-tax-return.ts` (reads a JSON path, runs `parseTaxReturn`, prints OK or the issues; never echoes field values)

**Interfaces:**
- Consumes: `parseTaxReturn` (T1); POST route (T4).

- [ ] **Step 1:** Write the skill: inputs (PDF paths, token from env or `private-data/.savings-token`), steps (`pdftotext -layout` into `private-data/tax/`, locate forms by page headers, extract per guide, member keys from `/api/savings/profile`, write `private-data/tax/<year>-<jurisdiction>.json`, validate, POST, report counts). PII rules verbatim from Global Constraints.
- [ ] **Step 2:** Write the guide: form → section map for 1040 + Schedules 1/2/3/A/B/C/D/E, 4562 and per-property depreciation reports (both layouts: report pages vs Forms 4562), 8582, 1116 (+ Sch B), 8938/FBAR (no numbers), 8889, 2441, 8812, 6251, 4797, 8829, carryovers page, two-year comparison (→ prior-year `partial`), Georgia 500 + Schedule 1; number parsing (commas, trailing `.`, parentheses = negative).
- [ ] **Step 3: Verify** `npx tsx scripts/validate-tax-return.ts .claude/skills/import-tax-return/example.json` → `OK`.
- [ ] **Step 4: Commit** `feat: import-tax-return skill`.

### Task 8: Load 2024 and 2025, deploy, verify

- [ ] **Step 1:** Push + `vercel --prod`; confirm READY.
- [ ] **Step 2:** Run the skill on both PDFs → four files (`2024-US-federal`, `2024-US-GA`, `2025-US-federal`, `2025-US-GA`); validate each → OK.
- [ ] **Step 3:** POST each; expect 200 with backfill counts and `unmatched` listing any property not in the app.
- [ ] **Step 4:** `curl` the advisor context → `snapshot.taxReturns` has 2 years and `reconciliation` entries; grep the response for SSN/EIN patterns → none.
- [ ] **Step 5:** Report to the user what loaded, what didn't match, and the reconciliation findings.
