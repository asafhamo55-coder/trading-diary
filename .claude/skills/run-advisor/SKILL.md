---
name: run-advisor
description: Generate the household financial advisor report for Hamo Home Equity and save it into the app. Use when the user asks to "run the advisor", "update my recommendations", "refresh the financial analysis", or when the daily advisor routine fires.
---

# Run the household advisor

The app does not call any paid LLM. This skill runs inside Claude Code on the user's
Claude subscription. It reads the household snapshot from the app, reasons over it with
the researched knowledge base, and posts a structured report back. The dashboard then
shows it in the "Advisor" panel.

## Inputs

- `HAMO_BASE_URL`: defaults to `https://trading-diary-lilac.vercel.app`.
- `SAVINGS_INGEST_TOKEN`: a bearer token, matching the Vercel env var of the same name.
  Read it from the environment, or from the gitignored `private-data/.savings-token`
  when running locally. Never print it, and never write it into any committed file.

## Steps

1. **Fetch the context.**
   ```bash
   curl -sf -H "Authorization: Bearer $SAVINGS_INGEST_TOKEN" "$HAMO_BASE_URL/api/savings/advisor/context" > /tmp/advisor-context.json
   ```
   It returns `{ inputHash, unchangedSinceLastReport, latestReportAt, system, outputSchema,
   snapshot, previousRecommendations, dismissedRecommendations, previousOpportunityTitles }`.
   - If `unchangedSinceLastReport` is true and the latest report is under 7 days old,
     stop and say nothing changed. A scheduled run should still re-run weekly, because
     laws and rates change.
   - `previousRecommendations` is the last report's recommendation ids, titles and action
     items, each with `done` (ticked by the user in the app).
   - `dismissedRecommendations` is what the user marked **not relevant** in the app (id,
     title, `reason`, date). Never recommend these again — not under the same id and not
     the same idea reworded — unless the snapshot shows a material change that makes it
     relevant. Treat each `reason` as a fact about the household and apply it to related
     recommendations too (e.g. "we're selling that property" changes every rec for it).
   - `snapshot.taxReturns` (when present) is the household's **filed** US federal and
     Georgia returns for the last two years plus `reconciliation` (each rental's latest
     declared Schedule E vs this year's books annualized). The filed return is ground
     truth for what was declared: never recommend claiming what it already claims
     (depreciation, FTC, HSA, home office); use its wages/AGI/bracket for every tax
     estimate, total payments vs total tax for withholding, suspended passive losses and
     carryovers; turn each reconciliation diff into a data-fix or "ask the CPA" item.
     Never output account numbers.
   - `previousOpportunityTitles` is the investment ideas suggested last time; rotate them.
2. **Read the knowledge base** in `docs/advisor/knowledge/`: `israel.md` and
   `us-and-cross-border.md`. Treat the figures in them as of their "Last verified" date.
   If a figure that drives a recommendation is more than about 6 months old, or the year
   has rolled over (contribution limits, tax brackets), check it with a quick web search
   and say so in `benefit.basis` / `why`.
   - **When running locally, also read `private-data/advisor/*.md` if present**
     (`israel-household.md`, `us-household.md`). These gitignored companions hold the
     household-specific notes, checklists and open questions that were kept out of the
     public knowledge docs. They may be absent (e.g. in a cloud routine); then rely on the
     snapshot alone. Never copy their contents into a committed file.
3. **Reason as the advisor.** Follow the `system` brief from the context exactly. Combine:
   - the household facts from the snapshot (ages, goals, accounts, fees, coverage
     duplicates and gaps, data gaps, cash flow);
   - `snapshot.tradingGuidelines` if present (the stocks account's SPY/QQQ/large-cap/cash
     targets, drift and dip signals) under the `allocation` theme — use its `actions`
     verbatim as action items rather than inventing trades;
   - the law and instrument rules and thresholds from the knowledge base;
   - Israel–US cross-border interactions: PFIC, FBAR/8938, the treaty, and
     relocation scenarios.

   The user wants **clear direction — money on the table to pick up fast — and a
   high-level view they can drill into, ranked by benefit**. So:
   - **Decisive, imperative wording.** Name the provider, the exact ask, the number, the
     form and the deadline. No hedging ("consider", "you may want to") unless a fact is
     genuinely unknown — then say what is unknown and make the first action item how to
     find it out.
   - **`quickWins[]`** ("Money on the table — act this week"): 3–5 entries, each a `recId`
     of a recommendation in this report plus one imperative `directive` sentence ending
     with the saving (e.g. "Call <provider> and ask to cut the accumulation fee from 1.00% to
     0.20% — saves ~$3,200/yr"). Pick the best `tenYearUsd ÷ effort` that are
     high-confidence and doable within ~2 weeks. The server rejects unknown `recId`s.
   - **Bilingual.** Every text field is `{ "en": "...", "he": "..." }` (see `outputSchema`):
     headline, summary bullets, directives, theme title/status, recommendation title,
     whatToChange, why, steps, action-item task and contact, basis, riskReduction, urgency
     note, risksIfIgnored, questions, disclaimers. Write natural Israeli financial Hebrew
     (not a literal translation); keep Israeli product names native (קרן השתלמות, ביטוח
     מנהלים, ניוד) and US names/forms in Latin script. Numbers are identical in both.
     Missing Hebrew on the headline, summary, titles or directives fails validation.
   - **New investment ideas (`opportunities` theme), every run: 2–4 recommendations** for
     investment types the household doesn't hold today and that fit its profile. Draw from
     both the Israeli and US instrument sections of the knowledge base (e.g. קופת גמל
     להשקעה, self-directed Israeli IRA, Treasury/TIPS ladder, I-bonds, munis, mega-backdoor
     Roth, 529, HSA invested long-term, low-cost index ETFs in taxable, Israeli government
     bonds, REITs vs direct property, a dividend/covered-call sleeve inside the trading
     guidelines' cash reserve). Flag and avoid PFIC problems for US persons. Each is a full
     recommendation: why it fits (tax, liquidity, goals, any planned relocation), benefit
     range + basis, risks (`risksIfIgnored`), how to start (where to open, minimums), action
     items. Don't repeat `previousOpportunityTitles` unless something changed (say what).
     Fewer than 2 fails validation.
   - **Quantify everything you can.** For each recommendation fill `benefit`:
     `annualUsd` (recurring), `oneTimeUsd`, and `tenYearUsd = annualUsd × 12.006 +
     oneTimeUsd` (10 years compounded at 4% real — the ranking number). For risk items
     (insurance gaps, a missed filing, concentration) use a conservative expected value and
     explain it. `basis` must show the snapshot inputs and the arithmetic; when uncertain,
     give a range in `basis` and use its low end for `tenYearUsd`.
   - **Never invent numbers**, phone numbers or URLs. No snapshot/knowledge-base figure →
     say so, add a `questionsForUser` entry, and quantify only what you can.
   - **Be specific, no generic advice.** `whatToChange.current` → `.target` in concrete
     numbers; `why` cites the snapshot figure and the knowledge-base rule/threshold;
     `howToChange` is the ordered approach; each `actionItems[]` entry is one task small
     enough to tick off in one sitting: who does it (member key), who to contact (provider
     or professional, phone/URL only if known), what to ask for or which form to file
     (e.g. Form 161ד, FinCEN 114, 8938, a ניוד request), and `dueBy` when there is a date.
   - `urgency`: `critical` (money/cover lost now or deadline < 30 days), `high`, `medium`,
     `low`, plus `deadline` (YYYY-MM-DD) when one exists. `dependsOn` lists recommendation
     ids that must come first. `risksIfIgnored` says what happens if nothing changes.
   - **Review every US rental (mandatory).** `snapshot.realEstate.rentals[]` carries each
     property's address, rent, lease, vacancy, income/expenses by category for this year
     and last, NOI, cap rate, cash-on-cash, expense ratio, rent-to-value, tax facts and
     (when present) the full `record` (loans, insurance, property tax, management, basis).
     For each rental write property-level recommendations with `themeId: "real-estate"`,
     `propertyId` = its id and `subTheme`:
     - `revenue`: **web-search comparable rents by address/zip and cite source + date in
       `benefit.basis`**; renewal timing and escalators; vacancy; pet/parking/storage fees.
     - `profit`: expense outliers vs typical ratios, insurance re-shop, property-tax appeal
       before the deadline, utilities pass-through, management fee vs benchmark, refinance
       if the rate is above market, PMI removal, pay down vs invest.
     - `tax`: depreciation captured, cost segregation when the basis justifies it, repairs
       vs improvements, passive-loss / real-estate-professional (ask about income), 1031
       before selling, LLC/umbrella, state property-tax exemptions and appeals.
     `realEstate.residence` is the primary home (value + mortgage only) — use it for
     refinance/HELOC/equity, not rental figures. The ingest rejects a report that leaves
     an active rental without a recommendation.
   - **Emails (`emails[]`)** for every recommendation where someone else must act (agent,
     provider, CPA, HR, property manager); `[]` otherwise. Never write account or policy
     numbers — use `{{account:<snapshot account id>}}` and list the ids in `accountIds`
     (the app fills in the real numbers locally). Use `contactId` from `snapshot.contacts`
     or the account's `contactId` when one fits. `language: "he"` for Israeli
     accounts/agents (a formal Israeli business letter to the סוכן ביטוח), `"en"` for US
     providers/HR/CPA/property managers (concise, professional). The body says who we are,
     which account, exactly what to do or check with numbers, which documents to send
     back, a reply-by date, and is signed with the owner's name. Set `actionItemId`.
   - `themes[]`: one per area assessed (fees, retirement, insurance, tax, allocation,
     opportunities, real-estate, education, cash, data) with a one-line `status` that has a number and a
     `tone` (`good` / `watch` / `act`). Include healthy themes with tone `good`.
   - `executiveSummary`: 3–5 bullets — net worth, retirement readiness vs goal, the
     biggest risk, and the total upside (sum of `tenYearUsd`, plus $/yr).
   - **Keep ids stable.** Recommendation `id` is a kebab-case slug (theme-member-subject).
     If a recommendation continues from `previousRecommendations`, reuse its `id` and copy
     continuing action-item `task.en` text verbatim — the app remembers ticked items by
     id + English task text. Drop items that are done unless something new is needed; don't re-add a
     finished recommendation.
   - Order doesn't matter: the server ranks recommendations by `benefit.tenYearUsd` (ties by
     urgency), quick wins by `tenYearUsd ÷ effort`, and sums each theme's benefit.
4. **Write the output** as JSON that matches `outputSchema` exactly, to
   `/tmp/advisor-output.json`. Self-check before posting:
   - it parses; it has `headline`, `executiveSummary` (3–5), `quickWins` (3–5, every
     `recId` exists), `themes`, `recommendations` (≥2 with `themeId: "opportunities"`);
   - every text field has both `en` and `he`;
   - every active rental in `snapshot.realEstate.rentals` has ≥1 recommendation with its
     `propertyId`; no email body contains a raw account/policy number;
   - every recommendation has a numeric `benefit.tenYearUsd`, a `basis`, non-empty
     `howToChange` and `actionItems`, and `done: false` on every item;
   - `tenYearUsd` ≈ `annualUsd × 12.006 + oneTimeUsd` unless it is a risk item explained in
     `basis`; every number traces to the snapshot or the knowledge base.
5. **Post it.**
   ```bash
   jq -n --slurpfile o /tmp/advisor-output.json --arg h "$(jq -r .inputHash /tmp/advisor-context.json)" \
     '{output: $o[0], inputHash: $h, model: "claude-code"}' \
   | curl -sS --fail-with-body -X POST -H "Authorization: Bearer $SAVINGS_INGEST_TOKEN" -H "Content-Type: application/json" \
       --data-binary @- "$HAMO_BASE_URL/api/savings/advisor/ingest"
   ```
   A 422 means validation failed; the error lists the offending fields. Fix and re-post.
6. **Report back** in a short summary: the headline, the total upside, the quick-win
   directives, the new investment ideas, and any questions for the user.

## Notes

- This is educational analysis, not licensed advice. Keep the disclaimers in the output.
- Do not include national ID or SSN numbers in the output.
