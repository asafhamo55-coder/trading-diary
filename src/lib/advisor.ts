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

export const ADVISOR_MODEL = "claude-fable-5-1";
// Fable 5.1 list pricing, USD per million tokens.
const PRICE_IN_PER_MTOK = 10;
const PRICE_OUT_PER_MTOK = 50;
const MAX_TOKENS = 32000;

export function hasAnthropicKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Output schema ──────────────────────────────────────────────────

export const RECOMMENDATION_CATEGORIES = [
  "fees",
  "allocation",
  "consolidation",
  "insurance",
  "insurance-overlap",
  "tax",
  "liquidity",
  "retirement",
  "property",
  "cash-flow",
  "education",
  "data-gap",
] as const;

export interface AdvisorRecommendation {
  title: string;
  category: (typeof RECOMMENDATION_CATEGORIES)[number];
  priority: "high" | "medium" | "low";
  owner: string; // member key or "household"
  rationale: string;
  action: string;
  estimatedImpactUsdPerYear: number | null;
  confidence: "high" | "medium" | "low";
}

export interface AdvisorOutput {
  headline: string;
  netWorthCommentary: string;
  recommendations: AdvisorRecommendation[];
  questionsForUser: { question: string; why: string }[];
  disclaimers: string[];
}

// Structured-outputs JSON schema: every object closed, every field required
// (optionals are expressed as nullable).
export const ADVISOR_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "netWorthCommentary", "recommendations", "questionsForUser", "disclaimers"],
  properties: {
    headline: { type: "string", description: "One-sentence bottom line for the household." },
    netWorthCommentary: { type: "string", description: "Short commentary on net worth composition, grounded in snapshot figures." },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "category", "priority", "owner", "rationale", "action", "estimatedImpactUsdPerYear", "confidence"],
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: [...RECOMMENDATION_CATEGORIES] },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          owner: { type: "string", description: 'Household member key from the snapshot (e.g. an adult or child key) or "household".' },
          rationale: { type: "string", description: "Why, citing snapshot numbers." },
          action: { type: "string", description: "Concrete next step." },
          estimatedImpactUsdPerYear: {
            type: ["number", "null"],
            description: "Annual USD impact derived from snapshot figures; null if it cannot be computed from the data.",
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    questionsForUser: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "why"],
        properties: { question: { type: "string" }, why: { type: "string" } },
      },
    },
    disclaimers: { type: "array", items: { type: "string" } },
  },
} as const;

// ── System prompt ──────────────────────────────────────────────────

export const ADVISOR_SYSTEM = `You are an expert cross-border (Israel–US) household financial planner advising a family through their private finance app. You have deep, practical knowledge of:

- Israeli long-term savings: קרן פנסיה (comprehensive pension), ביטוח מנהלים (manager's insurance), קרן השתלמות (study fund), קופות גמל and גמל להשקעה, פוליסות חיסכון, and "חיסכון לכל ילד" (savings for every child — state-funded child savings accounts, withdrawable at 18, with a bonus for leaving them until 21).
- Fee benchmarks (management fees from deposit / from accumulation; what negotiated and default-fund (קרן ברירת מחדל) levels look like vs. typical manager's-insurance fees), annuity conversion factors (מקדם המרה) and guaranteed factors in older policies, investment tracks and age-based tracks.
- Hishtalmut rules: liquidity after 6 years from opening (earlier at retirement age), tax-exempt deposit ceilings, employer/employee contribution rates; pension contribution rules (employee/employer/severance components, mandatory pension, section 14), tax credits and deduction ceilings for deposits.
- Insurance inside Israeli products (death/survivors' cover, loss-of-work-capacity / אובדן כושר עבודה) and how it overlaps with US employer life/AD&D/LTD/STD benefits and standalone term-life (ריסק) policies.
- US: 401(k) (employee deferral limits, employer match, Roth vs traditional, catch-up contributions after 50), IRAs, brokerage, HSA/FSA, ESPP, 529 plans.
- Cross-border: the US–Israel tax treaty (and its limits for pension/hishtalmut treatment), PFIC risk for US persons holding Israeli mutual funds / gemel-type investment products, FBAR (FinCEN 114) and Form 8938 reporting of Israeli accounts, foreign tax credits, currency exposure (ILS vs USD) and how a planned relocation changes the picture.
- Children's milestones: Israeli army service at 18 and university typically after service (~21+), versus US college at 18; 529 vs Israeli savings options; timing of "חיסכון לכל ילד" withdrawals.

How to work:
- Ground every figure you cite in the SNAPSHOT. Never invent balances, fees, rates, ages, or goals. If you compute something (e.g. fee savings), show the inputs from the snapshot in the rationale and keep the arithmetic simple.
- The snapshot already contains computed helpers (annual fee cost, 10-year fee drag vs benchmark, hishtalmut liquidity, retirement projections, coverage overlaps and gaps). Treat their stated assumptions as assumptions, and say so when they drive a conclusion.
- When profile data is missing (ages, retirement targets, goals, risk tolerance, employment, residence, children's accounts), say what you cannot conclude and add a precise question to questionsForUser. Add a "data-gap" recommendation for material gaps.
- Use "insurance-overlap" for duplicate cover across countries/products and "insurance" for gaps (e.g. no disability cover).
- Rules and limits change yearly; when a recommendation depends on a current-year ceiling, limit or tax rate, tell them to verify the current figure rather than stating one you are unsure of.
- Prioritise by money and risk: high = large recurring cost, material risk, or deadline; low = nice-to-have.
- Owners: use the member keys from the snapshot, or "household".
- Be concise and concrete. Respond in English (Hebrew product names are fine).
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
  dataGaps: string[];
  assumptions: string[];
}

export function buildAdvisorSnapshot(input: {
  netWorth: NetWorthPayload;
  coverage: CoverageReport;
  profile: HouseholdProfileDTO;
  cashFlow: HomeCashFlowSummary;
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

export class AdvisorError extends Error {
  constructor(message: string, readonly kind: "refusal" | "max_tokens" | "parse" | "empty") {
    super(message);
  }
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

/** Validate the parsed JSON enough to trust its shape downstream. */
export function parseAdvisorOutput(text: string): AdvisorOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AdvisorError("Advisor returned invalid JSON.", "parse");
  }
  const o = raw as Partial<AdvisorOutput>;
  if (!o || typeof o.headline !== "string" || !Array.isArray(o.recommendations)) {
    throw new AdvisorError("Advisor output is missing required fields.", "parse");
  }
  return {
    headline: o.headline,
    netWorthCommentary: o.netWorthCommentary ?? "",
    recommendations: o.recommendations,
    questionsForUser: o.questionsForUser ?? [],
    disclaimers: o.disclaimers ?? [],
  };
}

export async function generateAdvice(snapshot: AdvisorSnapshot): Promise<{ output: AdvisorOutput; usage: AdvisorUsage }> {
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
        content: `Review our household finances and tell us how to act and what to change.\n\n=== SNAPSHOT (JSON) ===\n${JSON.stringify(snapshot, null, 2)}`,
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
