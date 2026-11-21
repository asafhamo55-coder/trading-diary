import { getLatestAdvisorReport, getNetWorth, getProfile } from "@/lib/savings-data";
import { hasAnthropicKey } from "@/lib/advisor";
import HouseholdDashboard from "./HouseholdDashboard";

/**
 * Server half of the household dashboard: loads net worth, profile and the
 * latest saved advisor report, then hands plain JSON to the client view.
 * Each source fails independently so one bad query never blanks the page.
 */
export default async function HouseholdSection() {
  const [nw, profile, report] = await Promise.allSettled([getNetWorth(), getProfile(), getLatestAdvisorReport()]);
  if (nw.status === "rejected") console.error("Dashboard: getNetWorth failed", nw.reason);
  if (profile.status === "rejected") console.error("Dashboard: getProfile failed", profile.reason);
  if (report.status === "rejected") console.error("Dashboard: getLatestAdvisorReport failed", report.reason);
  return (
    <HouseholdDashboard
      netWorth={nw.status === "fulfilled" ? nw.value : null}
      profile={profile.status === "fulfilled" ? profile.value : null}
      advisorReport={report.status === "fulfilled" ? report.value : null}
      hasAnthropicKey={hasAnthropicKey()}
      loadError={nw.status === "rejected" ? "The savings database didn’t respond." : null}
    />
  );
}
