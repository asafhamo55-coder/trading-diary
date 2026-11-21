import { getPropertyRecords, getPropertyRecordSummaries } from "./property-data";
import { recordFactsFrom, type PropertyRecordFacts } from "./advisor-properties";

/** Full property records for the advisor snapshot, keyed by property id. Never throws. */
export async function loadAdvisorPropertyRecords(): Promise<Record<string, PropertyRecordFacts>> {
  try {
    const [records, summaries] = await Promise.all([getPropertyRecords(), getPropertyRecordSummaries()]);
    const byId = new Map(summaries.map((s) => [s.id, s]));
    const out: Record<string, PropertyRecordFacts> = {};
    for (const [id, rec] of records) {
      out[id] = recordFactsFrom(rec as unknown as Parameters<typeof recordFactsFrom>[0], byId.get(id));
    }
    return out;
  } catch (error) {
    console.error("Advisor property records unavailable:", error);
    return {};
  }
}
