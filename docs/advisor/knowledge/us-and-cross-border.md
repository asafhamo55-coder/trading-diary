# US and Cross-Border (US–Israel) Planning Knowledge Base

Household-specific notes live in private-data/advisor/ (gitignored).

**Typical household this is written for:** an Israeli-origin couple living in the US with children, one spouse employed by the US subsidiary of an Israeli company with US-listed shares (RSUs, possibly an ESPP). They own US rentals and a trading account, and hold substantial Israeli pension, manager's insurance (bituach menahalim) and Keren Hishtalmut accounts.

**How to read this file.** Every figure carries a source tag [S#], listed under "Sources" at the end. Items marked **UNVERIFIED** or **CONFLICT** must not be stated to the user as fact. Where an answer depends on the household's US status, **[GC]** means green-card holder (lawful permanent resident) and **[USC]** means US citizen. Today is 2026-11-21. Tax year 2026 is still open, and the 2027 figures have been published.

---

## 0. Inferences to draw from benefit and pay facts (check with the user)

Worked example with synthetic figures; the real household's inferences live in the private notes.

- **Salary from life cover.** Basic group life is often a multiple of salary, so a 2× policy of $600K implies a base salary of about **$300K**. Confirm it.
  - A salary at that level puts FICA wages above the Roth catch-up threshold ($150K for 2026, $155K for 2027) [S2][S3].
  - It also makes the employee a highly compensated employee (HCE) for 401(k) testing: the HCE threshold is $160K for 2026 and $170K for 2027 [S3].
- **401(k) contributions vs the limit.** Multiply the monthly deferral by 12 and compare it with the **$24,500** 2026 deferral limit (no catch-up before 50) [S1]. If it exceeds the limit, possible explanations:
  - part of it is after-tax money (which would mean a mega-backdoor path already exists);
  - the plan stops deferrals at the cap (and the match may stop with them, unless the plan has a "true-up");
  - the reported figure is approximate.
  - **Ask for a pay stub or the plan provider's contribution breakdown.**
- **After-tax room.** Employee deferral plus employer match, against the §415(c) total limit of **$72,000 (2026)** [S3]. For example, $24.5K deferral + $12K match = $36.5K leaves about **$35.5K of room** for after-tax contributions, if the plan allows them.
- **HSA headroom.** Compare total HSA funding (employee + employer) with the 2026 limit of **$8,750 for family coverage** or $4,400 for self-only [S7].
- **Share-sale price.** Divide sale proceeds by shares sold to get a per-share price for 1099-B basis checks (§2.1).

---

## 1. US retirement accounts

### 1.1 Limits: 2026 vs 2027

| Item | 2026 | 2027 | Src |
|---|---|---|---|
| 401(k)/403(b)/457/TSP elective deferral | $24,500 | $25,500 | S1, S2, S3 |
| Catch-up, age 50+ | $8,000 | $8,500 | S1, S3 |
| "Super" catch-up, ages 60–63 (SECURE 2.0) | $11,250 | $11,750 | S1, S3 |
| §415(c) total annual additions (employee + employer + after-tax) | $72,000 | $75,000 | S3 |
| §401(a)(17) compensation limit | $360,000 | $375,000 | S3 |
| HCE threshold (§414(q)) | $160,000 | $170,000 | S3 |
| Roth-catch-up FICA-wage threshold (prior-year wages, §414(v)(7)) | $150,000 (tested on 2025 wages) | $155,000 (tested on 2026 wages) | S1, S3 |
| IRA / Roth IRA contribution | $7,500 | $7,500 | S1, S2 |
| IRA catch-up, 50+ | $1,100 | $1,100 | S1, S2 |
| Roth IRA phase-out, MFJ | $242K–$252K | $250K–$260K | S1, S2 |
| Roth IRA phase-out, single/HoH | $153K–$168K | $158K–$173K | S1, S2 |
| Traditional IRA deduction phase-out, MFJ, contributor covered by a workplace plan | $129K–$149K | $133K–$153K | S1, S2 |
| Traditional IRA deduction phase-out, MFJ, contributor not covered but spouse covered | $242K–$252K | $250K–$260K | S1, S2 |
| Social Security wage base | $184,500 | $192,300 | S41 (secondary) |

**Age timing (example: someone aged 49 in 2026).**

- They turn 50 in **2027**, so the age-50 catch-up first applies in **2027**: the deferral limit becomes $25,500 + $8,500 = **$34,000** [S2].
- They are 60–63 in **2037–2040**. That is when the super catch-up window applies; the amount is indexed.
- They reach the HSA catch-up age of 55 in **2032**.

### 1.2 Mandatory Roth catch-up for high earners (SECURE 2.0 §603)

- **The rule.** If an employee's prior-year FICA wages from the plan sponsor exceed the threshold, his age-50+ catch-up contributions must be designated Roth [S1][S3].
- **Timing.**
  - The final regulations were issued on 2025-09-15 (IR-2025-91). They generally apply from **2027-01-01**.
  - For **2026**, plans must apply a reasonable, good-faith interpretation; the statutory requirement itself is in effect for 2026 [S5].
- **Plans without a Roth option.** If the plan has no Roth feature, affected high earners **cannot make catch-ups at all** [S5] (EY summary).
- **Example.** Someone aged 49 in 2026 has no catch-up in 2026. In **2027**, if their 2026 FICA wages from the employer exceed $155K (likely for high earners, since salary plus RSU vest income are both FICA wages), the $8,500 catch-up **must be Roth**.
  - **Action:** confirm the employer plan offers Roth deferrals.
  - The base $25,500 can still be pre-tax or Roth, as they choose.

### 1.3 Mega-backdoor Roth (after-tax contributions plus in-plan conversion)

- **How it works.** After-tax (non-Roth) contributions fill the gap between employee deferrals plus match and the §415(c) cap. They are then converted promptly to Roth, either by an in-plan Roth conversion or by an in-service distribution to a Roth IRA, so that little taxable growth builds up.
- **How common it is.**
  - Vanguard *How America Saves 2026* reports **24% of plans offered after-tax contributions in 2025**, and only **10% of eligible participants used them** [S8].
  - Vanguard industry benchmarks show about **36% of plans offering in-plan Roth conversions** (as of 2025-12-31) [S8]. **UNVERIFIED** against the main report.
  - Conclusion: this is available in a minority of plans and cannot be assumed.
- **How to verify for the employer plan.**
  1. Read the Summary Plan Description, or the plan provider portal's list of "contribution sources". Look for "after-tax" as a source separate from "Roth".
  2. Ask HR or the plan provider whether the plan allows (a) in-plan Roth conversion of after-tax money, or (b) in-service withdrawal of after-tax sub-accounts. Ask how often and whether conversion can be automatic.
  3. **HCE trap.** After-tax contributions are subject to the ACP nondiscrimination test. If rank-and-file participation is low, HCEs may get refunds after year-end. Ask whether the plan is a safe harbor plan and whether it has failed ACP before.
- **Potential size.** $72,000 − deferrals − match in 2026 (see §0). In 2027 the room is $75,000 − $25,500 − match. The catch-up does **not** count toward §415(c).

### 1.4 IRA, Roth IRA and backdoor Roth

- **Direct Roth IRA.** For a high earner with RSU and rental income on top of salary, MFJ MAGI likely exceeds $252K in 2026 and $260K in 2027 [S1][S2], so direct Roth IRA contributions are probably barred.
- **Backdoor Roth.** Make a non-deductible traditional IRA contribution ($7,500 each; $8,600 each from 2027 once 50), convert it to Roth, and report on Form 8606.
  - **Pro-rata rule:** the conversion is taxed in proportion to all pre-tax money in **all** traditional, SEP and SIMPLE IRAs held on **December 31** of the conversion year.
  - 401(k) balances do **not** count. **Israeli pension and hishtalmut accounts are not IRAs and do not count.**
  - If either spouse has an old rollover IRA, roll it into the current employer 401(k) first, if the plan accepts roll-ins.
  - This is a stable statutory rule (IRC §408(d)(2)); the IRS Form 8606 instructions were not re-fetched.
- **Spousal IRA.** A non-working or lower-earning spouse can contribute on the other spouse's earned income if they file jointly.
- **Treaty and foreign nuance.** Roth tax-free status is **not** clearly recognized by Israel after any 10-year exemption ends (§6.6). This weighs against piling into Roth if they will retire in Israel after that window. **CONFLICT/UNSETTLED.**

### 1.5 HSA

| | 2026 | 2027 | Src |
|---|---|---|---|
| Self-only limit | $4,400 | $4,500 | S6, S7 |
| Family limit | $8,750 | $9,000 | S6, S7 |
| Catch-up, age 55+ (statutory, not indexed) | $1,000 | $1,000 | S6, S7 |
| HDHP minimum deductible (self/family) | (not re-verified) | $1,750 / $3,500 | S6 |
| HDHP out-of-pocket maximum (self/family) | (not re-verified) | $8,700 / $17,400 | S6 |

- **Employer money counts.** Employer HSA contributions count toward the limit.
- **Payroll vs direct.** Contributing through payroll (cafeteria plan) also avoids FICA. Direct contributions do not.
- **The HSA as a stealth retirement account.**
  - It is triple tax-advantaged: deductible in, tax-free growth, tax-free out for qualified medical costs.
  - Medical bills can be paid out of pocket now, receipts kept, and reimbursed tax-free decades later.
  - After 65, non-medical withdrawals are taxed like a traditional IRA, with no penalty.
  - Invest the balance; don't leave it in cash.
- **State tax.** Some states do not follow the federal HSA exclusion. California and New Jersey are the well-known examples (not re-verified here), so this depends on their state.
- **Exit tax.** An HSA is a "specified tax deferred account" for exit-tax purposes and would be deemed distributed on expatriation if they were covered expatriates [S19].
- **Interaction with supplemental policies.** Hospital-indemnity, accident and critical-illness policies are generally "permitted insurance" or excepted benefits that do not break HSA eligibility. This is the stable rule under IRC §223(c)(3) and was not re-fetched.

### 1.6 Asset allocation, glidepath and costs (late 40s)

- **Horizon.** For someone aged 49, retirement at 65 is about 16 years away. Assets will need to fund about 30 years after that.
- **Glidepath benchmark.** The Vanguard Target Retirement 2045 fact sheet (June 2025) shows about **81% stocks/19% bonds at 20 years to retirement** and **66/34 at 10 years** [S9]. Interpolated to about 16 years to retirement, that is roughly **75/25**. The interpolation is our estimate.
- **Household-level allocation must include everything:**
  - the Israeli pension, manager's insurance and hishtalmut (typically in default age-based tracks; ask for each track's equity share);
  - home equity and the rentals (real estate, often leveraged);
  - employer stock (single-stock equity).
  - Because the rentals already provide a large, leveraged real-estate exposure, the liquid portfolio can lean more toward diversified global equity and high-quality bonds.
  - Avoid adding REITs on top of the rentals.
- **Target-date funds.**
  - Fine as a **single** holding inside the 401(k).
  - Do not mix a target-date fund with other funds; that defeats its glidepath.
  - Check whether the employer plan's target-date fund is an index series (low cost) or an active one.
- **Expense-ratio benchmarks.**
  - Morningstar 2026 US Fund Fee Study: the asset-weighted average across all US funds was **0.32% in 2025**.
  - Active US equity funds averaged 0.58% asset-weighted.
  - Passive or traditional-index funds were about **0.09–0.10%** [S10]; the exact passive figure is **CONFLICT** between excerpts.
  - **Rule:** for core index exposure, aim for 0.10% or less. Anything above 0.50% for passive-like exposure deserves scrutiny.
  - Israeli pension management fees are charged both on deposits and on the accumulated balance. Read the "dmei nihul" lines on the annual report and negotiate. Regulatory caps are **UNVERIFIED** here.

---

## 2. Equity compensation (employer stock)

### 2.1 RSUs

- **Taxation.**
  - At vest, the fair market value is **ordinary wage income**, subject to income tax plus FICA and Medicare.
  - The basis equals the value at vest.
  - Later gain or loss is capital: short-term if held 1 year or less, long-term if more.
  - This is stable law (IRC §83, and IRS Topic 427 for statutory stock options); not re-fetched.
- **Withholding.** Supplemental wages are withheld at a flat **22%** (the optional rate) up to $1M of supplemental wages per year, and **37% mandatory** above $1M. This is from IRS Pub. 15 and is stable; the rates were made permanent by OBBBA. Not re-fetched.
- **The under-withholding trap.**
  - 2026 MFJ brackets: 24% applies above $211,400 of taxable income, **32% above $403,550**, and 35% above $512,450 [S11].
  - For 2027: 24% above $218,250, 32% above $416,650, and 35% above $529,100 [S12].
  - For a high salary plus RSUs plus rental and trading income, the marginal rate is likely 24–32% plus state tax. Withholding at 22% leaves a gap of **2–10 points plus state tax** on every vest.
  - **Fixes:** raise W-4 withholding, make quarterly estimates, or sell extra shares at vest.
  - **Penalty safe harbor:** pay 110% of the prior-year tax if AGI is over $150K (IRC §6654; stable, not re-fetched).
- **After any RSU sale,** check the 1099-B basis. Brokers often report the RSU basis as $0 or leave it blank, and using that figure means **double taxation**. Fix it on Form 8949 with code B and the vest-date FMV.

### 2.2 ESPP (if the employer's is a §423 plan; **ask**)

- **Qualifying disposition:** the sale is **more than 2 years after the offering (grant) date and more than 1 year after purchase**.
  - Ordinary income = the lesser of (a) the actual gain or (b) the discount measured at the offering date.
  - The rest is long-term capital gain.
- **Disqualifying disposition:** ordinary income = the full spread at purchase (FMV at purchase minus price paid); any further gain is capital.
- These rules come from IRC §421–423 and IRS Topic 427; stable, not re-fetched.
- **Practical point.** The guaranteed discount (typically 15%) is the value. Holding for a qualifying disposition only shifts part of the discount from ordinary to capital treatment, at the cost of concentration risk. Many planners **sell immediately** (a disqualifying disposition) to lock in the discount. Watch the 1099-B basis trap here too.

### 2.3 Concentration risk

- **Heuristic:** keep any single stock below **5–10% of net worth**. This is a common planner rule of thumb, **not from an authoritative source**.
- **Correlated exposure.** Employer stock, the employee's salary and bonus, and an Israel-linked economy (through the Israeli pension accounts) are correlated. A downturn at the employer can hit the job and the portfolio together.
- **Approach:**
  - Sell RSUs at vest by default; at vest, selling costs nothing extra in tax.
  - Diversify into broad index ETFs.
  - For legacy low-basis lots, use tax-lot selection or gifting to charity (donating appreciated shares).

### 2.4 Israeli company, US-listed ADS: PFIC and withholding

- **PFIC.**
  - A foreign corporation is a PFIC if 75% or more of its gross income is passive, or 50% or more of its assets produce passive income.
  - A large Israeli operating company (for example, a software company) would not normally meet these tests. **UNVERIFIED** for any specific company: check its annual report (20-F) PFIC statement. An advisor should cite the 20-F's "PFIC" risk-factor or tax section.
  - Holding such shares therefore does **not** normally require Form 8621.
  - The real PFIC risk for these households is **Israeli mutual funds and ETFs** (קרנות נאמנות) and possibly pooled Israeli savings products (§6.2), not the employer's operating-company shares.
- **Dividends.** Check the company's dividend history [S37] (aggregator data is **not confirmed** until checked with investor relations). If it pays no cash dividend, Israeli dividend withholding is moot. If it pays (or resumes paying):
  - the treaty caps Israeli withholding on dividends to a US resident at **25%** (12.5% for qualifying corporations) [S13, Art. 12];
  - the US foreign tax credit offsets the Israeli withholding;
  - the US 15% qualified-dividend rate is below the 25% treaty cap, so excess credit may go unused.
- **Who is taxed.** For a US resident employed by the US subsidiary, RSU income is US wages.
  - If the employee lived or worked in Israel during a vesting period, some of the RSU income could be Israeli-source (sourcing by workdays). **Ask.**

---

## 3. Insurance

### 3.1 Life insurance

- **Needs-based method** (preferred to multiples of income). Need = PV(income replacement until the youngest is independent plus a spouse bridge) + debts (mortgages on the home, and optionally the rentals) + remaining education costs + final expenses − existing liquid assets − existing coverage.
  - Dependency runs until the youngest child is independent (e.g. a youngest child of 12 means about 10–13 years).
  - The rentals produce income but also carry debt and management burden; decide whether the survivor would keep them.
- **Existing coverage.**
  - Group basic life, commonly 1–2× salary.
  - Group term coverage above $50K creates **imputed income** under §79 (IRS Pub 15-B; stable, not re-fetched).
- **Group vs individual term.**
  - Group life ends when employment ends. Conversion or portability options are typically priced higher, and the age-50+ group rates step up with age.
  - **Individual level-term** coverage (15–20 years, laddered to the kids' independence and mortgage payoff) locks in pricing while they are healthy. It survives job changes and a move back to Israel; check the policy's foreign-residence clause.
- **The lower-earning spouse.** Insure them too, because their death adds childcare and household costs.
- **Estate tax.** At current exemptions ($15M per person in 2026 [S11]), it is not a driver unless the non-citizen-spouse rule applies (§6.5). In that case, an ILIT can keep proceeds out of the estate.

### 3.2 Disability (LTD and STD)

- **Group LTD** commonly pays 60% of salary up to a monthly cap (e.g. $10K/month).
- **Taxability.** If the **employer pays the premium** (or the employee pays it pre-tax), the **benefits are taxable**. If the employee pays with after-tax dollars, benefits are tax-free. IRS Pub 525 (2025): sick pay "from an insurance company if your employer paid for the plan" is included in income; "if you paid the premiums… the benefits you receive under the policy aren't taxable" [S33].
- **Example.** At a $300K salary the 60% benefit would be $15K/month, so a **$10K cap binds** (40% of pay). If benefits are taxable, roughly 30% of gross pay is replaced after tax.
- **Fixes.**
  - Ask whether the employer offers **buy-up LTD** or the option to pay the LTD premium after-tax or impute it as income. That makes benefits tax-free.
  - Consider an **individual own-occupation policy** to cover the gap above the cap. It is portable, and its benefits are tax-free if paid with after-tax money.
  - Check the group definition of disability ("own occupation" for 24 months, then "any occupation" is typical), offsets for Social Security disability benefits, and mental-health limits.

### 3.3 Supplemental accident, hospital-indemnity and critical-illness policies

- **Value evidence.**
  - Fixed-indemnity and specified-disease products historically return a low share of premiums. A GAO study found five-year average loss ratios of **53% (hospital indemnity) and 58% (specified disease)**, with many below a 45% benchmark [S32 – GAO 1988, dated].
  - Industry guidance treats **50–55% minimum loss ratios** as generally acceptable; a few states require 75–80% for some group products [S32 – SOA 2019].
  - No current consumer-value study was found. **UNVERIFIED for 2026.**
- **Rule of thumb.** These policies mostly duplicate what a funded emergency fund and HSA already cover. The 2027 family out-of-pocket maximum is $17,400 [S6], which is the worst-case annual medical exposure.
  - For a household with these assets, they are usually **poor value**.
  - Keep them only if the HSA plus emergency fund cannot cover the out-of-pocket maximum, or if a specific risk (such as family cancer history) is priced attractively.
  - Voluntary AD&D duplicates life insurance, since it pays only on accidental death. Proper term life is better value.

### 3.4 Umbrella liability (landlords)

- **Need.** Landlords with several rentals plus a teenage driver should carry an umbrella policy. Common guidance is to cover at least net worth.
- **Cost.** About **$150–$300/yr for the first $1M** (attributed to the Insurance Information Institute, via secondary sources) plus about $50–$75 per extra $1M. Landlord-specific quotes run higher, from about $250–$550 to several thousand with many doors [S38]. These are secondary sources and the ranges conflict.
- **Gotchas.**
  - Many **personal** umbrellas **exclude properties held in an LLC**. You then need a commercial umbrella or a carrier that endorses LLC-held rentals.
  - The underlying auto and landlord policies must carry the required liability minimums.
  - List every property on the policy.

---

## 4. Rental real estate

- **Depreciation.**
  - Residential rental buildings (not land) are depreciated straight-line over **27.5 years**, using the mid-month convention (IRS Pub 527; stable, not re-fetched).
  - On sale, depreciation taken (or allowable) is recaptured as unrecaptured §1250 gain, taxed at up to **25%**.
- **Cost segregation and bonus depreciation.**
  - Under **OBBBA**, 100% bonus depreciation is **permanent** for property **acquired and placed in service after 2025-01-19**. Property under a written binding contract from before 2025-01-20 gets the phase-down rate (40% for 2025) [S34].
  - A cost-segregation study reclassifies parts of a residential rental (appliances, carpet, land improvements, some electrical and plumbing) into 5-, 7- and 15-year property eligible for bonus depreciation.
  - Typically worthwhile only for larger or recent purchases (fee vs benefit), and **only if the losses can be used** (see passive rules below).
  - Look-back studies for older properties use Form 3115 (method change). Not verified here.
- **Passive-activity rules** (IRS Pub 925; statutory, not indexed; not re-fetched).
  - Rental losses are passive. Under the **$25,000 special allowance** for "active participation", the allowance phases out by 50% of MAGI above **$100,000** and is gone at **$150,000** (MFJ).
  - At MAGI above $150K, **rental losses are likely suspended**. They carry forward and are released when the property is sold in a fully taxable sale.
  - **Exceptions to ask about:**
    1. **Real estate professional status.** One spouse spends more than 750 hours per year in real-property trades AND more than half of personal service time there, and materially participates. A spouse could qualify **if they do not have a full-time job elsewhere**. Requires contemporaneous time logs.
    2. **Short-term rentals.** If the average stay is 7 days or less, the property is not a "rental activity"; with material participation, losses are non-passive.
- **1031 like-kind exchange.**
  - Since the TCJA, exchanges are limited to real property.
  - Identify the replacement within **45 days** and close within **180 days**, using a qualified intermediary.
  - Gain and depreciation recapture are deferred.
  - These rules are stable (IRS like-kind exchange page; not re-fetched).
  - **Key strategic point:** carrying over the basis until death gets a **step-up in basis** (§1014), which erases the deferred gain for heirs. The cross-border caveat is §6.5: for non-US-domiciled decedents, US-situs real estate above $60K is exposed to US estate tax.
- **Holding in an LLC.**
  - **Benefit:** it can wall off liability between properties (one LLC per property, or a series LLC where the state allows it).
  - **Costs:** state LLC fees (for example, California's $800 minimum franchise tax, from general knowledge, **UNVERIFIED**); possible mortgage **due-on-sale** clause issues when transferring a financed property (lender consent); title-insurance continuity; and personal-umbrella exclusions (§3.4).
  - A single-member or spousal LLC is typically disregarded for income tax (Schedule E is unchanged).
  - **Bottom line:** adequate insurance (landlord policy plus umbrella) is the first line of defense. An LLC is a second layer and worth it mainly in litigious states or with higher-risk properties.
- **SALT.** Under OBBBA, the 2026 state-and-local-tax deduction cap is **$40,400**. It phases down by 30% of MAGI above **$505,000** but not below $10,000. For 2027: $40,804 cap and a $510,050 threshold. It reverts to $10,000 in 2030 [S35] (secondary sources; **verify** against the Schedule A instructions). Property taxes on rentals are deducted on Schedule E and are **not** subject to this cap; the cap affects the home's property tax and state income tax.
- **Paying down the mortgage vs investing.** Compare the **after-tax mortgage rate** with the expected after-tax portfolio return, adjusted for risk.
  - Rental mortgage interest is deductible on Schedule E (useful even when passive losses are suspended, because it reduces net rental income). Home mortgage interest is deductible only if they itemize (the 2026 MFJ standard deduction is $32,200 [S11]; 2027 is $33,200 [S12]).
  - Rate of 4% or less, fixed: investing usually wins, and prepaying is low priority.
  - Rate of 6.5% or more: prepaying is a guaranteed return comparable to high-grade bonds and reasonable for the bond portion.
  - **Liquidity:** home equity is illiquid; keep the emergency fund intact first.
  - **Before a move back to Israel:** decide whether to keep the rentals and manage them from abroad (a property manager, a US LLC, and US non-resident filing on Form 1040-NR if they lose US tax residency) or sell them. Selling while still a US resident lets them use the US capital-gains rates and 1031 planning.

---

## 5. Education

### 5.1 529 plans

- **State deduction.** This is **parameterized by state of residence**: some states give no deduction, some deduct only contributions to the in-state plan, and some allow any plan.
  - Placeholder: `STATE_529_DEDUCTION = {state, cap_per_beneficiary_or_return, in_state_plan_only, recapture_on_nonqualified_or_roth_rollover}`.
- **OBBBA changes from 2026.** The K-12 tuition cap doubles to **$20,000 per beneficiary per year**, and K-12 qualifying expenses widen (curriculum, tutoring, testing fees). Postsecondary credentialing costs now qualify [S26] (secondary sources). States may not conform.
- **529-to-Roth IRA rollover (SECURE 2.0)** [S25] (secondary sources; the IRS has issued only partial guidance):
  - **$35,000 lifetime per beneficiary**; not indexed.
  - Each year is capped at the beneficiary's annual IRA limit ($7,500 in 2026), less any other IRA contributions. Most sources also require the beneficiary to have earned income at least equal to the amount.
  - The account must be open **at least 15 years**. Contributions made in the last **5 years**, and their earnings, are not eligible.
  - It must be a direct trustee-to-trustee transfer into the **beneficiary's** Roth IRA. The Roth income limits do not apply.
  - **Open question:** whether changing the beneficiary restarts the 15-year clock (the IRS has not addressed this).
  - **Implication:** a 529 opened in 2026 cannot roll to Roth until 2041 or later. That is relevant mainly for a young child's leftover funds, or as a "grandchild" account.
- **Israeli universities.** A 529 can pay for any "eligible educational institution", meaning one eligible to take part in US Department of Education federal student-aid programs, including foreign schools (IRS Pub 970; stable definition, not re-fetched).
  - **Tel Aviv University:** federal school code **G08373** (OPE-ID 008373-00), per TAU's international office [S20].
  - **Hebrew University:** code **G04012**. Only **specific programs** are Title IV-eligible; HUJ says other programs are **not** eligible [S21].
  - **Technion:** the Department of Education Program Participation Agreement shows **provisional** approval with an **expiration date of 2026-09-30** (reapply by 2026-06-30) [S22]. Its current status is **UNVERIFIED**; check the live Federal School Code Search before paying.
  - **Reichman University:** publishes Title IV consumer information for 2025-26 [S23]. Code not verified.
  - **Rule:** before each 529 withdrawal, confirm the school **and the program** appear in the current Federal School Code list (updated quarterly). Keep invoices. Convert ILS tuition at the payment-date rate.
- **American Opportunity Tax Credit.** It phases out at MFJ MAGI of $160K–$180K (statutory, from general knowledge; not re-fetched), so it is likely unavailable to high earners.

### 5.2 FAFSA and CSS Profile

- **FAFSA retirement assets.** The FAFSA does **not** count retirement-account balances (401(k), IRA, pensions) as assets [S27] (secondary sources). How the 2027-28 FAFSA treats untaxed retirement contributions and distributions as income is **UNVERIFIED**; check the 2027-28 FSA Handbook (Vol. 1/AVG).
- **FAFSA rental real estate.** **Investment real estate (the rentals) is a reportable asset on the FAFSA**, at net value (value minus debt). The primary home is excluded. This alone can push the Student Aid Index high.
- **Foreign assets and income.** How the FAFSA treats foreign assets and foreign income (FEIE) is **UNVERIFIED** for 2027-28. Whether Israeli pension and hishtalmut accounts count as "retirement" (excluded) or "investments" is **UNVERIFIED**. A keren hishtalmut is liquid after 6 years [S17], so it arguably looks like an investment, not a retirement account. Ask the school's aid office.
- **CSS Profile** (used by many private colleges) reaches further. It can count home equity, business and real-estate net value, assets in siblings' names, and 529s owned by anyone. Some schools ask for retirement balances, and it asks about foreign savings and untaxed foreign income [S27].
- **Reality check.** For households with a high salary, several rentals and substantial Israeli accounts, **need-based aid is unlikely** at most US schools. Plan around merit aid, in-state public tuition, or Israeli universities, which charge much lower tuition (amount **UNVERIFIED** here).
- **Eligibility.** The student must be a US citizen or eligible noncitizen (green card) for federal aid. **Ask about the children's status.**

### 5.3 Timing by child age

- **Child aged 18–20** (likely in or after IDF service, or starting university). See the decision table below.
  - Possible US enrollment as an Israeli-educated applicant. US in-state tuition may require **state residency and the parents' domicile**; long IDF service abroad can complicate this (rules vary by state).
  - Gap years from IDF service push college to about 21–22.
  - Any 529 money can wait; there is no age limit, and the beneficiary can be changed to a sibling.
  - If not in a US-eligible program: change the 529 beneficiary to a sibling, use it for a later graduate degree, or roll up to $35K to a Roth (if the 15-year rule is met).
- **Child about 2 years from college** (around 16). A 529 opened now gets little tax-free growth. Value comes mainly from the **state deduction** (if any) and from paying tuition through the account.
  - Front-load only what will be spent. Use a conservative (age-based or short-term) portfolio.
  - Trump account: eligible until 18 (§7).
- **Child about 6 years from college** (around 12). A 529 makes the most sense here.
  - Consider **5-year gift-tax averaging**: up to 5 × $19,000 = $95,000 per donor in 2026, or 5 × $20,000 = $100,000 per donor from 2027 [S11][S12].
  - Use the K-12 $20K/yr if private school tuition applies.

| Path for a child aged 18–20 | Best funding source |
|---|---|
| Title IV-eligible program at an Israeli university (TAU / eligible HUJ program / Technion if approval is current) | 529 (tax-free), or cash |
| Ineligible Israeli program (e.g., ineligible HUJ programs, some colleges) | Cash or taxable account. A 529 withdrawal would be non-qualified: earnings taxed plus a 10% penalty |
| US college | 529 plus cash, and merit aid. FAFSA likely gives a high Student Aid Index (rentals count) |

---

## 6. Cross-border US–Israel (most important)

### 6.1 The treaty: what it actually says

Source for this section: the US–Israel Income Tax Convention (1975), as amended by the 1980 and 1993 protocols [S13]. The text was read directly.

- **Saving clause (Art. 6(3)).** Each country may tax its **residents and citizens "as if this Convention had not come into effect."**
  - **Exceptions (Art. 6(4)):** Art. 10, 15-A, **21 (Social Security)**, 26 (relief from double tax), 27, 28, and Art. 20(2)–(3) (alimony, annuities, child support).
  - **Art. 20(1) (pensions) is *not* excepted.** So for a US resident (green card or citizen), the treaty does **not** stop the US taxing Israeli pension income or growth under domestic law.
- **Art. 20 — Private pensions and annuities.** Pensions "shall be taxable only in the Contracting State of which [the recipient] is a resident."
  - "Pensions" means **periodic payments** made by reason of retirement or death in consideration for past services (Art. 20(4)). Lump sums are not clearly covered.
  - **There is no article that defers US tax on accruals inside an Israeli plan for a US resident.** This is unlike, for example, the US–UK treaty. Practitioners agree that the US–Israel treaty "does not include a modern pension article" [S15][S16][search consensus].
- **Art. 21 — Social Security.** Social-security payments and public pensions paid by one country to a resident of the other are "exempt from tax in both Contracting States." Because Art. 21 is excepted from the saving clause, this applies **even to US citizens living in Israel** who receive US Social Security.
- **Art. 26.** This is the double-tax relief article. The foreign tax credit is the main tool for US residents and citizens.

### 6.2 How the US taxes the Israeli accounts

The IRS has issued **no specific guidance** on keren pensia, kupat gemel, bituach menahalim or Keren Hishtalmut. Practice is **divided**. The main positions:

| Account | Common US practitioner treatment | Risk notes |
|---|---|---|
| **Employer pension (keren pensia / bituach menahalim from Israeli employment)** | Often treated as a **foreign employer pension**, either a **§402(b) non-exempt employees' trust** or a pension "generally considered legitimate". Employer contributions may be taxable when vested, and growth taxed on distribution or annually depending on the analysis. Many preparers take a no-Form-8621 position for employer pensions [S15][S16] | Under §402(b) rules, HCE-type treatment can tax vested growth **annually**. PFIC Report calls employer pensions a "gray zone" and says Treas. Reg. §1.1298-1(c)(4) is **not** a blanket Israeli pension exemption [S16] |
| **Keren Hishtalmut (KH)** | **CONFLICT.** Positions: (a) treat like an employer pension, taxing only growth on withdrawal [S15]; (b) treat withdrawals as fully taxable [S17]; (c) treat it as a **foreign grantor trust** (Forms 3520/3520-A) whose underlying pooled Israeli funds are **PFICs** (Form 8621), with heightened risk for self-employed KH or pooled tracks [S16]. Several sources say the US taxes growth **annually**, with no treaty deferral [search consensus] | KH is liquid after **6 years** for any purpose [S17]. That weakens "retirement" characterization (see §6.3). Israel exempts the withdrawal; the US does not. A tax-free label in Israel does not control US treatment [S16] |
| **Kupat gemel l'hashkaa** (voluntary investment gemel) | Treated as an investment wrapper: **high PFIC risk**, no treaty protection [S16] | Avoid for US persons |
| **Bituach menahalim** (insurance-wrapped) | "Review": treatment follows the pension or insurance wrapper [S16]. Contracts with cash value are reportable on 8938 and FBAR [S18] | Possible §1035 or annuity analysis. **UNVERIFIED** |

**Practical stance for the advisor (do not present as settled law):**

1. These accounts **are** reportable on FBAR and Form 8938 (§6.4).
2. **How the household has filed in prior years matters most.** Ask for prior returns and how the Israeli accounts were handled. Inconsistent treatment, or accounts never reported, is a bigger risk than any single theory. Penalty relief options (streamlined procedures; Rev. Proc. 2020-17 for Form 3520 penalties) depend on facts.
3. Engage a **US–Israel cross-border CPA**. The choice among §402(b), grantor trust, and PFIC treatment changes annual tax and reporting materially on a large balance.
4. **Do not make new voluntary deposits** into Israeli gemel or hishtalmut products while they are US persons. **Do not buy Israeli mutual funds or ETFs** (PFICs) in Israeli or US accounts.

### 6.3 Reporting: Forms 3520/3520-A and Rev. Proc. 2020-17

- **Rev. Proc. 2020-17** (issued March 2020) [S14] exempts eligible individuals from **§6048 reporting only, meaning Forms 3520 and 3520-A**, for "applicable tax-favored foreign trusts". It also allows abatement of past §6677 penalties (via Form 843).
  - It does **not** affect income tax, **FBAR, Form 8938 or PFIC (8621)** obligations.
  - Eligibility requires the individual to be compliant with US income-tax filing, including reporting any income from the trust [S14 §5.02].
- **Tax-favored foreign retirement trust (§5.03) requirements:**
  1. It is tax-exempt or tax-favored locally (deductible or excluded contributions, or deferred or reduced tax on earnings).
  2. Annual information reporting goes to local tax authorities.
  3. Only contributions from earned personal-services income are allowed.
  4. Contributions are limited by a percentage of earned income, OR to **$50,000/yr or less**, OR a **$1,000,000 lifetime** limit or less.
  5. Withdrawals are conditioned on reaching **retirement age, disability or death**, or penalties apply to earlier withdrawals. Hardship, education, home purchase and in-service loan exceptions are tolerated.
  6. If employer-maintained, it is non-discriminatory.
- **Tax-favored non-retirement savings trust (§5.04)** (medical, disability or **educational** purpose): contributions of **$10,000/yr or less**, or **$200,000 lifetime** or less, with withdrawals conditioned on those purposes or penalized.
- **Application.**
  - **Israeli keren pensia** (mandatory employer pension, withdrawals tied to retirement age with tax penalties for early withdrawal) **likely meets §5.03**. This is our assessment, **not IRS guidance**.
  - **Keren Hishtalmut is doubtful under §5.03.** It is withdrawable for **any purpose after 6 years** with no penalty [S17], which arguably fails requirement (5).
  - As a "study fund", KH might fit §5.04 (educational) only if contributions were $10K/yr or less **and** withdrawals were conditioned on education. Post-6-year withdrawals are unrestricted, so this is also doubtful.
  - **Conclusion:** do **not** assume Rev. Proc. 2020-17 covers KH. **UNSETTLED.**
  - Separately, the statute (§6048(a)(3)(B)(ii)) excepts transfers to foreign compensatory trusts under §402(b), §404(a)(4) or §404A [S14 §3]. This supports "no 3520 for employer pension trusts" positions.
- **Form 3520 Part IV.** Gifts or bequests above **$100,000** in a year from nonresident alien individuals (for example, Israeli parents) must be reported. This is a statutory threshold (stable, not re-fetched). It is very relevant to Israeli families.

### 6.4 FBAR and Form 8938

- **FBAR (FinCEN 114).**
  - Required if the **aggregate** of all foreign financial accounts exceeds **$10,000 at any time** in the year [S18].
  - It includes Israeli bank and brokerage accounts, pension, hishtalmut and gemel accounts (practitioner consensus [S15][S17]), and foreign insurance or annuity contracts with cash value [S18].
  - Each spouse files for accounts they own or have signature authority over; a joint FBAR is possible in some cases.
  - Due April 15, with an automatic extension to October 15.
- **FBAR penalties.**
  - Non-willful: statutory $10,000, inflation-adjusted. Secondary sources cite **$16,536** for assessments after 2025-01-17. The **current FinCEN table was not verified** (eCFR blocked). Apply it **per report (per year), not per account**, under *Bittner v. United States* (2023).
  - Willful: the greater of the inflation-adjusted amount (secondary sources cite $165,353) or **50% of the account balance** [S18 for the base rule].
- **Form 8938 (FATCA).**
  - For **MFJ living in the US**, file if specified foreign financial assets exceed **$100,000 on the last day of the year or $150,000 at any time** [S18].
  - Pension, hishtalmut and cash-value insurance accounts generally count. Foreign-government social-security benefits (Bituach Leumi) do **not** [S18].
  - Penalty: **$10,000**, plus $10,000 per 30 days after IRS notice, up to **$60,000** [S18]. It also extends the statute of limitations.
- **With substantial balances abroad (above the $150K / $100K thresholds), both FBAR and 8938 apply every year**, along with whatever 3520/8621 position is taken.

### 6.5 Estate and gift tax: non-citizen spouse

- **Exemption.** The basic exclusion is **$15,000,000 per person in 2026** (OBBBA; up from $13,990,000 in 2025) [S11] and **$15,480,000 in 2027** [S12]. A "$13.99M" figure is the **2025** figure and is out of date.
- **Annual exclusions.** The annual gift exclusion is **$19,000 (2026)** and **$20,000 (2027)** [S11][S12]. Gifts to a **non-US-citizen spouse** are excluded up to **$194,000 (2026)** and **$201,000 (2027)** [S11][S12].
- **[USC] both spouses citizens:** the unlimited marital deduction applies, and portability of the deceased spouse's unused exclusion (DSUE) is available with a timely Form 706.
- **[GC] surviving spouse not a citizen:** **no unlimited marital deduction** unless the assets pass to a **Qualified Domestic Trust (QDOT)**, or the survivor becomes a citizen before the estate return is filed (IRC §2056(d), §2056A; stable, not re-fetched).
  - With about $15M of exemption per spouse, for a household net worth well below that, a QDOT is usually **not needed today**. It becomes relevant only if net worth approaches the exemption or Congress cuts the exemption.
  - **Still:** title assets deliberately, review beneficiary designations, and consider simple QDOT-enabling language in wills.
- **Domicile matters.** US-domiciled green-card holders get the full exclusion. If they later move to Israel and give up US domicile (and are not citizens), **US-situs assets** above **$60,000** (US real estate, US stocks and ETFs, possibly the 401(k)) face US estate tax with only about a $13K credit (§2102(b), statutory; not re-fetched).
  - This is a **major issue for the US rentals after a move back**. Possible mitigations include treaty analysis (the US–Israel income tax treaty has no estate article; there is **no US–Israel estate tax treaty**, from general knowledge, **UNVERIFIED**), holding structures, and life insurance.
- **Israel** currently has **no inheritance or estate tax** (general knowledge, **UNVERIFIED** here).

### 6.6 Moving back to Israel

**A. Expatriation / exit tax (IRC §877A)** [S19][S11][S12]

- **Who it applies to.** A **[USC]** who renounces, or a **[GC] long-term resident (LTR)**: someone who was a lawful permanent resident in **at least 8 of the last 15 tax years** and gives up the green card (or claims treaty-resident status). Years treated as a treaty-country resident don't count unless treaty benefits were waived.
- **Covered expatriate tests.** A person is covered if ANY one applies:
  1. average annual net income tax over the prior 5 years **exceeds $211,000** for 2026 expatriations, or **$218,000** for 2027;
  2. **net worth of $2M or more** on the expatriation date (not indexed);
  3. failure to certify 5 years of US tax compliance on Form 8854.
- **Net worth is tested per person.** Israeli accounts, a 401(k), rentals, home equity, a brokerage account and employer shares can together put **each spouse near or above $2M**. Test 3 is a trap if the Israeli accounts were misreported.
- **Consequences for a covered expatriate.**
  - Mark-to-market tax on worldwide assets, as if sold the day before expatriation, with an exclusion of **$910,000 (2026)** or **$940,000 (2027)** of gain.
  - **Specified tax-deferred accounts (IRA, Roth IRA with exceptions, 529, HSA)** are treated as **fully distributed** the day before.
  - **401(k): an "eligible deferred compensation item"** if the payor is a US person and the expatriate files **Form W-8CE** and waives treaty reductions. Then no immediate tax; instead withholding applies on later distributions. §877A(d) sets **30%** withholding; this rate comes from the statute and was not stated in the instructions excerpt. Otherwise the 401(k) is "ineligible" and its **present value is taxed immediately**.
  - Gifts or bequests from a covered expatriate to US persons later face §2801 tax.
- **Simply moving without formally abandoning the green card** keeps a [GC] holder a US tax resident: worldwide taxation continues. A [USC] remains taxable wherever he or she lives (with foreign tax credit and FEIE relief; the FEIE is $132,900 in 2026 and $137,300 in 2027 [S11][S12]).

**B. US 401(k) and IRA after moving.**

- **[USC]:** the US taxes distributions fully (the saving clause applies). Israel may also tax them after any exemption period. Relief is through the foreign tax credit.
- **[GC] who has become a non-resident, non-covered:** distributions are US-source. Treaty Art. 20 says *periodic* pensions are taxable **only in the residence state (Israel)**. One practitioner says a non-citizen Israeli resident can exempt 401(k) distributions from US tax if taken **over at least 3 years** (a Form 1040-NR treaty position) [S29] (single practitioner source; **UNVERIFIED**). Lump sums likely face 30% US withholding.
- **10% early-withdrawal penalty** before 59½ applies regardless.

**C. Israeli taxation for returning residents** [S28][S29]

- **Status categories.** Israel's **10-year exemption on foreign-source income** (including, per practitioners, **foreign pensions such as 401(k)/IRA distributions**) applies to **olim** and to **"veteran returning residents" (toshav chozer vatik)**, meaning people who were abroad **10 or more consecutive years**.
  - **Ask the user when they left Israel.** If less than 10 years ago, they are ordinary "returning residents" with narrower benefits; the exact rules are **UNVERIFIED** here.
- **Reporting.** For people who become Israeli residents **on or after 2026-01-01**, the **reporting exemption has been cancelled**. They must report foreign income and assets to the Israel Tax Authority even if the income is exempt [S28].
- **2026 incentive.** Israeli-source **earned** income can be tax-free (Herzog: up to ₪600K in 2026) for people who became first-time residents between 2025-11-05 and 2026-12-31 [S28]. Practically **expired** for anyone not returning by 2026-12-31. **CONFLICT** on the cap: Times of Israel describes 0% for 2026–2027.
- **After year 10.** Israel generally taxes US pension distributions, with credit for US tax. **CONFLICT** among sources on the mechanics. Israel's view of **Roth** tax-free status after year 10 is **UNVERIFIED**.
- **Planning implication.** If they are likely to return to Israel within the next 5–10 years:
  - favor **pre-tax 401(k)** now (deduct at a 24–32% US rate), then draw down during the 10-year Israeli exemption window, subject to the US status rules above;
  - avoid building large IRA, HSA or 529 balances if exit-tax exposure is plausible;
  - check the green-card 8-of-15-year count **now**.

### 6.7 Social Security and Bituach Leumi

- **No totalization agreement.** No US–Israel Social Security totalization agreement was found in any source reviewed. Israel does not appear on the SSA agreement lists returned in search, and a 2005 Globes article says there is no such treaty [search results]. The SSA status page (ssa.gov/international) returned 403 and could not be read directly. Treat this as **very likely true but not primary-verified**.
- **What this means.**
  - US and Israeli coverage periods **cannot be combined** to qualify for benefits.
  - Working in the US for a US employer means US FICA applies.
  - If an Israeli employer seconds a US-based employee, double contributions are possible with no relief.
- **US Social Security.** 40 credits are needed (about 10 years). The **Social Security Fairness Act (January 2025)** repealed the Windfall Elimination Provision and Government Pension Offset, so a foreign pension from non-covered work **no longer reduces** US benefits (SSA; from general knowledge, not re-fetched).
  - US benefits paid to an Israeli resident are **exempt from tax in both countries** under Art. 21, which survives the saving clause [S13].
- **Bituach Leumi (Israeli National Insurance).**
  - Eligibility depends on **Israeli residency**. Israelis abroad for many years are generally **not residents**, so they neither pay nor accrue.
  - For roughly the first 5 years abroad, Bituach Leumi may still treat someone as resident and liable for contributions [S31] (dated Q&A sources).
  - The old-age pension qualifying period is **CONFLICT**: either 60 insurance months in the last 10 years or 144 months total, versus "5 of the last 10 years" [S31]. Verify with btl.gov.il.
  - **Health coverage on return:** someone abroad 2 or more consecutive years without paying faces a **waiting period of about 2 months per year abroad** before full health coverage (rules exist for returning residents; amounts and caps **UNVERIFIED**) [S31].
  - Ask whether they have paid voluntary Bituach Leumi contributions while abroad.

### 6.8 Currency risk (ILS vs USD)

- **The mismatch.** If retirement is in Israel, spending is in **ILS**. Assets are now largely **USD**: the 401(k), rentals, brokerage account and employer shares. The Israeli accounts are already ILS assets, but Israeli pension tracks hold large foreign-equity allocations, often only partly hedged to ILS. **Ask** for the hedge ratio per track.
- **Approach.**
  1. Match the currency of the next 5–10 years of retirement spending. Before the move, build an ILS bucket: Israeli government bonds or shekel deposits held in a **non-PFIC** form. Israeli government bonds held directly are not PFICs; Israeli bond funds are.
  2. Keep long-horizon equity global (USD-denominated is fine; equity currency exposure is partly self-hedging over long horizons).
  3. Don't over-hedge from the US. Forward or futures hedging is expensive and taxable for US persons (§988/§1256 complexity).
  4. Sequence any sale of US rentals with the move. Gains are taxed in USD, while ILS-based costs (for example, an Israeli home) set the target.
- **The US view of FX gains.** For US persons, functional currency is USD. ILS cash or deposits converted back can create **§988 FX gain**. A de minimis personal-transaction exclusion ($200) exists for personal-use gains only (statutory; not re-fetched).

---

## 7. Other US investment tools: fit for a cross-border household

| Tool | Facts | Fit |
|---|---|---|
| **Taxable brokerage, low-cost index ETFs** | Broad US/international index ETFs cost about 0.03–0.10%; the passive asset-weighted average is about 0.10% [S10] | **Core** after maxing tax-advantaged space. Use US-domiciled ETFs only (Israeli or EU funds are PFICs for US persons). Tax-loss harvest. Place international funds here to get the foreign tax credit. If they leave the US later, revisit US-situs estate exposure (§6.5) |
| **I bonds** | Nov 2026 – Apr 2027 composite **5.51%** (fixed **1.40%**, the highest since 2006) [S36]. Purchase limit $10K per person per year electronic (TreasuryDirect; not re-fetched). 1-year lock; 3-month interest penalty before 5 years. State-tax exempt | **Good** inflation-protected safe asset at a 1.40% real floor. Small relative to a large portfolio. Requires a TreasuryDirect account (US SSN and address). Liquidity limits |
| **TIPS / TIPS ladder** | Real-yield bonds; state-tax exempt; marketable | **Good** for the bond sleeve and for a pre-retirement liability ladder. Hold in tax-deferred accounts (phantom inflation income in taxable). Live yields not checked |
| **Treasury bill/note ladder** | State-tax exempt | **Good** for the emergency-fund overflow and known costs (tuition due over the next 2–5 years). Match maturities to tuition dates. Current yields not verified |
| **Municipal bonds** | Federally tax-exempt; in-state munis are also state-exempt | Fits **only if** the tax-equivalent yield = muni yield ÷ (1 − federal − state marginal rate) beats Treasuries/CDs. At a 32% federal bracket plus a high-tax state: worth checking. At 24% in a no-tax state: often not |
| **HYSA / money-market fund** | Govt MMFs are partly state-exempt (Treasury portion) | Emergency fund (about 6 months of expenses plus the rental reserve: about 3–6 months of PITI per property plus capex). Live rates not checked |
| **Backdoor Roth IRA** | $7,500 each (2026); $8,600 each at 50+ from 2027 [S1][S2]; pro-rata rule | **Yes**, if no pre-tax IRA balances and they will stay in the US. Weigh the Israel return (§6.6): Roth status in Israel after the exemption window is unknown |
| **Mega-backdoor Roth** | Room = §415(c) cap − deferrals − match [S3]; only in about a quarter of plans [S8] | **Verify the employer plan features first** (§1.3). Same Israel-return caveat |
| **Trump accounts** (OBBBA) | Open since 2026-07-04 for children under 18 with an SSN; **$5,000/yr** per child (employer up to $2,500 within that) [S26] (secondary sources) | Marginal: a 16-year-old has about 1–2 contribution years and a 12-year-old about 6. Compare with a 529 (more flexible for education) and a custodial Roth IRA (requires earned income). Low priority |
| **529** | See §5 | Child ~6+ years from college: yes. ~2 years from college: only for the state deduction. Already college age: only if a Title IV-eligible program is used |

---

## 8. General checklist for a cross-border household

(The ranked checklist and unknowns for this specific household, with its figures, live in private-data/advisor/us-household.md.)

**Top actions** (ranked by typical impact):

1. **Clean up cross-border compliance first.** Get the last 6 years of US returns, FBARs and 8938s. Confirm the Israeli pension, hishtalmut and manager's-insurance accounts were reported (FBAR/8938) and that a **consistent position** was taken on income, 3520 and 8621. If not, engage a US–Israel cross-border CPA to evaluate streamlined procedures. Non-compliance also **fails the exit-tax certification test** (§6.4, §6.6).
2. **Check the 401(k) contribution math** against the **$24,500** 2026 limit [S1]. Confirm the split (pre-tax / Roth / after-tax) and the match true-up. From age 50: **$25,500 + $8,500 catch-up = $34,000** in 2027, with the **catch-up as Roth** if prior-year FICA wages exceed $155K [S2][S3]. Confirm the plan has Roth [S5].
3. **Check for a mega-backdoor Roth in the employer plan.** Look for an after-tax source plus in-plan conversion or in-service withdrawal, and ask about the ACP/HCE refund risk [S8].
4. **Max out the HSA** up to the **$8,750 family limit** (2026) or **$9,000** (2027) via payroll, if family HDHP coverage [S6][S7]. Invest it and save receipts.
5. **Backdoor Roth IRAs for both spouses** ($7,500 each in 2026), after checking for pre-tax IRA balances (pro-rata rule). Weigh against intent to return to Israel (§6.6).
6. **Diversify employer stock.** Default to selling RSUs at vest and ESPP shares at purchase. Fix the 1099-B basis on any RSU sale to avoid double tax. Close the **22% withholding gap** with a W-4 change or estimated payments (2026 32% bracket begins at $403,550 MFJ [S11]).
7. **Insurance.** Individual level term for both spouses sized by needs analysis (portable after leaving the employer or the US). Ask about **after-tax LTD premium or buy-up** when the monthly cap binds [S33]. Consider **dropping** voluntary AD&D, accident, hospital-indemnity and critical-illness policies [S32]. Buy or confirm an **umbrella of $2–5M**, endorsed for the rentals (and any LLCs) and any teen driver [S38].
8. **Rentals.** Confirm whether passive losses are suspended (MAGI above $150K) and whether a spouse could qualify as a **real estate professional**. Consider a cost-segregation study only if losses can be used or a sale or exchange is coming. Evaluate an LLC vs the umbrella-exclusion and due-on-sale issues. Decide how the rentals fit an Israel-return plan, given US-situs estate exposure for non-domiciliaries above $60K (§6.5).
9. **Education.** Fund a 529 for younger children (consider 5-year gift averaging; $20K/yr annual exclusion from 2027 [S12]). For a child studying in Israel, verify the **specific program** is Title IV-eligible before using 529 money: TAU G08373, HUJ G04012 eligible programs only, Technion status unverified after 2026-09-30 [S20–S22]. Expect a high FAFSA Student Aid Index when rentals count as assets.
10. **Israel-return scenario.** Count green-card years (8-of-15 LTR test) and estimate each spouse's net worth against the **$2M** covered-expatriate test [S19]. Prefer pre-tax 401(k) over IRA/HSA/529 accumulation if exit tax is a risk. Plan the 401(k) W-8CE path. Map the Israeli 10-year exemption timing and the new reporting duty [S28].
11. **Gifts from Israeli family.** Report gifts or bequests above **$100K/yr** from nonresident individuals on **Form 3520 Part IV** (stable statutory threshold).
12. **Estate documents.** Wills, guardianship for minor children, and beneficiary designations (401(k), HSA, life insurance, Israeli funds' "mutav" beneficiaries). Add QDOT-enabling language if either spouse is not a citizen [S11][S12].

**Key unknowns to ask the user** (each changes advice materially):

1. **US status of each spouse and each child**: citizen, green card (since when?), or visa. This drives the exit tax, the treaty saving clause, the QDOT, FAFSA/Title IV eligibility, the Trump-account SSN requirement and 401(k) taxation after a move.
2. **Do they hold, or have they given up, Israeli tax residency?** When did they leave Israel? (This affects returning-resident status and Bituach Leumi.)
3. **Intent and timing of a return to Israel** (never / 5 years / 10+ years / retire there).
4. **Income**: each spouse's base, bonus and RSU amounts; the MFJ MAGI estimate (Roth IRA, passive-loss, AOTC and SALT phase-outs).
5. **State of residence** (529 deduction, HSA state treatment, munis, LLC costs, in-state tuition).
6. **Employer plan details**: Roth option, after-tax source, in-plan conversion, match formula and true-up, ESPP §423 terms, RSU vesting schedule, unvested value.
7. **Mortgages**: balance, rate, term and fixed/ARM for the home and each rental; property values, basis, accumulated depreciation and acquisition dates (bonus-depreciation eligibility after 2025-01-19).
8. **Israeli accounts breakdown**: by type (pension / manager's insurance / hishtalmut / gemel), by owner, employer vs self-employed funding, the investment track, the date each hishtalmut becomes liquid, and how each was reported on past US returns.
9. **Any existing traditional, SEP or rollover IRA balances** (pro-rata rule).
10. **College-age children's plans** (IDF status, intended university and program, US vs Israel).
11. **Current insurance**: the HDHP tier (self or family), existing individual life or disability policies, and the umbrella and landlord policy limits; whether the rentals are held in an LLC.
12. **Emergency fund and cash** level, and the trading-account size and holdings (watch for any Israeli funds, which are PFICs).

---

## Sources

S1. IRS, IR-2025-111, "401(k) limit increases to $24,500 for 2026, IRA limit increases to $7,500", 2025-11-13. https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500

S2. IRS, IR-2026-136, "401(k) limit increases to $25,500 for 2027, IRA limit remains $7,500", 2026-11-12. https://www.irs.gov/node/167581

S3. IRS, Notice 2026-66 (2027 COLAs: §415(c) $72K→$75K; Roth catch-up threshold $150K→$155K; HCE $160K→$170K; §401(a)(17) $360K→$375K), 2026-11-12. https://www.irs.gov/pub/irs-drop/n-26-66.pdf

S4. (Not separately used. The 2026 figures in Notice 2025-67 are confirmed via S1/S3.)

S5. IRS, IR-2025-91, final regulations on the Roth catch-up rule, 2025-09-15. https://www.irs.gov/newsroom/treasury-irs-issue-final-regulations-on-new-roth-catch-up-rule-other-secure-2point0-act-provisions. EY Tax News 2025-2010 (2025-10-03) on non-Roth plans: https://taxnews.ey.com/news/2025-2010-irs-publishes-final-regulations-implementing-changes-to-retirement-plan-catch-up-contributions

S6. IRS, Rev. Proc. 2026-24 (2027 HSA/HDHP amounts), May 2026 (release date reported as 2026-05-29 or 2026-06-01). https://www.irs.gov/pub/irs-drop/rp-26-24.pdf

S7. KPMG TaxNewsFlash on Rev. Proc. 2026-24 (2026 comparison: $4,400 / $8,750), May 2026. https://kpmg.com/us/en/taxnewsflash/news/2026/05/tnf-rev-proc-2026-24-hsa-inflation-adjusted-amounts-for-2027.html. Mercer, "2027 HSA, HDHP, and excepted-benefit HRA figures set", 2026. https://www.mercer.com/insights/law-and-policy/2027-hsa-hdhp-and-excepted-benefit-hra-figures-set/

S8. Vanguard, *How America Saves 2026*, June 2026. https://workplace.vanguard.com/content/dam/inst/iig-transformation/has/2026/pdf/HowAmericaSaves2026.pdf. In-plan conversion benchmark from Vanguard industry reports (2025-12-31 data), e.g. https://workplace.vanguard.com/content/dam/inst/iig-transformation/insights/pdf/2026/has/Unions_Final.pdf

S9. Vanguard Target Retirement 2045 Fund fact sheet (glide-path table), June 2025, via workplace.vanguard.com (https://workplace.vanguard.com/iippdf/pdfs/FS306.pdf). The interpolated ~75/25 figure is our estimate.

S10. Morningstar, 2026 US Fund Fee Study (2025 data), 2026. https://www.morningstar.com/business/insights/blog/us-fund-fee-study

S11. IRS, IR-2025-103 and Rev. Proc. 2025-32 (tax year 2026 inflation adjustments incl. OBBBA: $15M estate exclusion, $19K annual gift, $194K non-citizen-spouse gift, MFJ brackets, $32,200 standard deduction, $132,900 FEIE, covered expatriate $211,000, §877A exclusion $910,000), 2025-10-09. https://www.irs.gov/node/151941 and https://www.irs.gov/pub/irs-drop/rp-25-32.pdf

S12. IRS, Rev. Proc. 2026-35 (tax year 2027: $15,480,000 estate exclusion, $20,000 annual gift, $201,000 non-citizen-spouse gift, MFJ brackets, $33,200 standard deduction, FEIE $137,300, covered expatriate $218,000, §877A exclusion $940,000), November 2026 (reported 2026-11-05). https://www.irs.gov/pub/irs-drop/rp-26-35.pdf

S13. US–Israel Income Tax Convention (1975) with 1980 and 1993 protocols (Arts. 6, 12, 20, 21 read directly). https://www.irs.gov/pub/irs-trty/israel.pdf

S14. IRS, Rev. Proc. 2020-17 (relief from §6048 reporting for tax-favored foreign trusts), March 2020. https://www.irs.gov/pub/irs-drop/rp-20-17.pdf

S15. Philip Stein & Assoc. (Y. Jacob), "Everything U.S. citizens need to know about Israeli pensions", 2024-08-27. https://www.pstein.com/blog/everything-u-s-citizens-need-to-know-about-israeli-pensions/

S16. PFIC Report, "Israel PFIC Guide: Keren Hishtalmut, Kupat Gemel & Form 8621", 2026-06-18 (commercial source). https://pficreport.com/countries/israel-pfic-keren-hishtalmut-kupat-gemel-form-8621

S17. MAS America, "Withdrawing a Keren Hishtalmut in the US", 2025-08-26. https://masamerica.co.il/en/withdrawing-keren-hishtalmut-us/

S18. IRS, "Comparison of Form 8938 and FBAR requirements", last reviewed 2026-09-19. https://www.irs.gov/businesses/comparison-of-form-8938-and-fbar-requirements. FBAR inflation-adjusted penalty amounts ($16,536 / $165,353) are from secondary sources, e.g. https://www.taxesforexpats.com/articles/fbar-fatca/fbar-penalties (2026); not verified against 31 CFR 1010.821.

S19. IRS, Instructions for Form 8854 (2025). https://www.irs.gov/instructions/i8854

S20. Tel Aviv University International, "U.S. Federal Student Loans at TAU" (code G08373), accessed 2026-11-21. https://international.tau.ac.il/node/732

S21. Hebrew University Rothberg International School, Consumer Information (code G04012; only listed programs eligible), January 2024. https://overseas.huji.ac.il/wp-content/uploads/2024/01/Consumer-Information.pdf

S22. US Dept. of Education, Technion Program Participation Agreement (provisional; expiration 2026-09-30). https://studentaid.gov/sites/default/files/ppa/technion-israel-institute-of-technology-ppa.pdf. Federal School Code list: https://fsapartners.ed.gov/knowledge-center/library/resource-type/Federal%20School%20Code%20Lists

S23. Reichman University, Consumer Information Policy 2025-26. https://www.runi.ac.il/media/vhcdyqxb/ru-consumer-information-policy-25-26.pdf

S24. IRS Publication 970 (definition of eligible educational institution). https://www.irs.gov/publications/p970 (stable; not re-fetched)

S25. 529-to-Roth rollover summaries: Vanguard https://investor.vanguard.com/investor-resources-education/education-college-savings/529-roth-rollover; Schwab https://www.schwab.com/learn/story/529-to-roth-ira-rollovers-what-to-know; Savingforcollege https://www.savingforcollege.com/article/roll-over-529-plan-funds-to-a-roth-ira (2025–2026)

S26. Savingforcollege, "How the Big Beautiful Bill Impacts Education Savings: 529 Plans, ABLE Accounts, and Trump Accounts" (2025). https://www.savingforcollege.com/article/big-beautiful-bill-education-savings-529-plans. Kiplinger: https://www.kiplinger.com/taxes/key-ways-the-big-beautiful-bill-impacts-your-childs-finances

S27. FAFSA/CSS asset treatment (secondary sources): https://thecollegeinvestor.com/88745/fafsa-asset-questions-dont-have-to-be-reported/; Greenback, "CSS Profile for U.S. Expats", https://www.greenbacktaxservices.com/?p=111429. Official reference to check: 2027-28 FSA Handbook, https://fsapartners.ed.gov

S28. Herzog Fox & Neeman, "New Tax Incentives for New Immigrants and Veteran Returning Residents to Israel" (2025–26). https://herzoglaw.co.il/en/news-and-insights/new-tax-incentives-for-new-immigrants-and-veteran-returning-residents-to-israel/. Times of Israel: https://www.timesofisrael.com/israel-unveils-0-tax-rate-for-2026s-immigrants-and-returning-residents/. Nefesh B'Nefesh 2026 update: https://www.nbn.org.il/life-in-israel/finances/taxes/us-tax-compliance/

S29. US retirement accounts and Israeli tax (practitioner blogs, 2025–2026): https://www.cwsisrael.com/foreign-pension-olim-israel/; https://www.pstein.com/blog/u-s-pension-tax-for-u-s-citizens-living-in-israel/; https://www.pstein.com/blog/part-iii-key-issues-and-opportunities-when-returning-to-israel/

S30. SSA, international agreements overview (returned 403; not read). https://www.ssa.gov/international/agreements_overview.html

S31. Bituach Leumi residency and eligibility (secondary, partly dated): Nefesh B'Nefesh https://www.nbn.org.il/life-in-israel/government-services/bituach-leumi/bituach-leumi/; Jerusalem Post "Ask Sarah" columns (various years).

S32. GAO, HRD-88-93 (hospital indemnity and specified-disease loss ratios), 1988. https://www.gao.gov/assets/hrd-88-93.pdf. SOA *Small Talk* Issue 52, December 2019. https://www.soa.org/4b0bce/globalassets/assets/library/newsletters/small-talk/2019/december/stn-2019-iss52-howard-koron.pdf

S33. IRS Publication 525 (2025), Taxable and Nontaxable Income (sick pay / employer-paid accident and health plans). https://www.irs.gov/publications/p525

S34. OBBBA 100% bonus depreciation: Grant Thornton https://www.grantthornton.com/insights/alerts/tax/2025/insights/obbba-offers-new-ways-to-accelerate-depreciation; BDO https://www.bdo.com/insights/tax/one-big-beautiful-bill-act-expands-100-depreciation-expensing-opportunities (2025)

S35. SALT cap 2026/2027 (secondary): Kiplinger, "SALT Deduction Gets an Update for 2026 Taxes". https://kiplinger.com/taxes/salt-deduction-gets-an-update-for-2026-taxes

S36. Tipswatch, "Treasury sets I Bond's fixed rate at 1.40%; composite rate rises to 5.51%", 2026-10-30. https://tipswatch.com/2026/10/30/treasury-sets-i-bonds-fixed-rate-of-1-40-composite-rate-rises-to-5-51/. Official page: https://treasurydirect.gov/savings-bonds/i-bonds/i-bonds-interest-rates/

S37. Employer-stock dividend history from market-data aggregators (trendlyne, stockanalysis). The specific URLs for the household's employer are in private-data/advisor/us-household.md.

S38. Umbrella costs for landlords (secondary): https://rentalrealestate.com/insurance/umbrella-policy/ (June 2026); https://www.coveragecat.com/insurance-types/umbrella/should-landlords-use-personal-umbrella; https://www.steadily.com/blog/umbrella-insurance-policy-vs-llc-rental-property

S39. Stable IRS references cited for long-standing rules, not re-fetched this session: Pub 925 (passive activities, $25K allowance), Pub 527 (27.5-year depreciation), Like-Kind Exchanges (45/180 days), Topic 427 (ESPP/stock options), Pub 15 (22%/37% supplemental withholding), Pub 15-B (§79 imputed income), Form 8606 instructions (pro-rata), Form 3520 instructions ($100K foreign gifts). https://www.irs.gov/publications/p925 · https://www.irs.gov/publications/p527 · https://www.irs.gov/taxtopics/tc427 · https://www.irs.gov/publications/p15 · https://www.irs.gov/publications/p15b

S40. SSA, Social Security Fairness Act (WEP/GPO repeal). https://www.ssa.gov/benefits/retirement/social-security-fairness-act.html (not re-fetched)

S41. Ascensus, "IRS Releases 2027 Cost-of-Living Adjusted Retirement Savings Limitations", 2026-11-18. https://thelink.ascensus.com/articles/2026/11/18/irs-releases-2027-cost-of-living-adjusted-retirement-savings-limitations

**Last verified: 2026-11-21**
