// Deterministic home-profitability analysis: turns a HomeInsights bundle into
// concrete, dollar-quantified recommendations, and builds a compact context
// string for the co-pilot LLM.
import { formatCurrency } from "./utils";
import type { HomeInsights } from "./home";

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  kind: "reduce" | "grow" | "watch" | "win";
  monthlyImpact?: number; // estimated $/mo swing
}

// Categories that are essential / non-discretionary — we don't suggest trimming these first.
const ESSENTIAL = ["Home", "Health", "Insurance", "Utilities", "Property", "Financial"];

export interface CoachSummary {
  monthlyIncome: number;
  monthlySpend: number;
  monthlyNet: number;
  savingsRate: number;
  activeMonths: number;
  score: number; // 0–100 profitability score
}

export function coachSummary(insights: HomeInsights): CoachSummary {
  const { totals } = insights;
  const months = Math.max(1, totals.activeMonths);
  const monthlyIncome = totals.income / months;
  const monthlySpend = totals.spend / months;
  const monthlyNet = monthlyIncome - monthlySpend;
  const savingsRate = totals.savingsRate;
  // Score: savings rate mapped to 0–100 (20%+ = great), floored/capped.
  const score = Math.max(0, Math.min(100, Math.round((savingsRate / 0.3) * 100)));
  return { monthlyIncome, monthlySpend, monthlyNet, savingsRate, activeMonths: months, score };
}

export function buildRecommendations(insights: HomeInsights, propertyNet = 0): Recommendation[] {
  const recs: Recommendation[] = [];
  const { totals, categories, recurring, monthly } = insights;
  const months = Math.max(1, totals.activeMonths);
  const monthlyIncome = totals.income / months;
  const monthlySpend = totals.spend / months;
  const monthlyNet = monthlyIncome - monthlySpend;

  // 1. Cash flow / savings rate
  if (monthlyNet < 0) {
    recs.push({
      id: "negative-cashflow",
      kind: "watch",
      title: `You're spending more than you earn`,
      detail: `Net cash flow is about ${formatCurrency(monthlyNet)}/mo. Prioritise the biggest discretionary categories below to get back to positive.`,
      monthlyImpact: -monthlyNet,
    });
  } else if (totals.savingsRate < 0.2 && monthlyIncome > 0) {
    const gap = (0.2 - totals.savingsRate) * monthlyIncome;
    recs.push({
      id: "savings-rate",
      kind: "grow",
      title: `Lift your savings rate from ${Math.round(totals.savingsRate * 100)}% toward 20%`,
      detail: `You're keeping ${formatCurrency(monthlyNet)}/mo. Freeing about ${formatCurrency(gap)}/mo more — via the trims below — would hit a healthy 20% savings rate.`,
      monthlyImpact: gap,
    });
  } else if (totals.savingsRate >= 0.2) {
    recs.push({
      id: "savings-win",
      kind: "win",
      title: `Strong savings rate of ${Math.round(totals.savingsRate * 100)}%`,
      detail: `You're keeping ${formatCurrency(monthlyNet)}/mo. Consider routing the surplus into savings/investments so it compounds instead of drifting into spend.`,
    });
  }

  // 2. Top discretionary categories → suggested 15% trim
  const discretionary = categories
    .filter((c) => c.total > 0 && !ESSENTIAL.some((e) => c.name.startsWith(e)))
    .slice(0, 3);
  for (const c of discretionary) {
    const perMonth = c.total / months;
    const save = perMonth * 0.15;
    if (save < 5) continue;
    recs.push({
      id: `trim-${c.name}`,
      kind: "reduce",
      title: `Trim ${c.name} — ${formatCurrency(perMonth)}/mo (${Math.round(c.share * 100)}% of spend)`,
      detail: `A 15% cut here saves about ${formatCurrency(save)}/mo (${formatCurrency(save * 12)}/yr) with little lifestyle impact.`,
      monthlyImpact: save,
    });
  }

  // 3. Subscriptions / recurring
  const subMonthly = recurring.reduce((s, r) => s + r.monthlyAmount, 0);
  if (recurring.length >= 2 && subMonthly > 0) {
    recs.push({
      id: "subscriptions",
      kind: "reduce",
      title: `Review ${recurring.length} recurring charges ≈ ${formatCurrency(subMonthly)}/mo`,
      detail: `Recurring merchants total roughly ${formatCurrency(subMonthly * 12)}/yr. Cancelling even a couple you don't use is the fastest guaranteed win.`,
      monthlyImpact: subMonthly * 0.3,
    });
  }

  // 4. Month-over-month spike
  const spendByMonth = monthly.filter((m) => m.spend > 0);
  if (spendByMonth.length >= 2) {
    const last = spendByMonth[spendByMonth.length - 1];
    const prev = spendByMonth[spendByMonth.length - 2];
    if (prev.spend > 0 && last.spend > prev.spend * 1.25) {
      const jump = last.spend - prev.spend;
      recs.push({
        id: "mom-spike",
        kind: "watch",
        title: `Spending jumped ${Math.round((last.spend / prev.spend - 1) * 100)}% in ${last.name}`,
        detail: `${last.name} spend was ${formatCurrency(last.spend)} vs ${formatCurrency(prev.spend)} in ${prev.name} (+${formatCurrency(jump)}). Worth a quick look at what drove it.`,
      });
    }
  }

  // 5. Property contribution (cash generation)
  if (propertyNet !== 0) {
    recs.push({
      id: "property",
      kind: propertyNet >= 0 ? "win" : "watch",
      title:
        propertyNet >= 0
          ? `Your properties add ${formatCurrency(propertyNet)} to the year`
          : `Properties are running at a ${formatCurrency(propertyNet)} loss`,
      detail:
        propertyNet >= 0
          ? `Rental cash flow is a key lever — review rents vs market and keep expenses lean to grow it.`
          : `Check rent levels, vacancy, and the biggest expense lines in the Properties module to turn this positive.`,
    });
  }

  // Sort: quantified impact first (desc), then watches/wins.
  return recs.sort((a, b) => (b.monthlyImpact ?? -1) - (a.monthlyImpact ?? -1));
}

/** Compact, LLM-friendly snapshot of the user's finances for co-pilot context. */
export function buildCopilotContext(
  insights: HomeInsights,
  year: number,
  propertyNet = 0
): string {
  const s = coachSummary(insights);
  const cat = insights.categories
    .slice(0, 10)
    .map((c) => `  - ${c.name}: ${formatCurrency(c.total)} (${Math.round(c.share * 100)}%)`)
    .join("\n");
  const sub = insights.recurring
    .slice(0, 12)
    .map((r) => `  - ${r.merchant}: ~${formatCurrency(r.monthlyAmount)}/mo (${r.months} mo)`)
    .join("\n");
  const merch = insights.topMerchants
    .map((m) => `  - ${m.merchant}: ${formatCurrency(m.total)} (${m.count}x)`)
    .join("\n");
  const mon = insights.monthly
    .filter((m) => m.income || m.spend)
    .map((m) => `  ${m.name}: in ${formatCurrency(m.income)}, out ${formatCurrency(m.spend)}, net ${formatCurrency(m.net)}`)
    .join("\n");

  return `HAMO HOME — FINANCIAL SNAPSHOT (${year}, transfers/card-payments already excluded)
Totals: income ${formatCurrency(insights.totals.income)}, spending ${formatCurrency(insights.totals.spend)}, net ${formatCurrency(insights.totals.net)}, savings rate ${Math.round(insights.totals.savingsRate * 100)}% over ${s.activeMonths} active month(s).
Monthly averages: income ${formatCurrency(s.monthlyIncome)}, spending ${formatCurrency(s.monthlySpend)}, net ${formatCurrency(s.monthlyNet)}.
Property net (rentals): ${formatCurrency(propertyNet)}.

Spending by category:
${cat || "  (none)"}

Recurring / subscriptions:
${sub || "  (none detected)"}

Top merchants:
${merch || "  (none)"}

Monthly cash flow:
${mon || "  (none)"}`;
}
