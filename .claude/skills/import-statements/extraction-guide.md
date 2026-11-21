# Extraction guide

How to map each statement type into the household bundle, what goes wrong,
and the vocabulary. Lessons come from the first real extractions (Nov 2026).
Exact field definitions: `docs/savings/pdf-import.md` §4. Shapes: `examples.json`.

## 1. Recognise the document

| Signs | Type | Goes to |
|---|---|---|
| Hebrew, RTL, "דו"ח תקופתי", "ריכוז תוכניות", "דו"ח תוכניות", סך התיק / סה"כ חיסכון, product rows of קרן פנסיה / ביטוח מנהלים / השתלמות / גמל | Israeli consolidated long-term savings report | `israel` (one person per report) |
| "401(k) Plan", "Account Summary", "Change in Value", vested balance, quarterly period | US 401(k) statement | `accounts[]` type `401k` (+ optional `401k_match` benefit) |
| "Benefits Confirmation Statement", "Your Cost Per Pay Period", medical/dental/vision/life/AD&D/STD/LTD/HSA/FSA lines | US employer benefits enrollment summary | `benefits[]` |
| Morgan Stanley at Work / Shareworks / E*TRADE / Fidelity stock plan, "Share Purchase and Holdings", RSU releases, ESPP purchases, vest schedule | US stock-plan statement | `accounts[]` type `rsu` (ESPP holdings too; mention ESPP in `details`) |
| Anything else (brokerage, IRA, bank savings, child savings חיסכון לכל ילד, standalone insurance policy) | best effort | `accounts[]` or `benefits[]`, with notes on what's uncertain |

## 2. Israeli consolidated report → `israel`

```
israel.asOf[<owner>]   = the data date ("נכונות" / "נתונים נכונים ל-"), not the issue date. "YYYY-MM" if only a month is given.
israel.currency        = "ILS"
israel.people[]        = { key, nameHe, nameEn, birthDate?, retirementAge?, summary{…}, products[] }
```

Per product (`israel.people[].products[]`), mapped columns:

| field | from | notes |
|---|---|---|
| `type` | product kind | `pension`, `managers_insurance`, `hishtalmut`, `gemel`, `gemel_investment`, `savings_policy`, `savings_child`, or `other`. Term life (ריסק) → `other` with `balance: 0` and its cover in `coverages` (the importer turns it into a benefit, no account). |
| `typeHe` | Hebrew product name as printed | |
| `provider` | חברה מנהלת / יצרן | Keep it stable across months (same spelling each time) because it's part of the match key. |
| `planName` | plan / fund name | |
| `policyNumber` | מספר פוליסה / חשבון | **Full number** (allowed). ID-based numbers ("<ID>-2") stay as printed; never the bare ID. |
| `status` | סטטוס | `active` / `inactive` / `frozen` (מסולקת/מוקפאת = paid-up/frozen). |
| `balance` | סך צבירה / יתרה of the product | Number. **Use the product's own total row, not the sum of track rows** (see pitfalls). |
| `track` | main investment track name + Treasury code | e.g. "מניות (Equities) 1001". Full list in `tracks[]` (kept in details). |
| `ytdReturnPct` | תשואה מתחילת שנה | |
| `feeDepositPct` / `feeAccumulationPct` | דמי ניהול מהפקדה / מצבירה | Percent numbers (0.16 = 0.16%). Omit/null if not in the report (some templates have none). |
| `monthlyDeposit` | `{employee, employer, severance, total}` | Only real recurring contributions. If only the total is known, set `total`; an inferred split goes in `notes`/`derivedSplitAssumption`, not in the columns. |
| `insuredSalary` | שכר מבוטח / שכר קובע / שכר מדווח | |
| `liquidityDate` | תאריך נזילות | Mostly hishtalmut/gemel. |
| `projectedMonthlyPension` | קצבה צפויה | Say in notes whether it assumes further deposits. |
| `conversionFactor` | מקדם המרה / מקדם חלוקה לקצבה | Manager's insurance. `guaranteedFactor` true/false/null. |
| `coverages[]` | `{type, typeHe, amount, monthlyCost, period?}` | Death / survivors / disability / work-capacity covers inside the product → become benefits linked to the account. Use English `type` like `death`, `survivors_spouse`, `survivors_orphan`, `disability_pension`, `work_capacity`, `term_life`, `premium_waiver`. |
| `openDate`, `sourcePage`, `notes`, `tracks`, `severanceComponent`, `lastDeposit`, … | anything else | Kept in `details`. Add `sourcePage` always. |

`summary` (free-form, kept for reference): headline total, YTD, by withdrawal
type (קצבה משלמת / לא משלמת / הון), by provider, exposures, reconciliation.
`agentNotes[]`: report-level observations (missing categories, disclaimers, data artifacts).

### Pitfalls seen in real reports

1. **RTL column reversal.** `pdftotext -layout` can print columns right-to-left in the wrong order, so a "balance" column can actually be "deposits this year". Check column headers on the rendered page image; numbers must reconcile with the headline total.
2. **Track rows don't sum to the balance.** Some templates list only part of the money in the track table (e.g. 48,000 of 450,000). Take the product balance from the product summary row; record the mismatch in `notes`.
3. **"Last deposit" can be a transfer.** A huge הפקדה אחרונה on a fund with 0 deposits this year is a transfer in (ניוד), not a contribution. Don't put it into `monthlyDeposit`; note it.
4. **YTD summaries can be artifacts.** A start-of-year balance with gaps in the monthly chart can produce nonsense like +150% YTD. Prefer per-track YTD and say why.
5. **Different templates per agent/platform.** One report has fees and projected pension but no split; another has splits, join dates and conversion factor but no fees. Leave missing fields null; don't copy from the other spouse's report.
6. **Coverages may be printed at portfolio level** (e.g. page 4 "pension coverages"). Attach them to the active comprehensive pension fund and note the assumption.
7. **Coverage lists of what does NOT exist** (לא קיים / לא נמצא): put that in `agentNotes`, don't create zero benefits.
8. **Self-employed (עצמאי) accounts** have no employer/severance split; "תגמולים 47" is the self-employed contribution type.
9. **Rounding:** headline totals may differ from the product sum by 1 ₪. Fine; state it.
10. **Dates:** DD/MM/YYYY in Hebrew reports. Write ISO (`YYYY-MM-DD` or `YYYY-MM`).

## 3. US 401(k) statement → `accounts[]`

- `type: "401k"`, `country: "US"`, `currency: "USD"`, `provider` = recordkeeper (e.g. "Sample Recordkeeper (…)", spelled as printed), `planName` = employer plan name.
- `balance` = ending (vested) balance; `balanceAsOf` = period end date.
- `monthlyDepositEmployee` / `monthlyDepositEmployer` = **YTD contributions ÷ months elapsed** (state the basis in `details.monthlyDepositBasis`); `monthlyDepositTotal` = sum.
- `projectedMonthlyPension` = the lifetime income illustration (single-life) if printed.
- `feeAccumulationPct`: leave null unless the total cost (fund expense ratios) is printed; the plan-admin fee alone understates cost. Put admin fees in `details.fees`.
- `details.changeInValue.{thisPeriod,ytd}`: beginning, contributions, fees, gain/loss, ending.
- Returns: if none printed, a Modified Dietz estimate is OK in `details` with the formula noted. Never in a column.
- Optional benefit: `{category: "401k_match", payer: "employer", monthlyCost: 0, source: "employer:<Company> / 401(k) (<recordkeeper>)"}`. The importer links it to the owner's 401(k) automatically.

## 4. US benefits enrollment summary → `benefits[]`

- **Per-paycheck → monthly.** Costs are per pay period. Determine frequency (semi-monthly = 24/yr is common; check e.g. HSA per-period × 24 = stated annual target). Monthly = per-paycheck × periods ÷ 12. Record `details.perPaycheck`, `details.monthly`, `details.payFrequencyAssumed`.
- `monthlyCost` = the **employee's** (household's) monthly cost. Employer cost goes in `details.monthly.employer`. `payer`: `employee` / `employer` / `split`.
- `owner`: family-tier plans (medical, dental, vision, critical illness, accident, hospital indemnity, voluntary AD&D family) → `joint` with `details.coveredMembers` listing the covered members' keys (real keys from `GET /api/savings/profile`; placeholders here: `["alex","dana","noa","eli","maya"]`). Person-level covers (basic life, AD&D, STD, LTD, EAP, HSA, 401k match) → the employee.
- `category`: `health`, `dental`, `vision`, `life`, `add`, `std`, `ltd`, `critical_illness`, `long_term_care`, `hsa`, `fsa`, `espp`, `401k_match`, `other` (accident, hospital indemnity, EAP, legal…).
- `coverageAmount`: life/AD&D = lump sum; **LTD "Coverage Amount" is normally the monthly benefit maximum** (`details.coverageIsMonthlyBenefit: true`); STD often "% of salary" → null + `details.benefitPctOfSalary`.
- `source`: `"employer:<Company> / <Carrier>"`. **Must be unique per owner+category**: add a qualifier when the same carrier has two covers in one category (`"… / Sample Life Co (voluntary AD&D)"`), or for `other` (`"… / Sample Carrier (accident)"`, `"… / Sample Carrier (hospital indemnity)"`). Otherwise the import overwrites one with the other.
- Declined / waived / terminated lines: don't load them; list them in a note to the user.
- Pharmacy bundled with medical: fold into the medical row's `details`.
- `details.effectiveDate` / `planYear`: open-enrollment statements are often for next year.

## 5. Stock-plan statement (RSU / ESPP) → `accounts[]`

- `type: "rsu"`. `balance` = value of **vested and held** shares (+ cash in the account) at period end; unvested value is never counted (put `unvestedShares`, `unvestedValue`, `vestSchedule` in `details`).
- `policyNumber` = account number (full is fine). `details`: ticker, price as of, opening/closing positions, transactions (releases, sales, disbursements), tax withholding.
- If shares were sold and the account is empty, still load it with `balance: 0` and flag where the proceeds went (money may be missing from net worth).
- A "Share Purchase and Holdings" heading suggests ESPP; say so in `status`/`details` if unclear.

## 6. Anything else

Best effort: pick the closest `type` (`brokerage`, `ira`, `cash`, `savings_child`, `other`) or benefit `category`, fill what's printed, and add `details.extractionNote` plus `details.confidence: "high"|"medium"|"low"`. Tell the user what you were unsure about.

## 7. Hebrew glossary

| Hebrew | English |
|---|---|
| דו"ח תקופתי / ריכוז תוכניות / דו"ח תוכניות | periodic report / consolidated plans / plans report |
| סך התיק / סה"כ חיסכון / סך צבירה / סך חיסכון | total portfolio / total savings / accumulated balance |
| יתרת כספים לסוף שנה קודמת | balance at end of previous year |
| ערך פדיון / ערך מסולק | surrender value / paid-up (frozen) value |
| קרן פנסיה (מקיפה / כללית / משלימה) | pension fund (comprehensive / general / complementary) |
| ביטוח מנהלים / ביטוח חיים וחיסכון / חיים משולב חיסכון | manager's insurance (life insurance with savings) |
| חיסכון טהור | savings-only policy (no risk cover) |
| סיכון טהור / ריסק | pure risk / term life |
| קרן השתלמות | study fund (hishtalmut) |
| קופת גמל / גמל להשקעה | provident fund / investment provident fund |
| חיסכון לכל ילד | savings for every child (state child savings) |
| חברה מנהלת / יצרן | managing company / provider |
| מספר פוליסה / מספר חשבון | policy / account number |
| ת.ז / ת"ז / מספר זהות | national ID — **never output** |
| סטטוס: פעיל / לא פעיל / מסולקת / מוקפאת | active / inactive / paid-up / frozen |
| מעמד: שכיר / עצמאי | salaried employee / self-employed |
| מעסיק | employer |
| הפקדה אחרונה / הפקדות השנה | last deposit / deposits this year |
| ניוד / העברה | transfer between funds |
| שכר מבוטח / שכר קובע / שכר מדווח | insured / determining / reported salary |
| תגמולים עובד / תגמולים מעביד / פיצויים / תגמולים 47 | employee / employer contributions / severance / self-employed (§47) |
| דמי ניהול מהפקדה / מצבירה | management fee on deposits / on balance |
| מסלול השקעה / מס' מסלול באוצר | investment track / Treasury track number |
| מניות / כללי / ספיר / לבני 50 ומטה / עוקב מדדים / תלוי גיל | equities / general / Sapir (Clal general) / age ≤50 / index-tracking / age-based |
| תשואה חודשית / מתחילת שנה / 12 חודשים / ממוצעת 3/5 שנים | monthly / YTD / 12-month / 3- or 5-year average return |
| נכונות / ת. נכונות / נתונים נכונים ל- | as of / as-of date |
| ת. הצטרפות | join date |
| תאריך נזילות | liquidity date |
| תיקון 190 | Amendment 190 (capital track, tax-advantaged lump sum after 60) |
| מקדם המרה / מקדם חלוקה לקצבה / מקדם מובטח | annuity conversion factor / guaranteed factor |
| קצבה משלמת / קצבה לא משלמת / הוני | annuity-paying / annuity-only provident / lump-sum money |
| קצבה צפויה (ללא הפקדות) | projected pension (without further deposits) |
| פנסיית נכות / שארים / אלמן/ה / יתום / הורה | disability pension / survivors / widow(er) / orphan / parent |
| אובדן כושר עבודה (אכ"ע) | loss of work capacity (disability income) |
| סכום ביטוח למקרה מוות / עלות כיסוי | death sum insured / cover cost |
| שחרור מתשלום פרמיה / פרנצ'יזה | premium waiver / waiting period |
| ביטוח בריאות / סיעודי / תאונות אישיות / חיים משכנתא | health / long-term care / personal accident / mortgage life |
| קיים / לא קיים / לא דווח / אין נתון | exists / doesn't exist / not reported / no data |
| הלוואה / הון משועבד | loan / pledged capital |

## 8. Domain primer (just enough to extract correctly)

- **Pension fund (קרן פנסיה):** mandatory retirement vehicle; comprehensive (מקיפה) includes disability + survivors cover, complementary (משלימה/כללית) has none. Annuity only. Typical fees 0–1.5% deposits, 0.1–0.25% balance (caps 6% / 0.5%).
- **Manager's insurance (ביטוח מנהלים):** insurance-company policy, may mix savings and risk. Fees up to 4% / 1.05%. Key field: conversion factor (lower = higher pension); pre-2013 policies may guarantee it.
- **Hishtalmut:** liquid 6 years after first deposit (3 for training/retirement); employee 2.5% + employer 7.5% up to a ceiling. Already-liquid funds matter for the advisor, so capture `liquidityDate`.
- **Gemel:** post-2008 money is annuity-only; liquidity date ≈ retirement age. **Gemel l'hashkaa:** liquid any time.
- **Employee contributions by law:** ≥ 6% employee + 6.5% employer + 6–8.33% severance of insured salary (18.5–20.83%). Use this only to sanity-check, never to fill columns.
- **US:** 401(k) employee deferral + employer match; HSA pairs with an HDHP; LTD benefit is usually a monthly max; RSU unvested value is not net worth.
