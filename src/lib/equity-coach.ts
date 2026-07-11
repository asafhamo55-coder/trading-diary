// Consolidated cross-module analysis for the Home Equity hub: rolls up Trade,
// Properties and Home into an equity summary, recommendations and LLM context.
import { formatCurrency } from "./utils";
import type { Recommendation } from "./home-coach";

export interface ModuleAgg {
  income: number;
  expense: number;
  net: number;
}

export interface EquityData {
  trade: ModuleAgg;
  properties: ModuleAgg;
  home: ModuleAgg;
  monthly: { name: string; net: number }[];
  year: number;
}

export interface EquitySummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
  retention: number; // net / income
  monthlyNet: number;
  bestModule: { key: string; label: string; net: number } | null;
  worstModule: { key: string; label: string; net: number } | null;
}

const LABELS: Record<string, string> = {
  trade: "Hamo Trade",
  properties: "Hamo Properties",
  home: "Hamo Home",
};

export function agg(rows: { revenue: number; expense: number }[]): ModuleAgg {
  const income = rows.reduce((s, r) => s + r.revenue, 0);
  const expense = rows.reduce((s, r) => s + r.expense, 0);
  return { income, expense, net: income - expense };
}

export function equitySummary(d: EquityData): EquitySummary {
  const totalIncome = d.trade.income + d.properties.income + d.home.income;
  const totalExpense = d.trade.expense + d.properties.expense + d.home.expense;
  const net = totalIncome - totalExpense;
  const activeMonths = Math.max(1, d.monthly.filter((m) => m.net !== 0).length);
  const mods = [
    { key: "trade", net: d.trade.net },
    { key: "properties", net: d.properties.net },
    { key: "home", net: d.home.net },
  ];
  const sorted = [...mods].sort((a, b) => b.net - a.net);
  const best = sorted[0].net !== 0 ? { ...sorted[0], label: LABELS[sorted[0].key] } : null;
  const worst =
    sorted[sorted.length - 1].net < 0
      ? { ...sorted[sorted.length - 1], label: LABELS[sorted[sorted.length - 1].key] }
      : null;
  return {
    totalIncome,
    totalExpense,
    net,
    retention: totalIncome > 0 ? net / totalIncome : 0,
    monthlyNet: net / activeMonths,
    bestModule: best,
    worstModule: worst,
  };
}

export function buildEquityRecommendations(d: EquityData): Recommendation[] {
  const recs: Recommendation[] = [];
  const s = equitySummary(d);

  // Headline: overall equity trajectory
  if (s.net >= 0) {
    recs.push({
      id: "equity-net",
      kind: "win",
      title: `Your equity grew ${formatCurrency(s.net)} this year`,
      detail: `Across all modules you kept ${formatCurrency(s.net)} of ${formatCurrency(s.totalIncome)} in (${Math.round(s.retention * 100)}% retention), ~${formatCurrency(s.monthlyNet)}/mo. Keep compounding it below.`,
    });
  } else {
    recs.push({
      id: "equity-net",
      kind: "watch",
      title: `Equity is down ${formatCurrency(s.net)} this year`,
      detail: `Outflows exceeded inflows by ${formatCurrency(-s.net)}. The fastest turnaround is trimming your biggest cash outflow — see below.`,
      monthlyImpact: -s.monthlyNet,
    });
  }

  // Biggest controllable outflow (usually Home spending)
  const outflows = [
    { key: "home", label: "Hamo Home", expense: d.home.expense, href: "/home/coach" },
    { key: "properties", label: "Hamo Properties", expense: d.properties.expense, href: "/properties" },
    { key: "trade", label: "Hamo Trade", expense: d.trade.expense, href: "/trade/dashboard" },
  ].sort((a, b) => b.expense - a.expense);
  const top = outflows[0];
  if (top.expense > 0) {
    const save = (top.expense / 12) * 0.1;
    recs.push({
      id: "top-outflow",
      kind: "reduce",
      title: `${top.label} is your largest cash outflow — ${formatCurrency(top.expense)}`,
      detail:
        top.key === "home"
          ? `This is your most controllable lever. Open the Home Coach for specific, dollar-quantified cuts — even 10% here is ~${formatCurrency(save)}/mo.`
          : `Review the biggest expense lines here; a 10% reduction is roughly ${formatCurrency(save)}/mo.`,
      monthlyImpact: save,
    });
  }

  // Best cash generator
  if (s.bestModule && s.bestModule.net > 0) {
    recs.push({
      id: "best-generator",
      kind: "grow",
      title: `${s.bestModule.label} is your top cash generator (+${formatCurrency(s.bestModule.net)})`,
      detail: `It's carrying your equity. Doubling down here — more rental yield, more consistent trading, or more income — compounds fastest.`,
    });
  }

  // A module bleeding
  if (s.worstModule) {
    recs.push({
      id: "drag",
      kind: "watch",
      title: `${s.worstModule.label} is dragging equity (${formatCurrency(s.worstModule.net)})`,
      detail: `It's net-negative for the year. Dig into its page to find what's driving the loss and whether it's fixable or seasonal.`,
    });
  }

  return recs.sort((a, b) => (b.monthlyImpact ?? -1) - (a.monthlyImpact ?? -1));
}

export function buildEquityContext(d: EquityData): string {
  const s = equitySummary(d);
  const line = (label: string, m: ModuleAgg) =>
    `  - ${label}: in ${formatCurrency(m.income)}, out ${formatCurrency(m.expense)}, net ${formatCurrency(m.net)}`;
  const mon = d.monthly
    .filter((m) => m.net !== 0)
    .map((m) => `  ${m.name}: net ${formatCurrency(m.net)}`)
    .join("\n");
  return `HAMO HOME EQUITY — CONSOLIDATED SNAPSHOT (${d.year})
This rolls up three modules: Trade (trading P&L), Properties (rental income/expenses), and Home (household cash flow).
Overall: total in ${formatCurrency(s.totalIncome)}, total out ${formatCurrency(s.totalExpense)}, net equity change ${formatCurrency(s.net)} (${Math.round(s.retention * 100)}% retention), ~${formatCurrency(s.monthlyNet)}/mo.

By module:
${line("Hamo Trade", d.trade)}
${line("Hamo Properties", d.properties)}
${line("Hamo Home", d.home)}

Monthly net equity:
${mon || "  (none)"}`;
}
