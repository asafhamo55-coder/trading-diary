import { loadAdvisorPropertyRecords } from "./advisor-records";
import { getHomeCashFlowSummary, getNetWorth, getProfile } from "./savings-data";
import { getGuidelineSummary } from "./guidelines-data";
import { getProperties, type PropertyWithTx } from "./property-data";
import { buildAdvisorSnapshot, type AdvisorSnapshot } from "./advisor";
import type { GuidelineSummary } from "./guidelines";
import { listTaxReturns } from "./tax-return-data";

export type AdvisorContextSnapshot = AdvisorSnapshot & { tradingGuidelines: GuidelineSummary | null };

/**
 * The household snapshot exactly as GET /api/savings/advisor/context builds it
 * (net worth, profile, cash flow, properties + the trading guidelines summary),
 * for other machine readers such as the in-app assistant's pending bundle.
 *
 * Keep in sync with src/app/api/savings/advisor/context/route.ts; that route
 * can switch to this helper once its concurrent edits land.
 */
export async function buildAdvisorContextSnapshot(opts: { properties?: PropertyWithTx[] } = {}): Promise<AdvisorContextSnapshot> {
  const [netWorth, profile, cashFlow, properties, tradingGuidelines] = await Promise.all([
    getNetWorth(),
    getProfile(),
    getHomeCashFlowSummary(),
    opts.properties ? Promise.resolve(opts.properties) : getProperties(),
    getGuidelineSummary(),
  ]);
  const { coverage, ...nw } = netWorth;
  return { ...buildAdvisorSnapshot({ netWorth: nw, coverage, profile, cashFlow, properties, propertyRecords: await loadAdvisorPropertyRecords(), taxReturns: await listTaxReturns().catch(() => []) }), tradingGuidelines };
}
