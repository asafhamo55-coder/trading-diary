# Savings / net-worth module

Part of Hamo Home Equity. It tracks the household's long-term savings in Israel
and the US (pension, manager's insurance, hishtalmut, gemel, 401(k), RSUs,
brokerage, cash), insurance and employer benefits, and the household profile.
It combines them with the Properties and Trade modules into one net-worth
figure.

- **Loading statements:** [pdf-import.md](pdf-import.md). PDFs are read by Claude Code (the `import-statements` skill), turned into a JSON bundle and loaded through `/savings/import` or the token API.

## Pages

| Route | What |
|---|---|
| `/savings` | Overview: net worth, accounts by owner/type/country, history, fees, liquidity. |
| `/savings/benefits` | Insurance and employer benefits, coverage overlaps and gaps. |
| `/savings/profile` | Household members, goals, risk tolerance, FX override. |
| `/savings/import` | Load a household bundle / Israeli extract JSON; help for PDFs. |

UI: `src/components/savings/*`, dashboard in `src/components/dashboard/household/*`.

## Data model

Prisma models in `prisma/schema.prisma`. The DDL is also applied idempotently
at runtime by `ensureSavingsSchema()` (`src/lib/savings-schema.ts`), so a fresh
deploy never needs a manual migration.

| Model | Purpose | Key fields |
|---|---|---|
| `SavingsAccount` | One savings product / account. | `owner` (member key or `joint`), `country` (`IL`/`US`), `type`, `provider`, `planName`, `policyLast4` (match key), `policyNumber` (full, being wired up), `currency` (`ILS`/`USD`), `balance`, `balanceAsOf`, `track`, `feeDepositPct`, `feeAccumulationPct`, `monthlyDeposit{Employee,Employer,Severance,Total}`, `insuredSalary`, `liquidityDate`, `projectedMonthlyPension`, `details` (JSON: everything else), `source` (`pdf-import`/`manual`), `archivedAt`. |
| `SavingsSnapshot` | Balance history. | `savingsAccountId`, `asOf`, `balance`; unique on (account, asOf). |
| `Benefit` | Insurance and employer benefits in both countries. | `owner`, `country`, `source`, `category`, `coverageAmount`/`Currency`, `monthlyCost`/`costCurrency` (household's cost), `payer`, `endsAt`, `linkedSavingsAccountId` (cover inside a pension/policy), `details`, `origin`, `importKey` (idempotency for imported coverages). |
| `HouseholdProfile` | One per account. | `members` (JSON `HouseholdMember[]`: key, name, nameHe, role, birthDate, targetRetirementAge, employment, residence), `goals`, `goalsText`, `riskTolerance`, `usdIlsRate` (FX override). |
| `AdvisorReport` | Saved advisor outputs. | `model`, `inputHash`, `snapshot`, `output`, `usage`. |

Enumerations live in `src/lib/savings.ts` (`SAVINGS_TYPES`, `BENEFIT_CATEGORIES`,
`BENEFIT_PAYERS`, `COUNTRIES`, `CURRENCIES`). Owner keys today: `asaf`,
`einat`, `joint`, `yoav`, `nadav`, `roni`.

Code layout:
- `src/lib/savings.ts`: pure domain logic (net worth, fees, fee drag, liquidity, retirement projection, coverage overlaps, child milestones). Unit-tested.
- `src/lib/savings-data.ts`: Prisma access, import, profile, FX resolution.
- `src/lib/savings-validators.ts`: zod schemas for every API body and the import formats.
- `src/lib/savings-import.ts`: Israeli extract → accounts/benefits mapping.
- `src/lib/bundle-tools.ts`: bundle scrubber / merger / summary used by the import scripts.

## APIs

All under the app-password cookie (enforced by `src/proxy.ts`) unless noted.

| Method & path | Purpose |
|---|---|
| `GET/POST /api/savings/accounts` | List / create accounts. |
| `GET/PATCH/DELETE /api/savings/accounts/[id]` | Read / update / delete one account. |
| `GET/POST /api/savings/benefits`, `PATCH/DELETE /api/savings/benefits/[id]` | Benefits CRUD. |
| `GET/PUT /api/savings/profile` | Household profile. |
| `GET /api/savings/networth` | Full net-worth payload + coverage report. |
| `GET /api/savings/fx` | The USD→ILS rate in use and its source. |
| `POST /api/savings/import` | Load an Israeli extract or a household bundle. **Cookie or `Bearer SAVINGS_INGEST_TOKEN`** (see [pdf-import.md §8](pdf-import.md#8-token-setup-direct-loading)). |
| `/api/savings/advisor/**` | Advisor (see below). |
| `GET /api/cron/keepalive` | Daily cron; `Bearer CRON_SECRET`. |

## Net-worth calculation

`buildNetWorth()` in `src/lib/savings.ts`, fed by `getNetWorth()` in `savings-data.ts`:

- **Savings:** every non-archived account's `balance`, converted to USD (and ILS) at the current FX rate. Totals by owner, country and type.
  - RSU accounts count only vested-and-held value; unvested shares live in `details` and are excluded.
- **Properties:** current value, or purchase price if there's none (flagged as a data gap). Mortgage balance is a liability (unknown = 0, flagged). Property amounts are USD.
- **Trade:** starting balance + all-time realized P&L + net deposits/withdrawals. Open positions' unrealized P&L is not included.
- **Net worth** = savings + property values + trade equity − mortgages, in USD with an ILS figure.
- **Per-account helpers:**
  - annual fee cost (balance × accumulation fee + yearly deposits × deposit fee)
  - 10-year fee drag against planning benchmarks (`BENCHMARK_FEES`, 5% gross return)
  - hishtalmut liquidity (from `liquidityDate`, or 6 years after `details.openDate`)
  - monthly deposits
- **History:** month-end totals built from `SavingsSnapshot` rows (each account's latest snapshot up to that month).
- **Data gaps:** missing fees, balances older than 6 months, missing dates, unknown mortgages and so on are listed so the UI and advisor can ask for them.
- **Coverage:** `findCoverageOverlaps()` groups benefits by category and owner to find duplicate cover (e.g. US employer life + Israeli term life + pension survivors) and gaps (e.g. no disability cover).

## FX

USD→ILS is resolved in this order (`getFxRate` in `savings-data.ts`, `resolveUsdIlsRate` in `src/lib/savings.ts`):
1. Profile override (`HouseholdProfile.usdIlsRate`).
2. Live rate: the Bank of Israel representative rate, then ECB via Frankfurter (`src/lib/fx.ts`). Cached about 6 hours in Next's data cache (`src/lib/fx-server.ts`).
3. `USD_ILS_RATE` env var.
4. Default 3.7.

`GET /api/savings/fx` reports the rate and its provenance. Display-currency
formatting lives in `src/lib/currency.ts` and `src/components/ui/currency*.tsx`.

## Advisor (daily Claude Code routine)

_Placeholder. This section is being written separately, together with the
advisor context/ingest endpoints (`src/lib/advisor.ts`,
`src/app/api/savings/advisor/**`)._

## Keep-alive cron

`vercel.json` schedules `GET /api/cron/keepalive` daily at 09:00 UTC. It:
- runs one real query so the free-tier Supabase database isn't paused for inactivity;
- applies the idempotent savings/property DDL, so new columns exist before anyone opens a page.

When `CRON_SECRET` is set, Vercel sends it as a bearer token and the route checks it. The path is in `PUBLIC_PATHS`.

## Environment variables

| Var | Used by |
|---|---|
| `APP_PASSWORD` | Login cookie for the whole app. |
| `SAVINGS_INGEST_TOKEN` | Bearer token for `POST /api/savings/import` (and the advisor routine). |
| `USD_ILS_RATE` | Optional FX fallback. |
| `CRON_SECRET` | Keep-alive cron auth. |
| `VERCEL_PROTECTION_BYPASS` | Local shell only: lets scripts pass Vercel Deployment Protection. |

## Tests

`npx vitest run`:
- `tests/lib/savings.test.ts`: domain logic and FX.
- `tests/lib/savings-import.test.ts`: Israeli mapping.
- `tests/lib/savings-bundle.test.ts`: bundle schema.
- `tests/lib/bundle-tools.test.ts`: scrubber, merge, summary, synthetic examples.
