# Israel: pension, savings, insurance and tax knowledge base

Household-specific notes live in private-data/advisor/ (gitignored).

**Typical household this is written for:** an Israeli couple in their late 40s with children, one spouse employed in the US by a US company, holding Israeli pension, manager's insurance and study-fund savings, plus US holdings (401(k), RSUs, rental properties).

**Purpose:** reference for an advisor AI before it advises such a household. This file covers Israeli rules only. US tax treatment (PFIC, foreign trusts, FBAR/8938, treaty) belongs in the US knowledge doc; this file flags where the two interact.

**How to read the source tags:** every number carries a tag such as `[S1]`, which maps to the Sources list at the end. Three labels mark how far to trust a statement:
- **UNVERIFIED** means it was not confirmed against a primary or reliable source during this research.
- **CONFLICT** means sources disagree.
- **REASONING** means it is an inference from verified facts, not a sourced rule.

**Context that affects everything below:**
- The Knesset dissolved in July 2026 and elections were held on 27 Oct 2026 [S29]. A new government may change pending reforms, such as the Finance Ministry's "investment account" proposal and the expiry dates of temporary provisions.
- Many 2026 tax thresholds were **frozen (not indexed) for 2025–2027** [S1][web summaries of S1-type tables]. For 2027, expect the same nominal figures unless new legislation changes them. Do not assume indexation.

---

## 0. First questions per product type

| Product | Notes / first questions to ask |
|---|---|
| Comprehensive pension fund (קרן פנסיה מקיפה, comprehensive pension fund) | Compare fees with the market (a 0% deposit / 0.16% balance fee is excellent). **Is anyone still depositing?** If not, the built-in disability and survivor cover has probably lapsed (see §6.1). |
| Manager's insurance (ביטוח מנהלים), e.g. a combined life-and-savings policy ("חיים משולב חיסכון") | Fees of 4% on deposits plus 1% on the balance are at or near the legal caps (4% / 1.05%). **Does it have a guaranteed conversion factor (מקדם מובטח)?** If it was opened before 2013 it may (see §2.4). |
| Frozen small policies / provident funds (קופת גמל) | Candidates to consolidate. Check each for a guaranteed factor and capital money first. |
| Keren Hishtalmut (קרן השתלמות, study fund) | Usually liquid after 6 years (§3). |
| Term life (ביטוח חיים ריסק) | Check overlap with US employer cover and pension survivor cover. |
| Manager's insurance with a stated conversion factor (e.g. around 210) | **Find out the retirement age this factor applies to and whether it is guaranteed.** |

**Statutory retirement ages** [S6]:
- Men: 67.
- Women born in 1970 or later: 65.
- Early retirement for women is possible from 60 under conditions [S6].
- The Israeli Social Security (ביטוח לאומי) old-age pension has its own rules and residency/contribution conditions, which are not covered here.

---

## 1. Pension law

### 1.1 Mandatory pension (צו ההרחבה לביטוח פנסיוני מקיף, mandatory pension extension order)
- **Coverage:** every employee in Israel. Men are eligible from age 21 and women from 20 [S7].
- **Total contribution since 2017: 18.5% of salary** [S7]:
  - employee 6%;
  - employer 6.5% to savings plus 6% to severance (פיצויים, severance pay component).
  - An employer may set the severance component at 8.33%, bringing the total to 22.83% [S7].
- **Salary base:** the lower of actual salary and the national average wage (₪13,769/month in 2026), unless the contract sets a higher base [S1][S7].
- **Waiting period: CONFLICT.**
  - Kol Zchut states 6 months for a new employee with no existing pension, with different rules for employees who already have one.
  - Another source describes 3 months, retroactive, for some cases [S7 search summary].
  - Verify against the order itself.
- **Relevance:** applies only to someone working for an **Israeli** employer. A spouse employed by a US entity is not covered by Israeli mandatory pension on that US salary (REASONING).

### 1.2 Pension Savings Law (חוק הפיקוח על שירותים פיננסיים (קופות גמל), Provident Funds Supervision Law) and Amendment 3 (2008)
- Money deposited **after 1 Jan 2008** is "annuity money" (כספים קצבתיים): it must be paid out as a lifetime annuity, apart from the lump-sum exceptions in §1.4.
- Money deposited **before 2008** in manager's insurance or provident funds may be "capital money" (כספים הוניים), which can be withdrawn as a lump sum.
- **Moving capital money into a pension product permanently converts it to annuity money** [S3].
- **Action:** before moving anything out of an old manager's insurance policy or a frozen provident fund, ask for the split between capital and annuity money.

### 1.3 Retirement age, minimum pension and lump-sum withdrawal (היוון, commutation) — 2026 figures
**Two thresholds decide how much can be taken as a lump sum:**

| Parameter | 2026 value | Source |
|---|---|---|
| Minimum pension (סכום קצבה מזערית) under Amendment 190 | **₪5,306/month** | [S1][S5] |
| Minimum accumulation (סכום צבירה מזערי): at or below this, the whole balance can be taken as a lump sum | **₪110,250** | [S5] |

**Rules** [S5]:
- **If the projected total pension, from all sources, is above ₪5,306:** everything above the minimum can be commuted. The commutable amount = total accumulation − (₪5,306 × the conversion factor used).
- **If the projected pension is below the minimum:** you may commute up to 25% of the monthly pension for a period of 5 years.
- **Amendment 190, for members aged 60+ with a pension at or above the minimum:** they may withdraw "exempt amounts" (סכומים פטורים) from a provident fund, paying **15% tax on the nominal gain component** [S34].
  - The More table lists age-dependent caps on "exempt payments" deposits without needing tax-assessor approval, for example ₪11,951,492 up to age 60 [S1].
  - For savers who are a decade or more from 60, the exact mechanics may change before then (REASONING).

### 1.4 Fixing rights (קיבוע זכויות) — Amendment 190 / Form 161ד
**Exemption on the qualifying pension (קצבה מזכה):**

| Year | Exempt share of the qualifying-pension ceiling | Status |
|---|---|---|
| 2025 | 57% | in force [S4] |
| 2026 | **57.5%** | in force [S1][S4] |
| 2027 | 62.5% | planned or expected [S4] |
| 2028 onward | 67% | planned or expected [S4] |

- **Qualifying-pension ceiling: ₪9,430/month**, frozen since 2024 [S1][S4].
- **Maximum exempt pension in 2026:** 57.5% × 9,430 = **₪5,422/month** [S1].
- **Full exemption basket (סל הפטור), 2026:** ₪976,005 according to Kol Zchut (search summary of [S5]; not fetched directly, **UNVERIFIED** against the Tax Authority).
- **Form 161ד** is filed with the tax assessor (פקיד שומה) near retirement age or when the pension starts. It allocates the basket between:
  - an exempt monthly pension;
  - exempt lump sums (severance grants, commutation).
- **Pitfalls:**
  - The decision is close to irreversible [S4].
  - Under the "combination formula" (נוסחת השילוב), each shekel of exempt severance withdrawn in the 32 years before eligibility age reduces the exempt capital by 1.35 shekels, indexed [S4].
  - Sources mention a 90-day lock on the commutation choice after the exemption is first applied (search summary only, **UNVERIFIED**).
- **Relevance:** only applies to someone who is an Israeli tax resident when drawing a pension, or a non-resident drawing an Israeli pension, where treaty and withholding questions arise (§7.6). Mostly relevant if they retire in Israel.

### 1.5 Tax on annuity vs lump sum (Israeli resident)
- **Annuity:** taxed as earned income at the regular brackets, minus the qualifying-pension exemption (§1.4). The 2026 brackets are 10% / 14% / 20% / 31% / 35% / 47%, plus 3% surtax above ₪721,560 per year [S1].
- **Severance (פיצויים) on retirement:** exempt up to ₪13,750 per year of service, subject to the exemption basket [S1].
- **Lump-sum commutation of a pension:** exempt only to the extent of the remaining basket. Otherwise taxed (the rate depends on the type of money; **UNVERIFIED** in detail).
- **Early withdrawal of benefits money (משיכה שלא כדין, unlawful withdrawal):** 35% withheld (section 87). As a pre-retirement exit route this is almost never worth it [S23].

---

## 2. Product comparison: pension fund vs manager's insurance vs provident fund

### 2.1 What each product is

| | New comprehensive pension fund (קרן פנסיה מקיפה) | Supplementary / general pension fund (משלימה / כללית) | Manager's insurance (ביטוח מנהלים) | Provident fund for annuity (קופת גמל לקצבה) |
|---|---|---|---|---|
| Built-in disability and survivor insurance | Yes, mutual and in the fund rules | No | Optional riders, priced separately | No |
| Deposit cap | Yes: 20.5% of 2× the average wage, i.e. ₪5,645/month in 2026 [S1] | No | No | No |
| Guaranteed-return component | **Yes: return-completion mechanism on 30% of assets** (§2.3) | No | No | No |
| Conversion factor | Not guaranteed. Set at retirement, mutual, can be adjusted. | Not guaranteed | **Guaranteed in many pre-2013 policies** [S10] | Not guaranteed |
| Legal max fees | 6% of deposits + 0.5% of balance [S8] | 4% + 1.05% (**UNVERIFIED** split) | 4% of deposits + 1.05% of balance [S9] | 4% + 1.05% [S9] |

### 2.2 Fees
**Legal maximums:**
- Pension fund: 6% of deposits and 0.5% of balance [S8].
- Provident funds and manager's insurance: 4% of deposits and 1.05% of balance [S9].
- Keren Hishtalmut: balance fee only, commonly cited at a 2% cap (**UNVERIFIED** against the regulation).
- Pensioners already receiving an old-age annuity: the balance fee was capped at 0.3% from 1 Feb 2022 (Kol Zchut, via search; **UNVERIFIED** for 2026).

**2026 market averages:**
- Pension funds: about **1.64% of deposits and 0.16% of balance** [S8].
- Bizportal analysis of 2025 actual fees: Menora 1.73% / 0.15%, Altshuler 1.24% / 0.15% [search summary of Bizportal 20034989].
- Savings policies (פוליסות חיסכון): the average at most insurers is below 1% of balance in 2026 [S28].
- Index-tracking study funds: about 0.5–0.7% (for example, Migdal S&P 0.5% and the 2025 average at More 0.7%) [search summary of supermarker / mygemel fund pages].

**Default funds (קרנות ברירת מחדל), 2024 tender** [S2]:
- **Winners:** Meitav, More, Altshuler Shaham and Infinity, serving **1 Nov 2024 – 31 Oct 2028**.
- **Base fee for new joiners:** up to **1% of deposits plus 0.22% of balance**.
- **Alternative combinations (balance / deposit):** 0.2% / 1.2% at all four funds; 0.15% / 1.7%; 0.12% / 2.0%; 0.1% / 2.2%; 0.05% / 2.7%. Not every fund offers every combination.
- **Lock:** the fee is fixed for 10 years from joining. The fund may revert to 1% / 0.22% if there have been no deposits for 6+ months [S2].

**Benchmarking an existing account:**
- A pension fund at 0% / 0.16% is better than the default-fund terms.
- A manager's insurance policy at **4% / 1%** is near the legal cap. On ₪1M, a 1% balance fee costs about ₪10,000 per year. A 0.2% fee would cost about ₪2,000, a gap of about ₪8,000 per year before compounding (REASONING, simple arithmetic).
- **Check:** is the 1% fee contractual, which is common in old policies, or negotiable? Can the insurer lower it without moving the money, which keeps any guaranteed factor?

### 2.3 Balance-fund guarantee (אג"ח מיועדות, designated bonds): pension funds only
- **Old mechanism:** pension funds used to hold 30% of assets in non-tradable "designated" government bonds yielding 4.86% CPI-linked. Issuance stopped in October 2022.
- **Replacement:** a **return-completion mechanism (מנגנון הבטחת השלמת תשואה)**. The state guarantees a **5.15% real annual return on 30% of each pension fund's assets** [S12, plus Calcalist and Bizportal via search].
  - The guarantee applies **at fund level, not per member**.
  - Shortfalls are paid by the state and surpluses go to a state account.
  - The state's 2025 allocation for the mechanism was about ₪51.3B [S12].
- **Status: CONFLICT / UNVERIFIED.** The Knesset Finance Committee extended the existing mechanism to end-2025. Draft regulations proposed changing it to strengthen protection for savers over 50 in default tracks. Whether the change took effect in 2026 was not confirmed.
- **Why it matters:** only comprehensive and general pension funds get this. Manager's insurance, provident funds and study funds do not [S3]. It is a structural reason to prefer a pension fund for "safe" retirement money.

### 2.4 Conversion factors (מקדם המרה)
- **Definition:** monthly pension = accumulation ÷ factor. **A lower factor means a higher pension.**
- **Guaranteed factors** exist only in manager's insurance policies issued **before 2013**. They are fixed at sign-up using the mortality tables of that time and cannot be changed even as life expectancy rises [S10].
- Pension-fund and provident-fund factors are **not guaranteed** [S10].

**Indicative current pension-fund factors: CONFLICT / low confidence.**
- A Bizportal 2026 calculator estimates **about 180** for a man retiring at 67 (single, no guarantee period), about 6 points higher for a woman, within a "typical range of about 170–220" [S11].
- Bizportal elsewhere cites about 200 as the figure for new pension funds [S10].
- Actual factors depend on the fund, gender, retirement age, survivor-pension choices and guaranteed payment periods. **Ask each fund for a personal quote.**

**Rule of thumb from the source** [S10]:
- A guaranteed factor of about 160–170 is "an asset you can no longer buy". Moving it to a pension fund at about 200 is a loss.
- If the guaranteed factor is **above about 200**, moving may make sense.

**A policy quoting a factor around 210:**
- This is **not obviously valuable** against current pension-fund factors. But the comparison depends on the **age the factor is quoted for** and on whether it includes a survivor/guarantee period.
- A factor of 210 at age 60 would be very different from 210 at 65 or 67.
- Request: the policy's guaranteed factor table by retirement age, and whether it is guaranteed (REASONING).

**A policy named "חיים משולב חיסכון":**
- The name suggests an older combined life-and-savings policy (**UNVERIFIED**; check the policy start date).
- If it started before 2013, it may carry a guaranteed factor, possibly a good one. **Do not move it before obtaining the factor.**

### 2.5 How to decide whether to move a manager's insurance policy into a pension fund
Compare all of the following (REASONING, built on [S3][S10]):
1. **Projected monthly pension** at the statutory retirement age (67 for men, 65 for women born 1970+) in both products. Use the guaranteed factor for the policy and a quoted, non-guaranteed factor for the fund. Model a 10–20 year horizon with the fee difference compounded.
2. **Fees:** the 1% balance fee vs about 0.1–0.2% in a pension fund. Over 18 years on ₪1M, a 0.8 percentage-point annual drag compounds to roughly 13–14% of the final balance (REASONING, arithmetic).
3. **Insurance:** the policy's riders vs pension-fund cover (§6). Moving loses the old disability rider definitions, which are often "own occupation" (עיסוקי). A new waiting period may apply [S3].
4. **Capital vs annuity money:** moving pre-2008 capital money into a pension fund converts it permanently [S3].
5. **Deposit cap:** a comprehensive pension fund accepts transfers only within its cap. General (כללית) pension funds have no cap [S3].
6. **Partial transfers:** allowed from manager's insurance to a provident fund, but **not to a pension fund**, which takes all or nothing [S3].
7. **Middle path:** keep the policy for its guaranteed factor and **negotiate the balance fee down**, and/or direct new deposits elsewhere.

### 2.6 Portability (ניוד) rules and costs [S3]
- Transfers between licensed products are **tax-free and have no transfer fee**. Check for early-redemption penalties in specific policies.
- Completed within **10 business days** of a complete request. Can be cancelled within 10 business days of notice.
- **Allowed and blocked routes:**
  - Old (ותיקה) and budget (תקציבית) pension funds cannot be moved.
  - Comprehensive and general pension funds can move to other pension funds, provident funds or manager's insurance, within the caps.
  - Manager's insurance can move without limit to another manager's insurance or to a general pension fund. It can move to a comprehensive fund only up to the cap.
  - **A study fund can move to a pension product only after it is liquid. The move is irreversible.**
  - An investment provident fund (גמל להשקעה) can move to an annuity product from age 60, irreversibly.
- **Transfers are blocked when:** the savings are seized or pledged, there is an outstanding loan secured on them, or an annuity has been requested or is being paid.
- **Process:** the receiving fund files the transfer request. The pension clearing house (מסלקה פנסיונית) carries the data.

### 2.7 How to negotiate fees
(REASONING, based on [S2][S8].)
- **Anchors:** the default-fund rates (1% / 0.22%, or 0.05–0.2% balance with higher deposit fees) [S2] and the market averages [S8].
- **For a large, inactive balance**, the deposit fee is irrelevant. **Negotiate the balance fee.** A deposit-fee/balance-fee trade-off like the default-fund menu (for example 2.7% / 0.05%) is ideal when deposits are small.
- **Use competition:** get a written offer from another fund and ask the current fund to match it. The official fee calculator on gov.il compares offers [search result: gov.il management_fee_calculator].
- **Check for conditions:** many low-fee deals are tied to an employer arrangement or to "active" status. They can revert when deposits stop. The default funds explicitly allow reverting after 6 months with no deposits [S2].
- **Use a licensed pension adviser (יועץ פנסיוני)** rather than an agent paid by commission from the insurer.

---

## 3. Keren Hishtalmut (קרן השתלמות, study fund)

### 3.1 2026 ceilings (frozen for 2025–2027) [S1]

| | 2026 |
|---|---|
| Employee: maximum salary on which deposits are tax-exempt | **₪15,712/month** |
| Employee: employer rate | up to 7.5% of capped salary (≈₪1,178) |
| Employee: employee rate | up to 2.5%, and at least one third of the employer rate |
| Self-employed: annual income ceiling | **₪293,397** (one source shows 293,379, a typo **CONFLICT**) |
| Self-employed: deductible deposit (4.5%) | **₪13,203** |
| Self-employed: capital-gains-exempt deposit ceiling | **₪20,566** |

### 3.2 Liquidity
- **Normal rule:** liquid **6 years** from the first deposit, after which withdrawal is free of Israeli income and capital-gains tax on the eligible portion [S26].
- **3-year exceptions:**
  - withdrawal to fund professional training or study;
  - withdrawal on reaching retirement age (67 for men; 62–65 for women by birth year), without approval [S26].

### 3.3 Capital gains
- Gains on deposits **within** the ceilings are exempt after liquidity [S1][S26].
- Deposits **above** the ceilings, or employer deposits above the salary cap (which are taxed as income when deposited): gains are taxable.
  - The commonly cited rate is 25% on the real gain.
  - The rate was **UNVERIFIED** in this research.
- Withdrawal before liquidity, without one of the exceptions, is taxed at the marginal rate on the employer portion (**UNVERIFIED** detail).

### 3.4 Living abroad
**Keeping the account:**
- Nothing found prevents a non-resident from keeping an existing study fund and withdrawing it after liquidity (REASONING).
- Withdrawal paperwork may require a non-residency declaration (Form 2402) and bank details. Some funds require identity verification at a branch or via an apostilled form (**UNVERIFIED**).

**New deposits:**
- The exemptions are tied to Israeli earned income from employment or self-employment [S1].
- Someone paid by a US company **cannot make tax-advantaged deposits** (REASONING).
- A spouse could only if they have Israeli earned income.

**US taxation** (detail in the US doc):
- **Israel treats the fund as tax-exempt. The US does not recognise that.**
- **CONFLICT:** practitioner sources disagree on three things:
  - whether a keren hishtalmut is a foreign grantor trust (annual taxation of gains, Forms 3520 / 3520-A);
  - whether its underlying funds are PFICs (Form 8621);
  - whether treaty pension treatment applies [S22, plus blogs via search].
- **Rev. Proc. 2020-17** (IRS, 2 Mar 2020) exempts "tax-favored foreign retirement trusts" and certain "non-retirement savings trusts" (medical, disability, education) from Forms 3520 / 3520-A when conditions are met.
  - FBAR and Form 8938 still apply [S22].
  - **Whether a keren hishtalmut qualifies is not settled.** Its contribution limits arguably meet the test. Its "education" purpose is nominal.
- **Planning implication (REASONING):** for US persons, a liquid study fund delivers no US tax benefit and creates reporting risk. Withdrawing it, which is Israeli-tax-free, is often considered. Coordinate with the US doc and a cross-border CPA before acting.

---

## 4. Investment provident fund (קופת גמל להשקעה)

- **2026 annual ceiling: ₪83,641 per person**, across all of a person's investment provident funds (2025: ₪81,711) [S1].
- **Deposits** must reach the fund by 31 Dec 2026 [web summary of S1-type tables].
- **Liquidity:** withdrawable at any time as a lump sum. Tax is **25% on the real gain**, as for securities (commonly cited; consistent with [S16]'s description of "the current situation").
- **From age 60:** withdrawing as an **annuity is exempt from capital-gains tax**. The Finance Ministry's July 2026 report explicitly describes this as the current law [S16].
  - The money can also be moved, irreversibly, to an annuity-paying product from 60 [S3].
- **Moves** between investment provident funds of different managers are tax-free [S3].
- **Use as a vehicle:**
  - a flexible, liquid, low-fee wrapper with tax deferral on rebalancing;
  - an exempt annuity option at 60;
  - inheritance passes to beneficiaries.
- **For US persons it has the same PFIC / foreign-trust problem as the study fund (REASONING), so its value depends on US status.**

**Pending reform: proposal only, not law.**
- The Finance Ministry's committee on short- and medium-term savings published its final report in **July 2026** [S16]. It recommends:
  - an **"investment account" (חשבון השקעה)** at non-bank brokers, holding mutual funds, investment provident funds, savings policies and securities;
  - uniform tax deferral up to an overall ceiling "to be set";
  - exemption from capital-gains tax for withdrawals as an annuity after 60, mirroring today's investment provident fund.
- Press reports cite a **₪200K lifetime, CPI-linked ceiling** [search: walla / bizportal]. That figure was **not seen in the extracted report text (UNVERIFIED)**.
- Large banks would be excluded at first, reportedly for 3 years (Bizportal via search).
- **Status after the October 2026 election: unknown.**

---

## 5. Savings policies, self-directed (IRA-type) accounts, investment tracks and returns

### 5.1 Savings policy (פוליסת חיסכון)
- **What it is:** an insurance-company investment wrapper with no deposit cap.
- **Tax:** switching tracks inside the policy is not a taxable event. Gains are taxed at 25% real on withdrawal [S28, plus Bizportal via search].
- **Moving between insurers** is generally a **taxable event** (walla via search; **UNVERIFIED** in the statute).
- **Fees:** up to 2% of balance; the 2026 average at most insurers is below 1% [S28].
- **Comparison with an investment provident fund:** no annual cap and no annuity exemption at 60, but usually higher fees [Bizportal via search].

### 5.2 Self-directed accounts (ניהול אישי, "IRA בישראל")
- **What they are:** personally managed study funds or provident funds, where the saver picks securities through a brokerage.
- **Fees:** examples of 0.24–0.3% of balance (Phoenix, Meitav personally managed study funds), plus brokerage costs [search summary of supermarker fund pages, mid-2026].
- **Which products allow it:** pension funds do not offer self-direction, though some insurers offer manager's insurance with a "personal management" option (**UNVERIFIED**).
- **Risk:** for US persons, buying Israeli or non-US mutual funds/ETFs inside such accounts aggravates PFIC exposure (REASONING; see US doc).

### 5.3 Investment tracks
| Track | Description |
|---|---|
| S&P 500 tracker (מחקה מדד S&P 500) | Passive US large-cap. Currency exposure depends on hedging policy. |
| Equities (מניות) | Actively managed global and Israeli stocks. |
| Index-tracking (עוקב מדדים) | Passive multi-index. |
| Age-dependent (תלוי גיל) | Default since 2016 in pension funds: tracks for "up to 50", "50–60" and "60+" with declining equity exposure. **A saver aged 49 is about to be moved from the "under 50" track to the "50–60" track automatically.** That is a meaningful de-risking at age 50, so decide deliberately. (Track structure is widely documented; exact equity percentages are **UNVERIFIED** here.) |
| Bonds / money-market / halacha / shekel | Lower risk. |

### 5.4 Returns
- The evidence collected is partial. **Do not quote these as forecasts.**
  - More's S&P 500 study-fund track: **+57.97% cumulative over 60 months** to mid-2026 [mygemel fund page via search].
  - In May 2026, S&P 500 study-fund tracks averaged +0.54% for the month vs +3.56% for equity tracks. As of May 2026, the S&P track was negative year-to-date and **equity tracks outperformed S&P tracks over all periods measured** (FUNDER, May 2026, via search).
  - A shekel-based investor in an S&P track carries USD/ILS risk unless the track hedges.
- **For a saver in their late 40s with an 18-year horizon (REASONING):**
  - equity-heavy tracks remain appropriate for long-dated pension money;
  - the guaranteed-return component (§2.3) already gives pension-fund savers a built-in bond-like anchor on 30% of fund assets;
  - consider total household allocation **across US and Israeli accounts together** (401(k), RSUs, rentals) rather than each account alone.

---

## 6. Insurance

### 6.1 Death and disability cover inside a comprehensive pension fund
**Typical default track** [S32 search summary; fund rules vary]:
- spouse's pension: up to **60%** of insured salary for life;
- orphans: about **40%** in total, to age 21 (longer for a dependent disabled child);
- disability: up to **75%** of insured salary;
- reduced-cover tracks exist (for example 37.5% disability / 40% survivors). Verify against the specific fund's rules (תקנון).

**Disability definition:** pension funds pay on loss of capacity in "any reasonable occupation". Partial disability bands vary [S32].

**Critical for households that moved abroad: what happens when deposits stop** [S13]:
- Cover continues automatically for **5 months** (ארכת ביטוח, insurance extension). The premiums are deducted from the balance.
- Before those 5 months end, the member can request a **temporary risk arrangement (הסדר ריסק זמני)**. It lasts as long as the last continuous deposit period, up to **24 months including the 5**.
- After that, re-insuring is possible only on **new underwriting**, based on current health.
- Manager's insurance: the comparable window is 3 months [S13].

**Implication (REASONING):** if a comprehensive fund has received no deposits since its member moved to the US, its disability and survivor cover has probably lapsed. **Confirm with the fund.** The family's protection then rests on any term life policy and US cover. The same check applies to each spouse's fund.

### 6.2 Disability insurance (אובדן כושר עבודה)
| | Inside a pension fund | Manager's insurance rider / standalone |
|---|---|---|
| Definition | "Any reasonable occupation" | Often own-occupation (עיסוקי), plus wider riders [S32] |
| Cap | 75% of salary in total [S32] | Same overall 75% cap across policies |
| Waiting period | Typically 90 days [S32] | Typically 90 days |
| Offset | Benefits are offset between policies, so paying twice can buy nothing extra [S32] | |
| Fit for a US-earning household | Israeli disability cover tied to Israeli salary is of limited value to someone earning in the US (REASONING). Check US employer long-term disability. | |

### 6.3 Health insurance and the 2016 reform [S24]
- **Uniform policy from 1 Jul 2016 (פוליסה אחידה):** standardised terms for surgery and procedures replacing surgery in Israel, sold by every insurer. Insurers compete on price only.
- **Base package:** transplants and special treatments abroad, drugs outside the public basket, and surgery abroad. More can be added separately.
- **Duplicate cover banned:** insurers may not sell duplicate health cover.
- **Renewal:** policies renew every 2 years. Price rises are capped (sources cite ₪10/month or 20%).
- **"Complement to HMO supplementary plan" (משלים שב"ן):** surgery cover that pays above the HMO supplementary plan. A further reform in 2023 changed this; details are not verified here.
- **Relevance:** Israeli private health policies usually require Israeli HMO membership. While living in the US, check whether they are paying premiums on Israeli health policies they cannot use. Consider freezing (הקפאה) rather than cancelling if return is plausible, to avoid new underwriting later (**UNVERIFIED**: availability of freeze options varies by insurer).

### 6.4 Finding duplicate cover and lost money
| Tool | What it shows | Cost |
|---|---|---|
| **הר הביטוח** (Insurance Mountain, Finance Ministry) | All insurance policies (life, health, disability, property) at all insurers | Free [S33] |
| **מסלקה פנסיונית** (pension clearing house) | Full detail on pension funds, provident funds, study funds, manager's insurance and their insurance cover | Small fee, about ₪20 for a full report, delivered within hours (date of figure unknown) [S33] |
| **הר הכסף** (Money Mountain, Finance Ministry + Bank of Israel) | Lost and inactive accounts, including those of deceased relatives | Free [S33] |

Warning: use only the official sites. Paid look-alike sites exist [S33].

---

## 7. Tax

### 7.1 Israeli residency [S25]
- **Basic test:** residency is decided by **center of life (מרכז חיים)**: home, family, business, social ties.
- **Rebuttable presumptions:**
  - 183+ days in Israel in the tax year; or
  - 30+ days in the year and 425+ days over that year and the previous two.
- **"Four-year alternative" for leavers:** 183+ days abroad in each of two consecutive years, and center of life abroad in the following two years, leads to non-residency from the date of leaving [S25 / Capitax via search].
- **A 2025 draft bill** would introduce weighted-day tests, for example an Israeli citizen with 75 days a year being presumed resident. **Not confirmed as enacted (UNVERIFIED).**

### 7.2 Returning residents (תושב חוזר ותיק / תושב חוזר) and the 2026 changes
**Definitions:**
- **Veteran returning resident (תושב חוזר ותיק):** a non-resident for **10+ consecutive years** before returning [S14].
  - **Section 14(a):** 10 years of exemption on income produced or accrued abroad, or derived from assets abroad, from the date residency resumes [search summary of Capitax / Bizportal].
- **Returning resident (תושב חוזר), the regular category:** a 5-year exemption on passive foreign income (pension, royalties, rent, interest, dividends) [Bizportal via search].
  - The usual definition is 6+ years abroad. **Not confirmed in this research (UNVERIFIED).**

**Amendment 272 (2024 law): the reporting exemption ends.**
- For olim and returning residents who become residents **from 1 Jan 2026**, the 10-year exemption from **reporting** foreign income and assets is cancelled.
- The **tax** exemption remains, but exempt foreign income must be reported annually [S15].
- People who arrived by 31 Dec 2025 keep the old exempt-and-no-reporting regime [S15].

**New temporary provision, "Encouraging Aliyah and Return" (Economic Efficiency Law 2026, in force 31 Mar 2026)** [S14, Tax Authority circular 7/2026, 5 Jul 2026]:
- **Who qualifies:** a new immigrant or **veteran returning resident** (10+ years abroad, **holding a returning-resident certificate** from the Ministry of Aliyah) who **moves their center of life to Israel between 5 Nov 2025 and 31 Dec 2026**.
- **What is exempt:** **Israeli-source earned income** (salary and business) up to an annual cap.

| Tax year | Exemption cap |
|---|---|
| 2026 | ₪600,000 (pro-rated in the arrival year) |
| 2027 | ₪1,000,000 |
| 2028 | ₪1,000,000 |
| 2029 | ₪350,000 |
| 2030 | ₪150,000 |

- **Limits:**
  - Capital income, interest and dividends are not covered.
  - Income from a relative (קרוב) is capped at ₪140K per year.
  - Mid-year relief through a tax coordination request (תיאום מס) is capped at ₪500K (₪300K if not registered to file a return); the rest is claimed in the annual return [S14].
- **Relevance (REASONING):** this applies only to someone who has been a non-resident for 10+ years **and** actually relocates by **31 Dec 2026**. If either condition fails, ignore it. **The advisor should ask when the household left Israel.**

### 7.3 Foreign income of Israeli residents; capital gains and surtax
- Israeli residents are taxed on **worldwide income**, with credit for foreign tax under treaties (general rule; the US–Israel treaty applies).
- **Capital gains and dividends:**
  - **25%** on real gains and dividends for individuals;
  - **30%** for a "substantial shareholder" (10%+ of a company);
  - higher rates (33% / 35%) appear in some summaries for interest and dividends of substantial shareholders [Capitax / Bizportal via search].
- **Surtax (מס יסף), 2025–2026:**
  - **3%** on all taxable income above **₪721,560 per year** (₪60,130/month), frozen;
  - plus an **additional 2% on capital income** (capital gains, dividends, interest, rent) above that threshold, so **5% in total on capital income above the threshold** [S1, moneyplan via search].
  - **CONFLICT:** one source's wording is unclear about how the 2% interacts with the threshold. Confirm with the Tax Authority.
- **2026 brackets** for income from personal exertion: 10% up to ₪84,120; 14% to ₪120,720; 20% to ₪193,800; 31% to ₪269,280; 35% to ₪560,280; 47% to ₪721,560 [S1]. Credit point value: ₪242/month [S1].

### 7.4 Tax relief for pension deposits (sections 45א and 47) [S1]
**Employee (section 45א credit):**
- Credit of 35% on deposits of up to 7% of insured salary, on a salary ceiling of **₪9,700/month**.
- Maximum creditable deposit: ₪679/month. Maximum credit: ₪237.65/month.

**Employer contributions:**
- Not attributed as taxable income up to salary ceilings of ₪34,423/month (benefits) and ₪45,600/month (severance) [S1].

**Self-employed / "beneficiary member" (עמית מוטב):**
- Qualifying-income ceiling: ₪232,800 per year.
- **Section 47 deduction:** 11%, up to ₪25,608.
- **Section 45א credit:** 5.5%, up to ₪12,804.
- Maximum deposit to use every benefit: ₪45,060. Maximum tax benefit: ₪38,412.
- "Beneficiary member" means someone with pension deposits of at least 16% of the average wage (₪26,436 per year in 2026) [S1].

**Relevance:** these credits only reduce **Israeli** tax. Non-residents with no Israeli income get nothing from them (REASONING).

### 7.5 No inheritance tax
- Israel has **no estate, inheritance or gift tax**. Gifts of real estate pay a reduced purchase tax [S21, Chambers 2026 via search].
- Chambers 2026 notes that the Tax Authority has considered an inheritance tax. **Nothing has been enacted.**
- US estate and gift tax rules depend on US status (see US doc).

### 7.6 Scenario A: they stay in the US
**Israeli pension savings stay in place** and keep growing.

**Withdrawal:**
- The normal triggers still apply: retirement age, a minimum-pension check, commutation.
- **Leaving Israel is not, by itself, a ground for withdrawing pension money.**
- An early withdrawal of benefits money is withheld at **35%** (section 87) [S23].
- The Israeli fund withholds by Israeli rules and does not analyse the treaty or the foreign law [S23].

**Exit tax (section 100A):**
- A deemed sale at the date residency ends, on the real capital component accrued until then.
- The Tax Authority **may** examine early pension withdrawals under it [S23].

**US–Israel treaty:**
- The **saving clause (Article 6(3))** lets the US tax its citizens and residents as if there were no treaty.
- **Article 20 covers private pensions; Article 21 covers Social Security** [IRS treaty text via search; S30].
- **The US treatment of Israeli pension contributions and growth for US persons is unresolved in the sources (CONFLICT).** Defer to the US doc.

**Continuing deposits:**
- No authoritative source was found on whether a non-resident with no Israeli income can keep depositing to an Israeli pension fund or study fund (**UNVERIFIED**).
- Tax benefits require Israeli earned income (§3.4, §7.4), so new deposits would be after-tax with no Israeli benefit. For US persons, they would add US complexity (REASONING).
- A pension fund cannot keep insurance cover alive indefinitely without deposits (§6.1).

**Practical points:**
- Keep the funds' contact details current. Register beneficiaries.
- File a non-residency declaration where required.
- Keep an Israeli bank account for payouts. Some funds pay only to Israeli accounts (**UNVERIFIED**).

### 7.7 Scenario B: they move back to Israel
- **Residency** resumes on moving the center of life.
- **Status depends on the length of absence:**
  - 10+ years: veteran returning resident, with 10 years of foreign-income tax exemption (now with annual reporting, §7.2), plus the 2026 temporary provision if they arrive by 31 Dec 2026;
  - shorter absences: regular returning resident, or no special status.
- **US 401(k) and US rentals:** Israeli tax on them during the exemption period depends on that status. US-source rental income stays taxable in the US. Plan the timing of 401(k) distributions and RSU vesting around the exemption window (REASONING; see US doc).
- **Israeli pension:**
  - deposits resume through an Israeli employer under the mandatory pension rules (§1.1);
  - comprehensive-fund cover requires new deposits, and lapsed cover may need underwriting (§6.1);
  - section 45א/47 credits apply again.
- **Study fund:** new deposits through an Israeli employer. The 6-year clock starts again for new money only (REASONING).
- **If one of them is a US citizen,** US taxation continues after the move regardless of where they live. The Israeli exemptions do not reduce US tax.

---

## 8. Savings for Every Child (חיסכון לכל ילד)

- **Law and scheme:** Social Security (ביטוח לאומי) deposits a monthly amount for every child who receives child allowance, into a bank or provident-fund account chosen by the parents [S17].
- **State deposit:** **₪58/month per child from 1 Jan 2026** [S17].
- **Parental top-up:** parents may add another ₪58, taken from the child allowance, bringing the total to ₪116. Only about 63% of parents did so at end-2025 [S17 / BTL 2025 report via search].
- **Tracks:** provident-fund tracks by risk level (low, medium, high risk, halacha), or a bank deposit. The default is age-based.
  - From 18, if the money is not withdrawn, it moves into a renewing fixed-rate track and can be switched [S18].
  - Social Security pays management fees until age 21; after that they are charged to the account [S18].
- **Withdrawal:**
  - from **18** with a parent's signature until 21; from **21** without one [S18];
  - **bonus at 21 if nothing has been withdrawn before then:** ₪500 indexed. Sources show different current figures (₪568–582), **CONFLICT**, reflecting indexation and publication dates [S18];
  - **a partial withdrawal before 21 cancels the bonus** [S18].
- **Age-18 grant:**
  - children born **up to end-2016** receive an age-18 grant;
  - children born from 2017 instead receive ₪291 at age 3 and ₪291 at age 12/13 [S18].
- **A child aged 18–20:**
  - waiting until 21 earns the bonus;
  - the account is then a provident fund the child may keep long-term;
  - once 18, they control the investment track decision with a parent's co-signature until 21.
- **How to check an account:**
  - the parent's personal area on the Social Security site;
  - the managing bank or provident fund;
  - the pension clearing house / Gemel-Net (**UNVERIFIED**: no explicit BTL instructions were found; BTL refers savers to the managing body [S18]).
- **Non-resident caveat (REASONING, UNVERIFIED):** deposits are tied to Israeli child allowance. If the family's Israeli residency for Social Security purposes ended, both the allowance and the deposits may have stopped. **Check each child's account history.**

---

## 9. Other Israeli investment tools

- **Bank of Israel rate:** **3.25%**, held at the 20–21 Oct 2026 meeting. The rate was cut to 4% in January 2026 and later reached 3.25%; the intermediate steps were not reconstructed [S20].
- **Shekel deposits and money-market funds:** yields track the policy rate. Interest is taxed at 25% (15% on CPI-linked interest; **UNVERIFIED** in this research).
- **Government bonds:**
  - "Shahar" (שחר) is fixed-rate shekel; "Galil" (גליל) is CPI-linked.
  - Traded on TASE or bought at Treasury auctions.
  - The real gain is taxed at 25%.
  - Current yields were **not verified**.
- **Israeli ETFs (קרנות סל) and index mutual funds:**
  - low cost, accessible through Israeli brokers and banks;
  - **for US persons they are PFICs**, a strong reason to avoid them, so hold US-domiciled ETFs instead (REASONING; see US doc);
  - the January 2026 mutual-fund fee rises were reported by Funder (via search).
- **Real estate in Israel, purchase tax on an additional apartment in 2026** [S19]:
  - **8%** on value up to **₪6,055,070**, and **10%** above. No exempt band.
  - Example: ₪2M apartment → about ₪160K tax.
  - The 8%/10% rates are a **temporary provision due to expire at end-2026**. Because the Knesset dissolved, one source says it stays in force for purchases until **10 Feb 2027** under section 38 of Basic Law: The Knesset (single source, **UNVERIFIED**).
  - For comparison, single-apartment bands in 2026: exempt to ₪1,978,745; 3.5% to ₪2,347,040; 5% to ₪6,055,070; 8% to ₪20,183,565; 10% above. Frozen until January 2028 [S19].
  - Selling the previous home within the window (generally 24 months for 2026 purchases, extended 3 months after a military operation) avoids "additional apartment" status [S19].
  - Purchase tax benefits for olim / returning residents exist but were **not researched**.
  - Rental income has its own tracks (exempt ceiling / 10% / marginal). **Not researched; the 2026 figures are UNVERIFIED.**

---

## 10. General checklist for a cross-border Israeli household (ranked)

(The ranked checklist for this specific household, with its figures, lives in private-data/advisor/israel-household.md.)

1. **Pull a full pension clearing house report and an Insurance Mountain report for both spouses** (§6.4). This confirms balances, fees, insurance status, capital/annuity split and policy start dates. Every later decision depends on it.
2. **Confirm the insurance status of each comprehensive pension fund** (§6.1). If no deposits have been made for 5+ months, the disability and survivor cover has probably lapsed. Size total life cover (Israeli term policies plus US employer cover) against needs such as dependent children and mortgages. Remove duplicates; fill gaps.
3. **For any manager's insurance policy with cap-level fees (e.g. 4% / 1%):** get the start date, the guaranteed conversion factor by age, the capital/annuity split and the cost of the insurance component. If there is no valuable guaranteed factor, moving to a low-fee general or comprehensive pension fund can save roughly 0.8% of the balance per year (§2.2, §2.5); if there is one, keep it and negotiate the fee. Ask who is depositing and from which payroll: Israeli payroll deposits bring in the mandatory pension and tax-credit rules.
4. **For any policy quoting a conversion factor:** is it guaranteed, and at what age? Compare with a quoted pension-fund factor at the statutory retirement age, and with fees.
5. **Consolidate small frozen policies and provident funds** into one low-fee vehicle after checking each for a guaranteed factor or capital money (§1.2, §2.6). This reduces fees and simplifies cross-border reporting (each account may be a separate FBAR / 8938 line, per the US doc).
6. **Decide the future of liquid study funds:** for US persons expecting to stay in the US, consider tax-free withdrawal in Israel and redeploying into US-efficient vehicles to end the PFIC / foreign-trust uncertainty (§3.4); if a return to Israel is likely, keeping them preserves Israeli tax-free compounding. This depends on the US doc.
7. **Plan for the age-50 track switch** in pension funds (§5.3). Choose the track deliberately in light of total allocation across US and Israeli accounts.
8. **Resolve US status (green card vs citizen) and residency facts**, including the year the household left Israel (§7.1, §7.2). A citizen is US-taxable everywhere, for life; a green-card holder who moves back can end US residency, subject to the expatriation rules in the US doc. The 2026 temporary provision requires 10+ years abroad and moving by 31 Dec 2026 (§7.2).
9. **Children's savings accounts** (§8): check whether deposits continued after the move; a child aged 18–20 should avoid withdrawing before 21 to keep the bonus, unless the money is needed; review investment tracks.
10. **Fee negotiation** on every account (§2.7): target balance fees of 0.1–0.25% on pension money and about 0.5% or less on study funds and provident funds, anchored on the default-fund terms [S2].
11. **Estate hygiene:** update beneficiary designations (מוטבים) on every Israeli fund and policy; Israel has no inheritance tax, but US estate exposure may apply (§7.5); make sure Israeli funds will pay out smoothly to survivors living abroad.
12. **Do not withdraw pension (benefits) money early:** 35% withholding plus possible US tax [S23]. If it is ever considered, get a combined Israeli/US opinion first.

---

## Open questions the advisor must ask before giving specific advice
- **US status of each spouse** (citizen / green card / visa) and the **year they left Israel**.
- Are they **considering returning** to Israel, and when?
- **Who is depositing** into any product marked "active", and from which payroll?
- **Start dates and guaranteed factors** of all manager's insurance policies.
- Current **insurance cover** inside each pension fund and policy.
- Whether the **children's savings** deposits continued after the move.

---

## Sources
Dates are publication or last-update dates where known. "Accessed" means the page was read during this research (Nov 2026). Several sources were read only through search-engine summaries; this is noted.

- [S1] More Gemel & Pension, "תקרות וסכומים לשנת 2026" (PDF, metadata dated 18 Jan 2026). Covers ceilings, brackets, surtax, minimum pension, section 45א/47 and Amendment 190 caps. https://www.moreinvest.co.il/media/ob5nzn0o/תקרות-וסכומים-2026.pdf. Corroborated for the investment provident fund and study fund figures by fnx.co.il, mygemel.net and Harel 2026 ceiling PDFs (search summaries).
- [S2] TheMarker Supermarker, "קרנות פנסיה ברירת מחדל – תשובות לכל שאלה", updated 9 Feb 2026. https://www.supermarker.themarker.com/Pension/DefaultPensionFundsQuestionsAndAnswers.aspx
- [S3] TheMarker Supermarker, "ניוד חסכונות", updated 16 Jan 2026. https://www.supermarker.themarker.com/Gemel/TransferringProvidentFundAndPensionSavings.aspx
- [S4] Bizportal, Anat Gilad, article on the qualifying-pension exemption / 161ד, 12 Jul 2026. https://www.bizportal.co.il/longtermsavings/news/article/20035682
- [S5] Kol Zchut, "משיכת סכום חד פעמי מקרן הפנסיה בפרישה (היוון קצבה)", figures stated "נכון לשנת 2026". Read through search summary because the site returned 403. https://www.kolzchut.org.il/he/משיכת_סכום_חד_פעמי_מקרן_הפנסיה_בפרישה_(היוון_קצבה)
- [S6] National Insurance Institute, retirement-age table. Accessed Nov 2026 through search summary. https://www.btl.gov.il/benefits/old_age/Conditions_of_eligibility/gilMezake/Pages/gilPrisha.aspx
- [S7] Kol Zchut, "ביטוח פנסיוני לעובדים". Accessed Nov 2026 through search summary. https://www.kolzchut.org.il/he/ביטוח_פנסיוני_לעובדים
- [S8] Bizportal guide on pension fees (2026): legal 6% / 0.5%, market average 1.64% / 0.16%. https://www.bizportal.co.il/guides/news/article/20041429
- [S9] Bizportal, "כמה באמת עולים לכם דמי הניהול?" (4% / 1.05% caps; date not shown). https://www.bizportal.co.il/additives/402/management-fee.html
- [S10] Bizportal, article on guaranteed conversion factors (2026; exact date not captured). https://www.bizportal.co.il/longtermsavings/news/article/20038022
- [S11] Bizportal, conversion-factor calculator 2026. https://www.bizportal.co.il/additives/346/pension-coefficient.html
- [S12] Accountant General, Ministry of Finance, return-completion guarantee report for 2025 (PDF). https://www.gov.il/BlobFolder/dynamiccollectorresultitem/pension-funds-guaranteed-return-completion-2025/he/pension-funds-guaranteed-return-completion_pension-funds-guaranteed-return-completion-2025-file1.pdf. Mechanism description also from Calcalist and Bizportal through search.
- [S13] Altshuler Shaham, "שמירה על ביטוח בקרן הפנסיה בהעדר הפקדות" (accessed Nov 2026 through search summary), and Kol Zchut "הסדר ריסק בביטוח פנסיוני". https://www.as-invest.co.il/interstedin/gemel/שמירה-על-ביטוח-בקרן-הפנסיה-בהעדר-הפקדות/
- [S14] Israel Tax Authority, Income Tax Circular 07/2026, "הוראת השעה חוק עידוד עלייה לישראל וחזרה אליה", 5 Jul 2026. https://www.gov.il/BlobFolder/service/tax-relief-new-immigrants/he/IncomeTax_hozer-7-2026-acc.pdf
- [S15] Gornitzky, client update, 12 Nov 2025 (https://www.gornitzky.com/?p=29433); Globes, "Tax reporting puts potential immigrants under pressure" (https://en.globes.co.il/en/article-1001524320); Ynetnews, "Tax changes for immigrants and repatriates" (undated) (https://www.ynetnews.com/business/article/sjqb2znir). These cover Amendment 272 and the end of the reporting exemption from 1 Jan 2026.
- [S16] Ministry of Finance, "הצוות לצמצום הפערים במכשירי השקעה בחיסכון לטווח קצר ובינוני – דו"ח מסכם", July 2026, hosted by Capitax. https://www.capitax.co.il/Attachments/arbitrage_committee-07-2026.pdf
- [S17] National Insurance Institute, "תכנית חיסכון לכל ילד" (₪58 from 1 Jan 2026). https://www.btl.gov.il/benefits/children/hisaholayeled/pages/default.aspx. BTL 2025 report press release (63% parental top-up): https://www.btl.gov.il/About/news/Pages/NIOIReport2025chisachon-lekol-yeledN.aspx
- [S18] National Insurance Institute, "משיכה של כספי החיסכון" (https://www.btl.gov.il/benefits/children/HisahoLayeled/Pages/MeshihaHisahon.aspx), plus Leumi and Bank Hapoalim terms pages for the age-21 bonus amount (search summaries).
- [S19] Nadlan Center, "מס רכישה דירה שניה – המדריך השלם לשנת 2026" (https://www.nadlancenter.co.il/article/3023); Bizportal guide on purchase-tax expiry and the 10 Feb 2027 extension (https://www.bizportal.co.il/guides/news/article/20045315); Madlan blog 2026 bands.
- [S20] Bank of Israel, "סיכום דיוני הריבית אוקטובר 2026" (published about 4 Nov 2026). https://boi.org.il/media/4d0dmgwj/סיכום-דיוני-הריבית-אוקטובר-2026.pdf. January 2026 decision: https://boi.org.il/media/odbnnh0j/החלטת-ריבית-05012026.pdf
- [S21] PwC Worldwide Tax Summaries, Israel – Individual – Other taxes. Accessed Nov 2026. https://taxsummaries.pwc.com/Israel/Individual/Other-taxes. Chambers Private Wealth 2026 (Israel), via search.
- [S22] IRS Rev. Proc. 2020-17 (2 Mar 2020), as summarised by EY Tax News, 5 Mar 2020 (https://taxnews.ey.com/news/2020-0508-irs-exempts-us-citizens-and-residents-from-foreign-trust-information-reporting-requirements-for-certain-foreign-tax-favored-retirement-medical-disability-and-educational-trusts) and KPMG Flash Alert 2020-044.
- [S23] BSH CPA, "מיסוי בעת משיכת כספי פנסיה ברילוקיישן והחשיפה לטענת מס יציאה", 5 May 2026. https://www.bshcpa.co.il/pension-withdrawal-relocation-exit-tax/
- [S24] TheMarker Supermarker, "רפורמת ביטוחי הבריאות מפברואר 2016". https://www.supermarker.themarker.com/BituachBriut/HealthInsuranceReform.aspx
- [S25] Kol Zchut, "תושב ישראל" (accessed Nov 2026 through search summary). https://www.kolzchut.org.il/he/תושב_ישראל. Capitax pages on the four-year alternative.
- [S26] Bizportal, study-fund withdrawal (3-year retirement-age exception), 2026. https://www.bizportal.co.il/longtermsavings/news/article/20038011
- [S28] TheMarker Supermarker, "מה זו פוליסת חיסכון", with savings-policy comparison data to Sep 2026. https://www.supermarker.themarker.com/MenahalimInsurance/WhatIsSavingsPolicy.aspx
- [S29] AP via ABC News, "Israel's parliament dissolves ahead of Oct. 27 elections", 17 Jul 2026. https://abcnews.com/International/wireStory/israels-parliament-dissolves-ahead-oct-27-elections-134839937
- [S30] US–Israel Income Tax Treaty, IRS. https://www.irs.gov/pub/irs-trty/israel.pdf. Read through secondary summaries (Greenback, TaxesForExpats), not directly.
- [S32] Bizportal guides on disability insurance and pension survivor cover (2026). https://www.bizportal.co.il/guides/news/article/20038732 and https://www.bizportal.co.il/career/news/article/20036213
- [S33] TheMarker Supermarker, pension clearing house guide (https://www.supermarker.themarker.com/Pension/PensionClearingHouse-WheresMyMoneyAt.aspx) and Money Mountain guide (https://www.supermarker.themarker.com/Account/IturMountainMoney2.aspx).
- [S34] Analyst, appendix on Amendment 190 / Form 190 2026 (PDF, 2026). https://www.analyst.co.il/wp-content/uploads/2026/04/טופס-190-2026-1.pdf. Read through search summary.

Last verified: 2026-11-21
