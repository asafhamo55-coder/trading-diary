# Importing statements (PDF → JSON → savings module)

How statement PDFs get into Hamo Home Equity's savings / net-worth module.
Module overview: [README.md](README.md).

**Short version:** put the PDFs in `private-data/`, open Claude Code in the
project and say **"import these statements"**. Claude Code reads the PDFs on
your Claude subscription (no paid API, no third-party LLM, nothing uploaded to
the web app), writes a JSON *household bundle*, checks it, shows you the result
and loads it after you agree.

Contents
1. [Supported documents](#1-supported-documents)
2. [How it works](#2-how-it-works)
3. [Step by step](#3-step-by-step)
4. [Bundle format reference](#4-bundle-format-reference)
5. [Examples per document type](#5-examples-per-document-type)
6. [Hebrew glossary](#6-hebrew-glossary)
7. [Matching and upsert rules](#7-matching-and-upsert-rules)
8. [Token setup (direct loading)](#8-token-setup-direct-loading)
9. [Privacy](#9-privacy)
10. [Limits](#10-limits)
11. [Troubleshooting](#11-troubleshooting)
12. [Loading a JSON manually](#12-loading-a-json-manually)
13. [Files](#13-files)

---

## 1. Supported documents

| Document | Example file | Lands in |
|---|---|---|
| Israeli consolidated long-term savings report (Hebrew, RTL): "דו"ח תקופתי / ריכוז תוכניות", "דו"ח תוכניות". Pension, manager's insurance, hishtalmut, gemel, term life, and the coverages inside them. | `Alex Insurance Israel November.pdf` | `israel` → savings accounts + coverage benefits + profile members |
| US 401(k) quarterly statement | `401K.pdf` | `accounts[]` (type `401k`) + optional `401k_match` benefit |
| US employer benefits enrollment / confirmation summary | `Acme Corp Benefits.pdf` | `benefits[]` (health, dental, vision, life, AD&D, STD, LTD, HSA, …) |
| US RSU / ESPP stock-plan statement | `RSUs Quarterly Statement 06_30_2026.pdf` | `accounts[]` (type `rsu`) |
| Anything else (brokerage, IRA, bank savings, child savings, standalone insurance) | — | best effort into `accounts[]` / `benefits[]`, with notes on what's uncertain |

The sample PDFs contain personal data. They are gitignored and must never be
copied into tests, docs or commits.

## 2. How it works

```
 PDFs in private-data/
        │
        ▼
 ┌──────────────────────────────┐   pdftotext -layout  (text)
 │ Claude Code                  │   pdftoppm + Read    (page images when
 │ skill: import-statements     │                       RTL tables are ambiguous)
 └──────────────┬───────────────┘
                │ writes, one per PDF
                ▼
 private-data/<owner>-<doctype>-<yyyy-mm>.bundle.json      (gitignored)
                │
                ▼
 npx tsx scripts/savings/validate-bundle.ts  … [--merge merged.json]
   • privacy scrub (national ID / SSN)        • householdBundleSchema (same as the API)
   • summary + per-owner totals               • soft warnings (unknown owner, collisions…)
                │
                ▼
 Claude Code shows you the summary ── you approve
                │
        ┌───────┴─────────────────────────────┐
        ▼                                     ▼
 (a) drop the JSON at /savings/import   (b) scripts/savings/post-bundle.ts
     (browser, app-password cookie)          (Bearer SAVINGS_INGEST_TOKEN)
        └───────────────┬─────────────────────┘
                        ▼
            POST /api/savings/import
            importHouseholdBundle / importSavingsDoc  (src/lib/savings-data.ts)
                        ▼
      SavingsAccount + SavingsSnapshot + Benefit + HouseholdProfile
```

The skill lives in `.claude/skills/import-statements/`:
`SKILL.md` (procedure), `extraction-guide.md` (per-document mapping, pitfalls,
glossary, domain primer) and `examples.json` (synthetic examples, also used by
the unit tests).

## 3. Step by step

1. **Put the PDFs in `private-data/`.** (Root-level statement PDFs with the
   current file names are gitignored too, but `private-data/` is the safe place.)
2. **Open Claude Code** in the project directory and say
   *"import these statements"* (optionally: whose they are, e.g. "these are Dana's").
3. Claude Code **identifies each document** and the owner key. The real
   member keys come from the household profile (`GET /api/savings/profile`,
   `members[].key`) or from asking you; this doc uses placeholders (`alex`,
   `dana`, `joint`, `noa`, `eli`, `maya`). It asks when the document doesn't say.
4. It **reads each PDF** with `pdftotext -layout`, and renders pages with
   `pdftoppm` to look at them when Hebrew tables are ambiguous.
5. It **writes one bundle per PDF** to `private-data/…bundle.json`, reconciling
   product balances against the report's headline total and noting any gaps.
6. It **validates**: `npx tsx scripts/savings/validate-bundle.ts <files…>`.
   Several files are merged with `--merge private-data/merged-<date>.bundle.json`.
7. It **shows you** accounts, balances, coverages, warnings and low-confidence
   items, and asks before loading.
8. It **loads** the bundle: either you drop the JSON on `/savings/import`, or it
   runs `npx tsx scripts/savings/post-bundle.ts <file>` (needs the token, §8).
9. Check `/savings` (accounts, history) and `/savings/benefits` (coverage).
   New people appear on `/savings/profile` for you to complete.

## 4. Bundle format reference

The bundle is validated by `householdBundleSchema` in
`src/lib/savings-validators.ts`. Every top-level part is optional, but at least
one must be present. Unknown extra keys are allowed and ignored (except inside
`details`, where they're stored).

```jsonc
{
  "israel":   { ... },   // Israeli consolidated report(s)  (savingsImportSchema)
  "accounts": [ ... ],   // other savings accounts           (createSavingsAccountSchema), max 200
  "benefits": [ ... ],   // insurance and employer benefits  (createBenefitSchema), max 500
  "profile":  { ... }    // household members etc.           (updateProfileSchema)
}
```

A bare Israeli extract (`{ asOf, people, … }` at the top level) is also accepted
by the import API and by the scripts.

Numbers: plain JSON numbers. Inside `israel`, numeric strings like `"1,234.5"`
or `"0.22%"` are tolerated and cleaned. Dates: `YYYY-MM-DD`, `YYYY-MM` (read as
month end) or `DD/MM/YYYY`; at most 20 characters.

### 4.1 `israel`

| field | type | meaning |
|---|---|---|
| `asOf` | object, required | Statement data date per person key, e.g. `{"dana": "2026-09-30", "alex": "2026-10"}`. Becomes each account's `balanceAsOf` and the snapshot date. Use the data date (נכונות), not the issue date. |
| `currency` | string | `"ILS"` (default). |
| `people[]` | 1–20, required | One per person in the report(s). |
| `people[].key` | owner key, required | `[a-z0-9_-]`, e.g. `alex`. Use the real keys from the household profile. |
| `people[].nameHe` / `nameEn` | string | Added to the profile if empty there. |
| `people[].birthDate` | date | Added to the profile if empty. |
| `people[].retirementAge` | number | → profile `targetRetirementAge` if empty. |
| `people[].summary` | object | Free-form report summary (headline total, by withdrawal type, exposures, reconciliation). Reference only. |
| `people[].products[]` | max 100 | One per product row. |
| `agentNotes[]` | array | Report-level observations. Shown as a count on the import page. |

Product fields (`people[].products[]`):

| field | type | meaning / column |
|---|---|---|
| `type` | string, required | `pension`, `managers_insurance`, `hishtalmut`, `gemel`, `gemel_investment`, `savings_policy`, `savings_child`, `other`. Aliases `managers`, `bituach_menahalim`, `study_fund`, `keren_hishtalmut` are accepted. Unknown types import as `other` with a warning. |
| `typeHe` | string | Hebrew product name. |
| `provider` | string, required | Managing company. Part of the match key: keep the spelling stable between imports. |
| `planName` | string | Plan / fund name. |
| `policyNumber` | string or number | Full policy / account number (allowed, see §9). Matching uses its last 4 digits. |
| `status` | string | `active` / `inactive` / `frozen` … |
| `balance` | number | Product total (סך צבירה). Missing → 0 with a warning. |
| `track` | string | Main investment track. |
| `ytdReturnPct` | number | YTD return %, kept in details. |
| `feeDepositPct` | number | Management fee on deposits, % (0–10). |
| `feeAccumulationPct` | number | Management fee on balance, % per year (0–5). |
| `monthlyDeposit` | `{employee, employer, severance, total}` | Recurring monthly contributions. Any part may be null. |
| `insuredSalary` | number | Insured / determining salary. |
| `liquidityDate` | date | When the money becomes withdrawable (hishtalmut/gemel). |
| `projectedMonthlyPension` | number | Projected monthly pension from the report. |
| `conversionFactor` / `guaranteedFactor` | number / any | Annuity conversion factor (manager's insurance). |
| `openDate` | date | Join date. |
| `coverages[]` | `{type, typeHe, amount, monthlyCost, …}`, max 50 | Insurance inside the product → Benefit rows linked to the account. `type` is free text; it's mapped to a benefit category (death/survivors/term → `life`, disability/work capacity/נכות → `work_capacity`, accident → `add`, critical illness, long-term care, health). |
| `sourcePage`, `notes`, `tracks`, anything else | any | Stored in the account's `details`. |

A product that is pure term life (type/name mentions term life, ריסק, risk or
ביטוח חיים, and the balance is 0 or missing) does **not** create an account; each
of its coverages becomes a standalone `life` benefit.

### 4.2 `accounts[]`

| field | type | meaning |
|---|---|---|
| `owner` | owner key, required | |
| `country` | `IL` \| `US`, required | |
| `type` | required | `pension`, `managers_insurance`, `hishtalmut`, `gemel`, `gemel_investment`, `savings_policy`, `savings_child`, `401k`, `ira`, `brokerage`, `rsu`, `cash`, `other`. |
| `provider` | string, required | Recordkeeper / broker / bank. Part of the match key. |
| `planName` | string | |
| `policyNumber` | string | Full account number (allowed). Matching uses the last 4 digits. |
| `status` | string | |
| `currency` | `ILS` \| `USD`, required | |
| `balance` | number, required | For `rsu`: vested and held shares (+ cash) only. |
| `balanceAsOf` | date | Statement date. Missing → today. |
| `track` | string | Fund mix / track. |
| `feeDepositPct`, `feeAccumulationPct` | number | % (leave null if the total cost isn't printed). |
| `monthlyDepositEmployee`, `monthlyDepositEmployer`, `monthlyDepositSeverance`, `monthlyDepositTotal` | number ≥ 0 | Monthly contributions (e.g. YTD ÷ months). |
| `insuredSalary` | number | |
| `liquidityDate` | date | |
| `projectedMonthlyPension` | number | e.g. the 401(k) lifetime-income illustration. |
| `details` | object | Everything else: period, change in value, fees, vesting, transactions, notes, `confidence`. |

### 4.3 `benefits[]`

| field | type | meaning |
|---|---|---|
| `owner` | owner key, required | Family-tier plans use `joint` + `details.coveredMembers`. |
| `country` | `IL` \| `US`, required | |
| `source` | string, required | `"employer:<Company> / <Carrier>"`, an insurer name, or `"private"`. Part of the match key: **must be unique per owner + category** (add a qualifier like `(voluntary AD&D)`). |
| `category` | required | `life`, `add`, `ltd`, `std`, `work_capacity`, `health`, `dental`, `vision`, `critical_illness`, `long_term_care`, `hsa`, `fsa`, `espp`, `401k_match`, `other`. |
| `coverageAmount` / `coverageCurrency` | number / `ILS`\|`USD` | Lump sum for life/AD&D; LTD = monthly benefit max (say so in details). |
| `monthlyCost` / `costCurrency` | number / currency | The **employee's** monthly cost. Per-paycheck costs are converted (semi-monthly: × 2). Employer cost goes in `details.monthly.employer`. |
| `payer` | `employee` \| `employer` \| `split` | |
| `beneficiary` | string | |
| `endsAt` | date | Cover end date. |
| `linkedSavingsAccountId` | string | Normally null. A `401k_match` with no link is attached to the owner's 401(k) automatically. |
| `details` | object | perPaycheck, monthly, payFrequencyAssumed, plan, tier, coveredMembers, effectiveDate, notes … |

### 4.4 `profile`

| field | meaning |
|---|---|
| `members[]` | `{key, name, nameHe, role: "adult"\|"child", birthDate, targetRetirementAge (40–90), employment, residence}`. Keys must be unique. |
| `goals`, `goalsText`, `riskTolerance`, `usdIlsRate` | Same as the profile editor. Rarely set from a statement. |

### 4.5 Extraction metadata

Claude Code may put `documentType`, `sourceFile`, `confidence` or notes into
`details` / `notes` / `agentNotes`. Top-level `documentType`/`warnings` keys are
ignored by the import and flagged by the validator.

## 5. Examples per document type

All values and owner keys are synthetic. **Owner keys are household-specific.** The keys used here (`alex`, `dana`, `joint`, `noa`, `eli`, `maya`) are placeholders. The real member keys come from the app's household profile: `GET /api/savings/profile` (its `members[].key`), or ask the user. Never hardcode real keys in docs or examples. The complete, schema-valid versions are in
[`.claude/skills/import-statements/examples.json`](../../.claude/skills/import-statements/examples.json)
(the unit tests check every one against the schema and the privacy scrubber).

**Israeli consolidated report** (one product shown):

```json
{
  "israel": {
    "asOf": { "dana": "2026-09-30" },
    "currency": "ILS",
    "people": [{
      "key": "dana", "nameHe": "דנה", "nameEn": "Dana",
      "summary": { "totalBalance": 612500, "reconciliation": "Products sum to 612,500 = headline." },
      "products": [{
        "type": "pension", "typeHe": "קרן פנסיה מקיפה", "provider": "Sample Pension Ltd",
        "policyNumber": "55501234-2", "status": "active", "balance": 400000,
        "track": "מניות (Equities) 1001", "feeDepositPct": 1.0, "feeAccumulationPct": 0.22,
        "monthlyDeposit": { "total": 1350 }, "insuredSalary": 8500, "projectedMonthlyPension": 6100,
        "coverages": [
          { "type": "disability_pension", "typeHe": "פנסיית נכות", "amount": 6375, "monthlyCost": 140 },
          { "type": "survivors_spouse", "typeHe": "שארים אלמן/ה", "amount": 5100, "monthlyCost": 23 }
        ],
        "sourcePage": [2, 4],
        "notes": "Track rows sum to 42,000 but the balance is 400,000; balance from the summary row."
      }]
    }]
  }
}
```

**US 401(k):**

```json
{
  "accounts": [{
    "owner": "alex", "country": "US", "type": "401k", "provider": "Sample Recordkeeper",
    "planName": "Acme Corp 401(k) Plan", "currency": "USD",
    "balance": 85000.25, "balanceAsOf": "2026-09-30",
    "monthlyDepositEmployee": 2000, "monthlyDepositEmployer": 1000, "monthlyDepositTotal": 3000,
    "projectedMonthlyPension": 550,
    "details": { "statementPeriod": "2026-07-01..2026-09-30", "monthlyDepositBasis": "YTD ÷ 9 months" }
  }],
  "benefits": [{ "owner": "alex", "country": "US", "source": "employer:Acme Corp / 401(k)",
                 "category": "401k_match", "monthlyCost": 0, "costCurrency": "USD", "payer": "employer" }]
}
```

**US employer benefits:**

```json
{
  "benefits": [
    { "owner": "joint", "country": "US", "source": "employer:Acme Corp / Sample Health", "category": "health",
      "monthlyCost": 400, "costCurrency": "USD", "payer": "split",
      "details": { "perPaycheck": { "employee": 200, "employer": 1000 }, "payFrequencyAssumed": "semi-monthly (24/yr)",
                   "coveredMembers": ["alex", "dana", "noa", "eli", "maya"] } },
    { "owner": "alex", "country": "US", "source": "employer:Acme Corp / Sample Life Co (basic AD&D)", "category": "add",
      "coverageAmount": 400000, "coverageCurrency": "USD", "monthlyCost": 0, "payer": "employer" },
    { "owner": "alex", "country": "US", "source": "employer:Acme Corp / Sample Life Co (voluntary AD&D)", "category": "add",
      "coverageAmount": 250000, "coverageCurrency": "USD", "monthlyCost": 8.5, "payer": "employee" },
    { "owner": "alex", "country": "US", "source": "employer:Acme Corp / Sample Disability Co", "category": "ltd",
      "coverageAmount": 10000, "coverageCurrency": "USD", "monthlyCost": 0, "payer": "employer",
      "details": { "coverageIsMonthlyBenefit": true } }
  ]
}
```

**US RSU / ESPP stock plan:**

```json
{
  "accounts": [{
    "owner": "alex", "country": "US", "type": "rsu", "provider": "Sample Stock Plan Broker",
    "policyNumber": "XX-1234", "currency": "USD", "balance": 45000, "balanceAsOf": "2026-06-30",
    "details": { "ticker": "ACME", "vestedHeldShares": 500, "unvestedShares": 300, "unvestedValue": 27000,
                 "vestSchedule": [{ "date": "2026-12-01", "shares": 100 }] }
  }]
}
```

**Anything else (best effort):**

```json
{
  "accounts": [{
    "owner": "joint", "country": "US", "type": "brokerage", "provider": "Sample Brokerage",
    "policyNumber": "9876-5432", "currency": "USD", "balance": 12000, "balanceAsOf": "2026-10-31",
    "details": { "extractionNote": "Cash and positions combined.", "confidence": "medium" }
  }]
}
```

Extraction rules that matter (full list in the skill's `extraction-guide.md`):
- Hebrew RTL tables: `pdftotext` can reverse column order. Check against the rendered page and reconcile with the headline total.
- Track rows may not sum to the product balance. Use the product's total row.
- A big "last deposit" (הפקדה אחרונה) on a fund with no deposits this year is a transfer, not a contribution.
- Per-paycheck costs → monthly (semi-monthly: × 2), with the assumption stated.
- `monthlyCost` is what the household pays; employer cost goes in `details`.
- RSU balance is vested-and-held only; unvested value goes in `details`.

## 6. Hebrew glossary

| Hebrew | English |
|---|---|
| דו"ח תקופתי / ריכוז תוכניות / דו"ח תוכניות | periodic report / consolidated plans / plans report |
| סך התיק / סה"כ חיסכון / סך צבירה | total portfolio / total savings / accumulated balance |
| יתרת כספים לסוף שנה קודמת | balance at end of previous year |
| ערך פדיון / ערך מסולק | surrender value / paid-up (frozen) value |
| קרן פנסיה (מקיפה / כללית / משלימה) | pension fund (comprehensive / general / complementary) |
| ביטוח מנהלים / חיים משולב חיסכון | manager's insurance (life insurance with savings) |
| חיסכון טהור | savings-only policy |
| סיכון טהור / ריסק | pure risk / term life |
| קרן השתלמות | study fund (hishtalmut) |
| קופת גמל / גמל להשקעה | provident fund / investment provident fund |
| חיסכון לכל ילד | savings for every child |
| חברה מנהלת / יצרן | managing company / provider |
| מספר פוליסה / מספר חשבון | policy / account number |
| ת.ז / ת"ז / מספר זהות | national ID (never stored) |
| פעיל / לא פעיל / מסולקת / מוקפאת | active / inactive / paid-up / frozen |
| שכיר / עצמאי | salaried / self-employed |
| הפקדה אחרונה / הפקדות השנה / ניוד | last deposit / deposits this year / transfer |
| שכר מבוטח / שכר קובע / שכר מדווח | insured / determining / reported salary |
| תגמולים עובד / מעביד / פיצויים / תגמולים 47 | employee / employer contributions / severance / self-employed §47 |
| דמי ניהול מהפקדה / מצבירה | management fee on deposits / on balance |
| מסלול השקעה / מס' מסלול באוצר | investment track / Treasury track number |
| מניות / כללי / תלוי גיל / עוקב מדדים | equities / general / age-based / index-tracking |
| תשואה מתחילת שנה / 12 חודשים / ממוצעת 3/5 שנים | YTD / 12-month / 3- or 5-year average return |
| נכונות / ת. נכונות | as of / as-of date |
| ת. הצטרפות / תאריך נזילות | join date / liquidity date |
| תיקון 190 | Amendment 190 |
| מקדם המרה / מקדם מובטח | annuity conversion factor / guaranteed factor |
| קצבה משלמת / קצבה לא משלמת / הוני | annuity-paying / annuity-only provident / lump-sum money |
| קצבה צפויה | projected pension |
| פנסיית נכות / שארים / אלמן/ה / יתום | disability pension / survivors / widow(er) / orphan |
| אובדן כושר עבודה (אכ"ע) | loss of work capacity |
| סכום ביטוח למקרה מוות / עלות כיסוי | death sum insured / cover cost |
| שחרור מתשלום פרמיה | premium waiver |
| ביטוח בריאות / סיעודי / תאונות אישיות | health / long-term care / personal accident |
| קיים / לא קיים / לא דווח | exists / doesn't exist / not reported |

## 7. Matching and upsert rules

Re-importing the same or a newer statement **updates** rows; it never
duplicates them. Implemented in `importSavingsDoc` / `importHouseholdBundle`
(`src/lib/savings-data.ts`) and `mapSavingsImport` (`src/lib/savings-import.ts`).

**Israeli products (`israel`)**
- Account match key: **owner + provider (case-insensitive) + type + last 4 digits of `policyNumber`**.
- Found → updated. The headline `balance`/`balanceAsOf` only move when the statement is the same date or newer; an older statement just adds history. An archived account is un-archived.
- Not found → created with `source: "pdf-import"`.
- **Snapshots:** one `SavingsSnapshot` per account per statement date (`asOf`), unique on (account, date), so re-importing the same month overwrites that point instead of adding another.
- **Coverages → benefits:** each `coverages[]` item becomes a `Benefit` linked to its account, keyed by an `importKey` (account match key + coverage position). Re-import updates them in place. Keep coverages in the same order between imports.
- Standalone term life → benefit only (key: owner + provider + "termlife" + last 4).
- Same product twice in one file → the later one wins, with a warning.
- **Profile:** people are added; for existing members only empty fields are filled (what you typed is never overwritten).

**`accounts[]`**
- Match key: **owner + type + provider (case-insensitive) + policy last 4**. Found → updated (all fields, un-archived); not found → created. A snapshot is written at `balanceAsOf` (today if missing).

**`benefits[]`**
- Match key: **owner + category + source (case-insensitive)**, among manually-created/bundle benefits (not Israeli coverage rows). Found → updated; not found → created.
- Two benefits in one bundle with the same key collapse into one (the second overwrites the first). The validator warns about this; give each a distinct `source`.
- `401k_match` with no `linkedSavingsAccountId` is linked to the owner's 401(k).

**`profile`**
- Members merge by key; non-null bundle values overwrite (unlike the Israeli path). Other profile fields are set when present.

**Merging several PDFs** (`validate-bundle.ts … --merge`, `mergeBundles` in `src/lib/bundle-tools.ts`) uses the same keys, so the merged file shows exactly what will be written: Israeli people merge by key (latest `asOf` per person, newer statement wins per product), accounts keep the newer `balanceAsOf`, benefits keep the later file's row (with a warning), members merge with later non-null values winning.

## 8. Token setup (direct loading)

Only needed for option (b), where Claude Code posts the bundle itself.
`POST /api/savings/import` accepts **either** the app-password cookie (the
browser) **or** `Authorization: Bearer $SAVINGS_INGEST_TOKEN`. The path is in
`PUBLIC_PATHS` in `src/proxy.ts`, and the route checks one of the two itself
(constant-time token compare in `src/lib/ingest-auth.ts`).

1. Generate a token: `openssl rand -hex 32`.
2. Add it to Vercel and redeploy:
   ```bash
   vercel env add SAVINGS_INGEST_TOKEN production    # paste the token
   vercel --prod
   ```
   For local dev, add `SAVINGS_INGEST_TOKEN=…` to `.env.local`.
3. Make it available to the script in your shell (e.g. in `~/.zshrc`, not in the repo):
   ```bash
   export SAVINGS_INGEST_TOKEN=…
   ```
4. If Vercel Deployment Protection is on, machine requests are stopped before
   the app. Create a "Protection Bypass for Automation" secret in the Vercel
   project settings and `export VERCEL_PROTECTION_BYPASS=…`; the script sends it
   as `x-vercel-protection-bypass`.
5. Post:
   ```bash
   npx tsx scripts/savings/post-bundle.ts private-data/<file>.bundle.json               # production (trading-diary-lilac.vercel.app)
   npx tsx scripts/savings/post-bundle.ts private-data/<file>.bundle.json http://localhost:3000
   ```
   `SAVINGS_BASE_URL` overrides the default URL. The script refuses files that
   fail the schema or the privacy scrub.

The same token is used by the daily advisor routine (see README).

## 9. Privacy

- **PDFs never leave your machine** except to Claude (via Claude Code on your subscription). The web app never receives a PDF.
- PDFs and bundles live in `private-data/` (gitignored), along with root-level statement PDFs that match the `.gitignore` patterns. Never commit them, and never copy real values into tests or docs.
- **Account and policy numbers may be kept in full** (your decision, Nov 2026). The bundle carries the full `policyNumber`. Today the database keeps the last 4 digits (`policyLast4`, used for matching); a full `policyNumber` column is being added and will hold the full number once wired up.
- **National IDs (ת.ז) and SSNs are never stored**: not as a field, not in names, notes or details.
  - Some Israeli pension account numbers are "<9-digit ID>-<suffix>". Those are kept as the account number, but the bare ID never appears on its own.
  - The skill tells Claude Code not to output them, and `validate-bundle.ts` / `post-bundle.ts` enforce it with `scrubBundle` (`src/lib/bundle-tools.ts`). It removes ID/SSN fields (`nationalId`, `idNumber`, `ssn`, `tz`, …), SSN-formatted numbers anywhere, 9-digit numbers labelled as an ID (ת.ז, ת"ז, מספר זהות, "ID no", SSN …) in free text, and any bare ID that is the prefix of an ID-based account number. `--fix` scrubs the file in place.
- The import API does not run the scrubber, so a hand-made JSON loaded at `/savings/import` is your responsibility. Run the validator first.

## 10. Limits

- Bundle size: the import page rejects files over 5 MB. Vercel's request-body limit is about 4.5 MB, far above any real bundle (a full household is ~60 KB).
- `accounts` ≤ 200, `benefits` ≤ 500, `israel.people` ≤ 20, products per person ≤ 100, coverages per product ≤ 50, profile members ≤ 20.
- The import route runs for up to 60 s (`maxDuration`); a household bundle imports in a few seconds.
- PDFs: no limit in the app. Very long PDFs are read page by page by Claude Code. Scanned (image-only) PDFs have no text layer; Claude Code reads the rendered pages instead, which is slower and less certain.
- Cost: no API cost. The extraction uses your Claude subscription's usage.

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Import page: **"No “people” array found."** | The JSON has an `israel` key whose content isn't an Israeli extract, or a bare doc without `people`. Wrap US data as `{ "accounts": [...] }` / `{ "benefits": [...] }`; Israeli data needs `{ "israel": { "asOf": {...}, "people": [...] } }`. |
| **"Missing “asOf”"** | `israel.asOf` must be an object keyed by person: `{"alex": "2026-10"}`. |
| **"The bundle is empty." / "Bundle is empty"** | None of `israel`, `accounts`, `benefits`, `profile` is present (check spelling and nesting). |
| **`accounts.0.type: Invalid option`** (any enum) | Use one of the listed values (§4); e.g. `401k`, not `401(k)`. |
| **"Member key must be letters, digits, - or _"** | Owner keys are lowercase ids like `alex` (see the household profile), not names. |
| `feeDepositPct` / `feeAccumulationPct` too big | Fees are percentages: 0.22 means 0.22%, not 22. |
| **401 Unauthorized** from `post-bundle.ts` | `SAVINGS_INGEST_TOKEN` in your shell doesn't match Vercel's, or Vercel wasn't redeployed after adding it. |
| HTML / "Deployment Protection" response | Set `VERCEL_PROTECTION_BYPASS` (§8). |
| **"SAVINGS_INGEST_TOKEN is not set"** | `export SAVINGS_INGEST_TOKEN=…` in the shell that runs the script. |
| A benefit is missing after import | Two benefits had the same owner + category + source and collapsed. Make the sources distinct and re-import. |
| An account was duplicated | The provider spelling, type or policy number changed between statements, so the match key differs. Fix the bundle to match the existing account (or archive the duplicate on `/savings`). |
| Headline balance didn't change | You imported an older statement than the stored one; it was added to history only. |
| Validator: **PRIVACY findings** | Remove the IDs from the source text, or run with `--fix`. |
| "That file is larger than 5 MB" | That's not a bundle (maybe the PDF). Bundles are small JSON files. |

## 12. Loading a JSON manually

1. Open **`/savings/import`**.
2. Drop the `.bundle.json` (or choose it, or paste the JSON).
3. Check the preview (people, accounts, benefits, members) and click **Import**.
4. The result shows created / updated counts, history points, coverages and warnings.

From a shell without the scripts (token required):

```bash
curl -sS -X POST "https://trading-diary-lilac.vercel.app/api/savings/import" \
  -H "Authorization: Bearer $SAVINGS_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  --data @private-data/<file>.bundle.json
```

Validate first: `npx tsx scripts/savings/validate-bundle.ts private-data/<file>.bundle.json`.

## 13. Files

| Path | What |
|---|---|
| `.claude/skills/import-statements/SKILL.md` | The Claude Code skill (procedure). |
| `.claude/skills/import-statements/extraction-guide.md` | Per-document mapping, pitfalls, glossary, domain primer. |
| `.claude/skills/import-statements/examples.json` | Synthetic example bundles (tested). |
| `scripts/savings/validate-bundle.ts` | Scrub + schema check + summary + merge. |
| `scripts/savings/post-bundle.ts` | Token-authenticated POST to the import API. |
| `src/lib/bundle-tools.ts` | `scrubBundle`, `mergeBundles`, `summarizeBundle` (pure, unit-tested). |
| `src/lib/savings-validators.ts` | `householdBundleSchema`, `savingsImportSchema`. |
| `src/lib/savings-import.ts` | Israeli extract → accounts/benefits mapping. |
| `src/lib/savings-data.ts` | `importSavingsDoc`, `importHouseholdBundle`. |
| `src/app/api/savings/import/route.ts` | The import endpoint (cookie or token). |
| `src/components/savings/ImportPanel.tsx`, `PdfHelp.tsx` | The `/savings/import` page. |
| `tests/lib/bundle-tools.test.ts` | Scrubber, merge, summary and example-conformance tests. |
