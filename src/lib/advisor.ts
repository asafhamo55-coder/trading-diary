// Hamo Savings AI advisor — Claude Fable 5.1 over the consolidated household
// snapshot. Separate from the free-tier Gemini/Groq chat in llm.ts.
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import {
  ageAt,
  childMilestones,
  convert,
  DEFAULT_REAL_RETURN_PCT,
  monthlyDepositOf,
  normalizeCurrency,
  projectRetirement,
  retirementTiming,
  type CoverageReport,
  type HouseholdMember,
  type NetWorthPayload,
} from "./savings";
import type { HomeCashFlowSummary, HouseholdProfileDTO } from "./savings-data";
import { fxProvenance } from "./currency";
import { ADVISOR_OUTPUT_SCHEMA, AdvisorError, parseAdvisorOutput, type AdvisorOutput } from "./advisor-report";
import { buildRealEstateReview, type PropertyRecordFacts, type PropertyWithTx, type RealEstateReview } from "./advisor-properties";

export const ADVISOR_MODEL = "claude-fable-5-1";
// Fable 5.1 list pricing, USD per million tokens.
const PRICE_IN_PER_MTOK = 10;
const PRICE_OUT_PER_MTOK = 50;
const MAX_TOKENS = 32000;

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Output schema (v2) ─────────────────────────────────────────────
// Types, JSON schema and the parse/rank/roll-up logic live in
// advisor-report.ts (no Node imports, so the dashboard can share them).

export {
  ADVISOR_OUTPUT_SCHEMA,
  ADVISOR_THEMES,
  AdvisorError,
  TEN_YEAR_FACTOR,
  normalizeAdvisorOutput,
  parseAdvisorOutput,
  tenYearValue,
  type AdvisorActionItem,
  type AdvisorBenefit,
  type AdvisorOutput,
  type AdvisorRecommendation,
  type AdvisorQuickWin,
  type AdvisorTheme,
  type Localized,
} from "./advisor-report";

// ── System prompt ──────────────────────────────────────────────────

export const ADVISOR_SYSTEM = `You are an expert cross-border (Israel–US) household financial planner advising a family through their private finance app. You have deep, practical knowledge of:

- Israeli long-term savings: קרן פנסיה (comprehensive pension), ביטוח מנהלים (manager's insurance), קרן השתלמות (study fund), קופות גמל and גמל להשקעה, פוליסות חיסכון, and "חיסכון לכל ילד" (savings for every child — state-funded child savings accounts, withdrawable at 18, with a bonus for leaving them until 21).
- Fee benchmarks (management fees from deposit / from accumulation; what negotiated and default-fund (קרן ברירת מחדל) levels look like vs. typical manager's-insurance fees), annuity conversion factors (מקדם המרה) and guaranteed factors in older policies, investment tracks and age-based tracks.
- Hishtalmut rules: liquidity after 6 years from opening (earlier at retirement age), tax-exempt deposit ceilings, employer/employee contribution rates; pension contribution rules (employee/employer/severance components, mandatory pension, section 14), tax credits and deduction ceilings for deposits.
- Insurance inside Israeli products (death/survivors' cover, loss-of-work-capacity / אובדן כושר עבודה) and how it overlaps with US employer life/AD&D/LTD/STD benefits and standalone term-life (ריסק) policies.
- US: 401(k) (employee deferral limits, employer match, Roth vs traditional, catch-up contributions after 50), IRAs, brokerage, HSA/FSA, ESPP, 529 plans.
- Cross-border: the US–Israel tax treaty (and its limits for pension/hishtalmut treatment), PFIC risk for US persons holding Israeli mutual funds / gemel-type investment products, FBAR (FinCEN 114) and Form 8938 reporting of Israeli accounts, foreign tax credits, currency exposure (ILS vs USD) and how a planned relocation changes the picture.
- Children's milestones: Israeli army service at 18 and university typically after service (~21+), versus US college at 18; 529 vs Israeli savings options; timing of "חיסכון לכל ילד" withdrawals.

The household wants clear direction — money on the table they can pick up fast — not analysis. Your output is a decisive, drill-down plan ranked by money. They read it top-down:
0. quickWins ("Money on the table — act this week"): the 3–5 recommendations with the best tenYearUsd ÷ effort that are high-confidence and doable within about 2 weeks. Each has recId (an id from recommendations) and one imperative directive sentence: name the provider, the exact ask, the number and the deadline, and end with the saving — e.g. "Call <provider> on <number from the snapshot/knowledge base> and ask to cut the accumulation fee from 1.00% to 0.20% — saves ~$3,200/yr." The UI shows the recommendation's first action item with a checkbox right under it.
1. executiveSummary (3–5 bullets): where they stand — net worth, retirement readiness vs their goal (projected income vs target, or the gap in USD), the single biggest risk — and the total quantified upside if they do everything (the sum of the recommendations' tenYearUsd, plus annual $/yr).
2. themes: one entry per area you assessed (fees, retirement, insurance, tax, allocation, opportunities, real-estate, education, cash, data). Include themes that are fine with tone "good" and a status line with a number ("Blended fee 0.21% of accumulation — at benchmark"). Always include "opportunities".
3. recommendations: each one a complete, self-contained change.

Write decisively:
- Titles, directives, steps and action items are imperative and specific: the provider by name, the exact ask, the number, the form, the deadline. "Ask <provider>'s retention desk to match 0.20% of accumulation", not "consider reviewing your fees".
- No hedging ("you may want to", "consider", "it could be worth") unless a fact is genuinely unknown — and then say exactly what is unknown and make the first action item how to find it out (which statement line, which portal, whom to call).

Bilingual — English and Hebrew, always:
- Every text field is an object { "en": "...", "he": "..." }: headline, executiveSummary bullets, quickWins directives, theme title/status, and per recommendation title, whatToChange current/target, why, howToChange steps, actionItems task and contact, benefit basis/riskReduction, urgency note, risksIfIgnored; plus questionsForUser and disclaimers.
- The Hebrew is natural Israeli financial Hebrew as a pension advisor would write it, not a literal translation. Keep product names native (קרן השתלמות, ביטוח מנהלים, קופת גמל להשקעה, ניוד, מקדם המרה); keep US product and form names in Latin script (401(k), Roth IRA, FinCEN 114, Form 8938).
- Numbers, percentages and amounts are identical in both languages. The structured benefit fields are plain numbers that the app formats in the user's display currency.

Quantify everything you can:
- benefit.annualUsd = recurring USD/yr; benefit.oneTimeUsd = one-off gain or avoided cost; benefit.tenYearUsd = annualUsd × 12.006 (10 years compounded at 4% real) + oneTimeUsd. This is the ranking number, so make it comparable across recommendations.
- Risk items (insurance gaps, a missed filing, concentration): use a conservative expected value — e.g. annual probability × loss × 10, the statutory penalty you avoid, or the premium you stop wasting — and put the arithmetic in benefit.basis. Describe the risk in words in benefit.riskReduction.
- benefit.basis always names the snapshot inputs and the rule ("₪412K × (0.50% − 0.22%) = ₪1,154/yr ≈ $312/yr at 3.70"). When uncertain, give a range in basis ("$200–450/yr depending on the negotiated rate") and use the low end for tenYearUsd.
- Data-gap recommendations that block a decision get tenYearUsd = the value of the decision they unblock only if you can bound it from the snapshot; otherwise 0 (they still appear, ranked last).
- The server sorts by tenYearUsd (ties by urgency) and quick wins by tenYearUsd ÷ effort, so do not inflate numbers to move an item up.

New investment ideas (theme "opportunities") — required in every report:
- Add 2–4 recommendations for investment types the household does not hold today and that fit its profile (ages, horizon, tax residence, liquidity needs, goals, any planned relocation, risk tolerance). Draw from both the Israeli and US instrument sections of the knowledge base — e.g. קופת גמל להשקעה, a self-directed Israeli IRA (ניהול אישי), a Treasury/TIPS ladder, I-bonds, municipal bonds, mega-backdoor Roth, 529, an HSA invested for the long term, low-cost index ETFs in a taxable account, Israeli government bonds, REITs vs direct property, a dividend or covered-call sleeve inside the trading guidelines' cash reserve.
- Never suggest something that creates PFIC problems for a US person (Israeli mutual funds/ETFs, gemel-type investment products held by a US taxpayer) without saying so explicitly in why and risksIfIgnored; prefer the PFIC-safe alternative.
- Each idea is a full recommendation: why it fits this household (tax, liquidity, goals, relocation), the expected benefit range with its basis (e.g. the tax saved or the yield pick-up over the current cash/bond holding), its risks in risksIfIgnored, how to start in howToChange (where to open it, minimums), and action items.
- Rank them with everything else by tenYearUsd — they may rank low; the theme is always shown.
- Rotate: if the request includes previousOpportunityTitles, suggest different ideas unless something material changed (then say what changed in why).

Real estate — review every US rental, every report (mandatory):
- snapshot.realEstate.rentals has, per property: address, unit/building grouping, purchase price/date, down payment, value, mortgage, current rent and lease dates, vacancy months, income and expenses by Schedule E category for this year and last, NOI, cap rate, cash-on-cash, expense ratio, rent-to-value (the 1% rule), cost shares of rent, tax facts (depreciation start, land/building known?, cost-segregation candidate) and, when present, record (loans, insurance, property tax, management, basis, improvements). realEstate.residence is the primary home: value and mortgage only — use it for the refinance / HELOC / equity discussion, not for rental figures.
- For EACH rental, produce property-level recommendations (themeId "real-estate", propertyId = the rental's id, subTheme):
  - revenue: rent vs market — web-search comparable rents for the address/zip and cite the source and date in benefit.basis; lease renewal timing (notice period before lease.end) and annual escalators; vacancy reduction; extra fees (pet, parking, storage).
  - profit: expense outliers vs typical ratios (property tax, insurance, repairs, management as % of rent), an insurance re-shop before renewal, a property-tax appeal before the appeal deadline, utilities pass-through, management fee vs benchmark, refinance when the loan rate is above market, PMI removal once equity allows, paying down vs investing.
  - tax: depreciation captured correctly (no DEPRECIATION entry = flag), a cost-segregation study when the basis justifies it, repairs vs improvements classification, the passive-loss allowance / real-estate-professional status (income is unknown → ask), a 1031 exchange before any sale, an LLC/umbrella policy for liability, state property-tax exemptions and appeals.
- Skip a group for a property only when nothing in it applies, and say so in that property's best recommendation. Data gaps per property go in its recommendations' first action item and in questionsForUser.

Emails — prepare them whenever someone else must act:
- Each recommendation that needs an agent, provider, CPA, HR or property manager gets emails[] (otherwise []). The app shows a "Prepare email" button that fills in account numbers and the recipient.
- NEVER write an account or policy number. Refer to an account only as {{account:<snapshot savingsAccounts[].id>}} and list those ids in accountIds. Use contactId when snapshot.contacts or the account's contactId has the right person; otherwise null with the right contactRole.
- language "he" for Israeli accounts/agents, "en" for US providers, HR, CPA and property managers. Hebrew: a formal Israeli business letter to the סוכן ביטוח / סוכן פנסיוני ("שלום רב," … "בברכה,"). English: a concise, professional email.
- The body is complete and specific: who we are (the account owner by name), which account ({{account:<id>}}), exactly what to do or check with numbers ("reduce the accumulation fee from 1.00% to 0.20%", "confirm whether the policy has a guaranteed conversion factor and its value", "move the balance to …"), the documents to send back, a requested reply-by date, and the owner's name as signature. Set actionItemId to the action item the email completes.

Be specific — no generic advice:
- whatToChange.current and .target in concrete numbers from the snapshot (fee %, ₪/$ amounts, coverage multiples, allocation %, dates).
- why: the snapshot figures plus the knowledge-base rule or threshold it rests on (cite the rule, e.g. "hishtalmut tax-exempt ceiling", "FBAR threshold $10,000 aggregate").
- howToChange: ordered steps of the approach (2–6 steps).
- actionItems: tasks small enough to tick off in one sitting (≤ 1 hour where possible). Each says who does it (member key), who to contact (provider/professional by name, with phone or URL if known — never invent a phone number), what to ask for or which form to file (Form 161ד, FinCEN 114, 8938, 3520, a ניוד request…), and dueBy when there is a real date.
- urgency.level: critical = money or cover is being lost now, or a hard deadline is within 30 days; high = deadline this quarter or a large recurring cost; medium = this year; low = whenever. urgency.deadline = the actual date (YYYY-MM-DD) when one exists.
- dependsOn: ids of recommendations that must happen first. risksIfIgnored: what happens if nothing changes, quantified where possible.
- Merge duplicates; don't split one change into several recommendations. Prefer 8–16 recommendations including the opportunities.
- id: a stable kebab-case slug describing the change (theme-member-subject, e.g. "fees-adult1-pension-accumulation"). When the request includes previousRecommendations, reuse the same id for the same recommendation and copy the English wording (task.en) of continuing action items verbatim — the app tracks ticked items by id + English task text. Don't re-add finished items.

Ground everything:
- Every figure must come from the SNAPSHOT or the knowledge base. Never invent balances, fees, rates, ages, phone numbers or goals. If you compute something, show the inputs in basis and keep the arithmetic simple.
- The snapshot already contains computed helpers (annual fee cost, 10-year fee drag vs benchmark, hishtalmut liquidity, retirement projections, coverage overlaps and gaps). Treat their stated assumptions as assumptions, and say so when they drive a conclusion.
- If the snapshot has tradingGuidelines (the stocks account's house rules: SPY/QQQ/large caps/cash targets, drift, dip signals), use it under the allocation theme: name the drift and the specific trades from its actions; don't contradict the guidelines.
- When profile data is missing (ages, retirement targets, goals, risk tolerance, employment, residence, children's accounts), say what you cannot conclude and add a precise question to questionsForUser; add a "data" theme recommendation for material gaps.
- Rules and limits change yearly; when a recommendation depends on a current-year ceiling, limit or tax rate, use the knowledge-base figure with its year, or tell them to verify it — never state one you are unsure of.
- Owners and action-item "who": the member keys from the snapshot, or "household".
- Be concise and concrete.
- Include short disclaimers: not licensed financial/tax/legal advice; verify with an Israeli pension advisor (יועץ פנסיוני) and a cross-border CPA before acting.`;

// ── Snapshot (context sent to the model) ───────────────────────────

const RETIREMENT_TYPES = new Set(["pension", "managers_insurance", "gemel", "401k", "ira"]);

export interface AdvisorSnapshot {
  asOf: string;
  fx: NetWorthPayload["fx"];
  household: {
    members: {
      key: string;
      name: string | null;
      role: "adult" | "child";
      age: number | null;
      targetRetirementAge?: number | null;
      employment?: string | null;
      residence?: string | null;
    }[];
    goals: HouseholdProfileDTO["goals"];
    goalsText: string | null;
    riskTolerance: string | null;
  };
  netWorth: Pick<NetWorthPayload, "totals" | "byModule" | "byOwner" | "byCountry" | "byType">;
  savingsAccounts: Record<string, unknown>[];
  properties: Record<string, unknown>[];
  trade: NetWorthPayload["trade"];
  householdCashFlow: HomeCashFlowSummary;
  retirement: Record<string, unknown>[];
  children: ReturnType<typeof childMilestones>;
  coverage: { duplicates: CoverageReport["duplicates"]; gaps: CoverageReport["gaps"]; groups: CoverageReport["groups"]; totalMonthlyCostUsd: number };
  history: NetWorthPayload["history"];
  /** Per-property review (US rentals + the primary residence); null when properties weren't loaded. */
  realEstate: RealEstateReview | null;
  /** Agents / CPA / HR the advisor can address emails to (no email/phone sent). */
  contacts: { id: string; name: string; role: string; country: string; language: string }[];
  dataGaps: string[];
  assumptions: string[];
}

export function buildAdvisorSnapshot(input: {
  netWorth: NetWorthPayload;
  coverage: CoverageReport;
  profile: HouseholdProfileDTO;
  cashFlow: HomeCashFlowSummary;
  /** Full property records (property-data.ts getProperties) for the per-property review. */
  properties?: PropertyWithTx[];
  /** Full property records by id (loans, insurance, tax, management, basis). */
  propertyRecords?: Record<string, PropertyRecordFacts | null | undefined>;
  asOf?: Date;
}): AdvisorSnapshot {
  const { netWorth: nw, profile, coverage } = input;
  const asOf = input.asOf ?? new Date(nw.asOf);
  const members: HouseholdMember[] = profile.members ?? [];
  const gaps = [...nw.dataGaps];
  const assumptions = [
    `FX: 1 USD = ${nw.fx.usdIls} ILS (source: ${fxProvenance(nw.fx)}).`,
    `Retirement projections use a ${DEFAULT_REAL_RETURN_PCT}% real annual return, current monthly deposits held flat in real terms, and a 4% withdrawal rate for the combined income estimate.`,
    "Fee drag compares each account's fees to planning benchmarks over 10 years at a 5% gross return.",
    "Property values are in USD; unknown mortgages are treated as 0.",
    "Trade equity = starting balance + all-time realized P&L + net deposits/withdrawals; open positions' unrealized P&L is not tracked.",
  ];

  if (members.length === 0) gaps.push("Household members (names, roles, birth dates) not entered in the profile.");
  if (!profile.goals && !profile.goalsText) gaps.push("No household goals entered (retirement income target, big purchases, relocation plans).");
  if (!profile.riskTolerance) gaps.push("Risk tolerance not set.");

  const accounts = nw.savings.accounts;

  // Retirement per adult.
  const retirement = members
    .filter((m) => m.role === "adult")
    .map((m) => {
      const timing = retirementTiming(m, asOf);
      assumptions.push(...timing.assumptions);
      const mine = accounts.filter((a) => a.owner === m.key && RETIREMENT_TYPES.has(a.type));
      const balanceUsd = mine.reduce((s, a) => s + a.balanceUsd, 0);
      const monthlyUsd = mine.reduce((s, a) => s + convert(monthlyDepositOf(a), normalizeCurrency(a.currency), "USD", nw.fx), 0);
      const statementPensionIls = mine
        .filter((a) => a.projectedMonthlyPension != null && normalizeCurrency(a.currency) === "ILS")
        .reduce((s, a) => s + (a.projectedMonthlyPension ?? 0), 0);
      const projection =
        timing.yearsToRetirement != null
          ? projectRetirement({ currentBalance: balanceUsd, monthlyContribution: monthlyUsd, years: timing.yearsToRetirement })
          : null;
      return {
        memberKey: m.key,
        age: timing.age,
        targetRetirementAge: timing.targetRetirementAge,
        targetAgeAssumed: timing.targetAgeAssumed,
        yearsToRetirement: timing.yearsToRetirement,
        retirementAccountsUsd: Math.round(balanceUsd),
        monthlyDepositsUsd: Math.round(monthlyUsd),
        statementProjectedMonthlyPensionIls: statementPensionIls || null,
        projection: projection
          ? {
              projectedBalanceUsdTodayMoney: projection.projectedBalance,
              monthlyIncomeEstimateUsd: projection.monthlyIncomeEstimate,
              realReturnPct: projection.realReturnPct,
            }
          : null,
      };
    });

  const children = childMilestones(members, accounts, asOf);
  for (const c of children) {
    if (c.age == null) gaps.push(`Birth date missing for child ${c.memberKey}.`);
    if (!c.hasSavingsForEveryChildAccount) gaps.push(`No "חיסכון לכל ילד" (savings_child) account recorded for ${c.memberKey}.`);
  }
  for (const m of members.filter((x) => x.role === "adult")) {
    if (!m.employment) gaps.push(`Employment not set for ${m.key}.`);
    if (!m.residence) gaps.push(`Country of residence not set for ${m.key}.`);
  }

  return {
    asOf: nw.asOf,
    fx: nw.fx,
    household: {
      members: members.map((m) => ({
        key: m.key,
        name: m.name ?? m.nameHe ?? null,
        role: m.role,
        age: ageAt(m.birthDate ?? null, asOf),
        ...(m.role === "adult"
          ? { targetRetirementAge: m.targetRetirementAge ?? null, employment: m.employment ?? null, residence: m.residence ?? null }
          : {}),
      })),
      goals: profile.goals,
      goalsText: profile.goalsText,
      riskTolerance: profile.riskTolerance,
    },
    netWorth: { totals: nw.totals, byModule: nw.byModule, byOwner: nw.byOwner, byCountry: nw.byCountry, byType: nw.byType },
    // Policy numbers are deliberately not sent.
    savingsAccounts: accounts.map((a) => ({
      id: a.id,
      owner: a.owner,
      country: a.country,
      type: a.type,
      provider: a.provider,
      planName: a.planName ?? null,
      status: a.status ?? null,
      currency: a.currency,
      balance: a.balance,
      balanceUsd: a.balanceUsd,
      balanceAsOf: a.balanceAsOf ?? null,
      track: a.track ?? null,
      feeDepositPct: a.feeDepositPct ?? null,
      feeAccumulationPct: a.feeAccumulationPct ?? null,
      monthlyDeposit: a.monthlyDeposit,
      depositSplit: {
        employee: a.monthlyDepositEmployee ?? null,
        employer: a.monthlyDepositEmployer ?? null,
        severance: a.monthlyDepositSeverance ?? null,
      },
      insuredSalary: a.insuredSalary ?? null,
      projectedMonthlyPension: a.projectedMonthlyPension ?? null,
      annualFees: a.annualFees,
      feeDrag10yVsBenchmark: a.feeDrag10y,
      liquidity: a.liquidity,
      ytdReturnPct: a.details?.ytdReturnPct ?? null,
      conversionFactor: a.details?.conversionFactor ?? null,
      guaranteedFactor: a.details?.guaranteedFactor ?? null,
      openDate: a.details?.openDate ?? null,
      projectedLumpSum: a.details?.projectedLumpSum ?? null,
      notes: a.details?.notes ?? null,
      contactId: typeof a.details?.contactId === "string" ? a.details.contactId : null,
    })),
    properties: nw.properties.map((p) => ({
      title: p.title,
      valueUsd: p.value,
      valueSource: p.valueSource,
      valueAsOf: p.valueAsOf,
      purchasePrice: p.purchasePrice,
      mortgageUsd: p.mortgageBalance,
      equityUsd: p.equity,
    })),
    trade: nw.trade,
    householdCashFlow: input.cashFlow,
    retirement,
    children,
    coverage: {
      duplicates: coverage.duplicates,
      gaps: coverage.gaps,
      groups: coverage.groups,
      totalMonthlyCostUsd: coverage.totalMonthlyCostUsd,
    },
    history: nw.history,
    // Full property records (loans, insurance, tax, basis…) come from
    // advisor-records.ts loadAdvisorPropertyRecords(), loaded by the callers.
    realEstate: input.properties ? buildRealEstateReview(input.properties, asOf, input.propertyRecords) : null,
    contacts: (profile.contacts ?? []).map((c) => ({ id: c.id, name: c.name, role: c.role, country: c.country, language: c.language })),
    dataGaps: [...new Set(gaps)],
    assumptions: [...new Set(assumptions)],
  };
}

/** Deterministic JSON (sorted keys) so the hash is stable. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Hash of the snapshot content (excluding the as-of date) + model + prompt. */
export function snapshotHash(s: AdvisorSnapshot): string {
  const { asOf: _asOf, ...rest } = s;
  void _asOf;
  return createHash("sha256")
    .update(ADVISOR_MODEL)
    .update(ADVISOR_SYSTEM)
    .update(stableStringify(rest))
    .digest("hex");
}

// ── Generation ─────────────────────────────────────────────────────

export interface AdvisorUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estCostUsd: number;
  servedByModel: string;
  fallbackUsed: boolean;
  stopReason: string | null;
}

export function estimateCostUsd(u: { input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  const cost =
    (u.input * PRICE_IN_PER_MTOK + u.cacheWrite * PRICE_IN_PER_MTOK * 1.25 + u.cacheRead * PRICE_IN_PER_MTOK * 0.1 + u.output * PRICE_OUT_PER_MTOK) /
    1_000_000;
  return Math.round(cost * 10000) / 10000;
}

function usageOf(msg: Anthropic.Beta.BetaMessage): AdvisorUsage {
  const iters = msg.usage.iterations ?? [];
  const tokenIters = iters.filter(
    (it): it is Extract<typeof it, { type: "message" | "fallback_message" }> => it.type === "message" || it.type === "fallback_message"
  );
  const src =
    tokenIters.length > 0
      ? tokenIters.map((it) => ({
          input: it.input_tokens,
          output: it.output_tokens,
          cacheRead: it.cache_read_input_tokens ?? 0,
          cacheWrite: it.cache_creation_input_tokens ?? 0,
        }))
      : [
          {
            input: msg.usage.input_tokens,
            output: msg.usage.output_tokens,
            cacheRead: msg.usage.cache_read_input_tokens ?? 0,
            cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
          },
        ];
  const sum = src.reduce(
    (a, b) => ({ input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  );
  return {
    inputTokens: sum.input,
    outputTokens: sum.output,
    cacheReadTokens: sum.cacheRead,
    cacheWriteTokens: sum.cacheWrite,
    // Priced at Fable rates for every attempt; a fallback attempt actually
    // bills at the fallback model's (lower) rates, so this is an upper bound.
    estCostUsd: estimateCostUsd(sum),
    servedByModel: msg.model,
    fallbackUsed: iters.some((it) => it.type === "fallback_message"),
    stopReason: msg.stop_reason,
  };
}

export async function generateAdvice(
  snapshot: AdvisorSnapshot,
  previous: { previousRecommendations?: unknown[]; previousOpportunityTitles?: string[] } = {}
): Promise<{ output: AdvisorOutput; usage: AdvisorUsage }> {
  const client = new Anthropic();
  // Fable 5.1: thinking is always on (no `thinking` field), no sampling
  // params. Server-side refusal fallback via the "default" scalar form.
  const stream = client.beta.messages.stream({
    model: ADVISOR_MODEL,
    max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: ADVISOR_OUTPUT_SCHEMA as unknown as Record<string, unknown> },
    },
    system: ADVISOR_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Review our household finances and give us a ranked plan: what to change, how, and the action items.\n\n=== SNAPSHOT (JSON) ===\n${JSON.stringify(snapshot, null, 2)}` +
          (previous.previousRecommendations?.length
            ? `\n\n=== previousRecommendations (reuse ids and continuing task wording; done items are finished) ===\n${JSON.stringify(previous.previousRecommendations, null, 2)}`
            : "") +
          (previous.previousOpportunityTitles?.length
            ? `\n\n=== previousOpportunityTitles (suggest different investment ideas unless something changed) ===\n${JSON.stringify(previous.previousOpportunityTitles)}`
            : ""),
      },
    ],
  });
  const msg = await stream.finalMessage();
  const usage = usageOf(msg);

  // Check stop_reason before reading content.
  if (msg.stop_reason === "refusal") {
    throw new AdvisorError("The advisor declined this request (refusal, including fallback).", "refusal");
  }
  if (msg.stop_reason === "max_tokens") {
    throw new AdvisorError("The advisor ran out of output tokens before finishing.", "max_tokens");
  }
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new AdvisorError("The advisor returned an empty response.", "empty");
  return { output: parseAdvisorOutput(text), usage };
}
