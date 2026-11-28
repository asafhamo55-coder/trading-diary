# Tax return extraction guide

Field names refer to `src/lib/tax-return-schema.ts`. Line numbers are the IRS /
Georgia form lines for tax years 2024–2025; confirm against the printed label.

## 1. Layouts

CPA client copies differ by software. Find each form by its page header, not by
page number.

- **Layout A**: client letters, then the FBAR, then 8879, Form 1040 and
  schedules in sequence-number order, then per-property **"Depreciation and
  Amortization Report"** pages (one per Schedule E property, with cost, land,
  method, life, prior and current depreciation), AMT copies of forms, Form
  8938, the Georgia return, and a **"Tax Return Carryovers to <next year>"** page
  and a **"Two-Year Comparison Worksheet"** near the front.
- **Layout B**: filing instructions, FBAR pages, 8879, Form 1040 and schedules,
  Form 8938, statements ("Federal Statements"), the Georgia return, then
  **Forms 4562** per activity (federal and a Georgia depreciation copy). There
  may be no per-property depreciation report; take depreciation from Schedule E
  line 18 and basis from Form 4562 Part III / the asset detail.
- Ignore: letters, e-file authorizations (8879, jurat, 114a), estimated-tax
  vouchers' payment slips (keep only due dates and amounts), direct-deposit
  pages, AMT duplicate forms (except Form 6251 itself), and any page that only
  repeats identifiers.
- A second Form 1040 copy later in the file (e.g. a state or "as filed" copy)
  must match the first; if it differs, note which one you used.

## 2. Number parsing

`1,234.` → 1234; `(1,234)` or `-1,234` → −1234; blank or `.` → null. Schedule E
expense lines are positive; the column's net (line 21/26) may be negative.

## 3. Form → field map

**Form 1040** (→ `summary`): 1z wages · 2b taxable interest · 3a qualified /
3b ordinary dividends · 7 capital gain/loss · 8 Schedule 1 total (split below)
· 9 total income · 10 adjustments · 11 AGI · 12 standard **or** itemized
(Schedule A) · 13 QBI · 15 taxable income · 16 tax · 20 Schedule 3 credits ·
23 other taxes (Schedule 2) · 24 total tax · 25a/25b withholding (W-2 / other)
· 26 estimated payments · 33 total payments · 34/35a refund · 37 amount owed.
Marginal bracket: from the two-year comparison or the tax computation worksheet.

**Schedule 1**: 3 business (→ `scheduleC`) · 4 other gains (→ `form4797`) ·
5 rental/royalty (→ `scheduleE`) · 8 other income · Part II adjustments.

**Schedule 2**: 4 self-employment tax · 11 additional Medicare (8959) ·
12 NIIT (8960).

**Schedule 3**: 1 foreign tax credit · 2 child & dependent care credit.

**Schedule A** (→ `summary.itemized`): 7 taxes (after the SALT cap) ·
10 interest · 14 contributions · 17 total.

**Schedule B**: totals only (already on the 1040). Part III foreign-account
questions → `foreign.fbarFiled` when answered.

**Schedule C** (→ `business[]`, one per business, owner = member key):
1 gross receipts · 28 total expenses · 30 home office (Form 8829) · 31 net.

**Schedule D / 8949** (→ `capitalGains`): 7 net short-term · 15 net long-term ·
carryover from the carryovers page.

**Schedule E Part I** (→ `rentals[]`, one per column A/B/C, per page):
address (line 1a; street only, no unit owner names) · 2 fair-rental days →
`daysRented` · 3 rents → `RENT` · 5 advertising → `ADVERTISING` · 6 auto &
travel → `AUTO_TRAVEL` · 7 cleaning & maintenance → `CLEANING_MAINT` ·
8 commissions → `COMMISSIONS` · 9 insurance → `INSURANCE` · 10 legal &
professional → `LEGAL` · 11 management → `MANAGEMENT` · 12 mortgage interest →
`MORTGAGE_INTEREST` · 13 other interest → `OTHER` · 14 repairs → `REPAIRS` ·
15 supplies → `SUPPLIES` · 16 taxes → `PROPERTY_TAX` · 17 utilities →
`UTILITIES` · 18 depreciation → `DEPRECIATION` · 19 other (HOA/association
dues → `HOA`, anything else → `OTHER`; read the attached statement) ·
21 income/loss → `net`. Foreign rentals are Schedule E columns too — include
them (the app may have them as properties).

**Depreciation report / Form 4562** (→ `rentals[].depreciation`): cost or basis
· land (when listed separately; otherwise null) · method + life (e.g.
"SL 27.5 MM", "SL 40 ADS") · date placed in service · prior depreciation ·
current-year depreciation. When a property has several assets (building,
improvements), sum basis/prior/current and note the split.

**Form 8582** (→ `passiveLosses`): allowed losses · suspended (unallowed)
losses · per-activity carryforward from the worksheet.

**Form 4797**: net gain/loss → `capitalGains.sales4797`; note what was sold
(address only).

**Form 1116** (→ `foreign.taxCredit[]`, one per basket: passive / general):
credit allowed · carryover (from Schedule B of 1116 or the carryovers page).

**Form 8938 / FBAR** (→ `foreign`): filed booleans · account count ·
aggregate max value · per account: institution name, type (deposit / custodial
/ pension / insurance / other), owner key, max value in USD. **No account
numbers, no addresses of the institution, no identifiers.**

**Form 8889** (→ `hsa`): 2 contributions · 9 employer contributions ·
13 deduction · 14c taxable distributions.

**Form 2441** (→ `childCare`), **Schedule 8812** (→ `childTaxCredit`),
**Form 6251** (→ `amt`: AMTI and AMT).

**Carryovers page** (→ `carryovers[]`): form · description · amount — every row.

**Two-year comparison**: the prior-year column → a `partial` prior-year record
(summary only).

**Georgia Form 500** (→ a separate `US-GA` record, `state`): Georgia AGI ·
adjustments (Schedule 1) · taxable income · tax · credits · withholding ·
estimated payments · refund / amount owed · next year's estimated vouchers
(due date + amount).

## 4. Pitfalls

- Two-unit buildings are usually one Schedule E column: set `unitIds` to every
  unit record; the app splits evenly.
- A property sold during the year shows on Form 4797 and may have a partial
  Schedule E column: include it; leave `propertyId` null if the app has none.
- Don't double count: Schedule 1 line 5 already nets every Schedule E column
  and the 8582 limitation.
- Statement pages ("Statement 6 — Form 8582 …") hold the per-activity detail.
