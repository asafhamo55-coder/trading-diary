// UI strings for the advisor panel in English and Hebrew. Model-written text
// arrives already bilingual ({ en, he }); this covers the chrome around it.
import type { AdvisorLang, Level, PropertySubTheme, ThemeTone, UrgencyLevel } from "@/lib/advisor-report";

export const ADVISOR_LANG_KEY = "hamo-advisor-lang";

export function readStoredLang(): AdvisorLang | null {
  try {
    const v = window.localStorage.getItem(ADVISOR_LANG_KEY);
    return v === "he" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: AdvisorLang) {
  try {
    window.localStorage.setItem(ADVISOR_LANG_KEY, lang);
  } catch {
    /* private mode etc. */
  }
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

/** "2026-12-15" → "Dec 15, 2026" / "15 בדצמ׳ 2026". */
export function fmtDay(iso: string | null | undefined, lang: AdvisorLang): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const i = Number(m[2]) - 1;
  if (lang === "he") return m[3] ? `${Number(m[3])} ב${MONTHS_HE[i] ?? m[2]} ${m[1]}` : `${MONTHS_HE[i] ?? m[2]} ${m[1]}`;
  return m[3] ? `${MONTHS_EN[i] ?? m[2]} ${Number(m[3])}, ${m[1]}` : `${MONTHS_EN[i] ?? m[2]} ${m[1]}`;
}

interface Strings {
  panelTitle: string;
  panelDescription: string;
  dailyNote: string;
  dailyNoteAsk: string;
  firstReportSoon: string;
  langGroup: string;
  legacyNote: string;
  englishOnlyNote: string;
  quickTitle: string;
  quickSub: string;
  firstStep: string;
  nextStep: string;
  allStepsDone: string;
  details: string;
  totalUpside: string;
  recurring: (x: string) => string;
  noRecurring: string;
  oneTime: (x: string) => string;
  recCount: (n: number) => string;
  itemsDone: string;
  of: string;
  captured: string;
  byTheme: string;
  ranked: string;
  shown: (v: number, t: number) => string;
  everyone: string;
  clearTheme: (t: string) => string;
  filterGroup: string;
  saveError: string;
  noMatch: string;
  notRelevant: string;
  dismissPrompt: string;
  dismissPlaceholder: string;
  dismissConfirm: string;
  dismissCancel: string;
  reasonLabel: string;
  restore: string;
  dismissedCount: (n: number) => string;
  showDismissed: string;
  hideDismissed: string;
  needToKnow: string;
  unquantified: string;
  recs: (n: number) => string;
  done: string;
  perYearShort: string;
  oneTimeShort: string;
  riskAvoided: string;
  tenYearShort: string;
  whatToChange: string;
  now: string;
  target: string;
  why: string;
  how: string;
  ifNothing: string;
  actionItems: string;
  benefit: string;
  perYear: string;
  oneTimeLabel: string;
  tenYearValue: string;
  doFirst: string;
  confidence: string;
  by: string;
  minutes: (n: number) => string;
  rank: (n: number) => string;
  detailsOf: (t: string) => string;
  actionItemsDone: string;
  themeAria: (title: string, tone: string, status: string, n: number, value: string) => string;
  tone: Record<ThemeTone, string>;
  urgency: Record<UrgencyLevel, string>;
  effort: Record<Level, string>;
  level: Record<Level, string>;
  byProperty: string;
  portfolioWide: string;
  subTheme: Record<PropertySubTheme, string>;
}

export const ADVISOR_STRINGS: Record<AdvisorLang, Strings> = {
  en: {
    panelTitle: "Household advisor",
    panelDescription: "Cross-border (Israel–US) review of your fees, insurance, allocation and liquidity — what to do next and why.",
    dailyNote: "Refreshed every morning at 7:00 AM by Claude Code on your Claude subscription, using the latest data and laws. For an update now, ask Claude Code to",
    dailyNoteAsk: "“run the advisor”",
    firstReportSoon: " Your first report arrives by tomorrow morning.",
    langGroup: "Advisor language",
    legacyNote:
      "This report predates the drill-down format, so benefits, steps and action items are estimated from the older summary. The next daily run adds the full detail.",
    englishOnlyNote: "This report is in English only. The next daily run adds Hebrew.",
    quickTitle: "Money on the table — act this week",
    quickSub: "The biggest payoff for the least effort, each doable in about two weeks.",
    firstStep: "First step",
    nextStep: "Next step",
    allStepsDone: "All steps done",
    details: "Details",
    totalUpside: "Total upside · 10 years",
    recurring: (x) => `${x}/yr recurring`,
    noRecurring: "No recurring savings estimated",
    oneTime: (x) => `${x} one-time`,
    recCount: (n) => `${n} recommendation${n === 1 ? "" : "s"}`,
    itemsDone: "action items done",
    of: "of",
    captured: "captured",
    byTheme: "By theme",
    ranked: "Ranked by 10-year benefit",
    shown: (v, t) => (v === t ? `${t} recommendations` : `${v} of ${t} shown`),
    everyone: "Everyone",
    clearTheme: (t) => `Clear theme filter: ${t}`,
    filterGroup: "Filter recommendations",
    saveError: "Couldn’t save that tick — check your connection and try again.",
    noMatch: "No recommendations match these filters.",
  notRelevant: "Not relevant",
  dismissPrompt: "Why isn’t this relevant? The advisor reads this before every future report.",
  dismissPlaceholder: "e.g. We’re selling this property next year / Einat won’t work in the US",
  dismissConfirm: "Mark not relevant",
  dismissCancel: "Cancel",
  reasonLabel: "Why",
  restore: "Restore",
  dismissedCount: (n) => `${n} marked not relevant`,
  showDismissed: "Show",
  hideDismissed: "Hide",
    needToKnow: "The advisor needs to know",
    unquantified: "Unquantified",
    recs: (n) => `${n} rec${n === 1 ? "" : "s"}`,
    done: "done",
    perYearShort: "/yr",
    oneTimeShort: "one-time",
    riskAvoided: "risk avoided",
    tenYearShort: "10 yr",
    whatToChange: "What to change",
    now: "Now",
    target: "Target",
    why: "Why",
    how: "How to change it",
    ifNothing: "If nothing changes: ",
    actionItems: "Action items",
    benefit: "Benefit",
    perYear: "Per year",
    oneTimeLabel: "One-time",
    tenYearValue: "10-year value",
    doFirst: "Do first",
    confidence: "Confidence",
    by: "by",
    minutes: (n) => `~${n} min`,
    rank: (n) => `Rank ${n}. `,
    detailsOf: (t) => `${t} details`,
    actionItemsDone: "action items done",
    themeAria: (title, tone, status, n, value) =>
      `${title}: ${tone}. ${status}${n ? `. ${n} recommendations worth ${value} over 10 years. Filter the list` : ""}`,
    tone: { good: "On track", watch: "Watch", act: "Act" },
    urgency: { critical: "Urgent", high: "High", medium: "This year", low: "Whenever" },
    effort: { low: "Low effort", medium: "Medium effort", high: "High effort" },
    level: { low: "low", medium: "medium", high: "high" },
    byProperty: "Real estate by property",
    portfolioWide: "All properties",
    subTheme: { tax: "Tax", profit: "Profit", revenue: "Revenue" },
  },
  he: {
    panelTitle: "היועץ הפיננסי של משק הבית",
    panelDescription: "סקירה חוצת גבולות (ישראל–ארה״ב) של דמי ניהול, ביטוחים, הקצאת נכסים ונזילות — מה לעשות עכשיו ולמה.",
    dailyNote: "מתעדכן כל בוקר ב־7:00 על ידי Claude Code במנוי Claude שלך, לפי הנתונים והחוקים העדכניים. לעדכון מיידי, בקשו מ־Claude Code",
    dailyNoteAsk: "“run the advisor”",
    firstReportSoon: " הדוח הראשון יגיע עד מחר בבוקר.",
    langGroup: "שפת היועץ",
    legacyNote: "הדוח הזה קדם לפורמט המפורט, ולכן התועלות, הצעדים והמשימות מוערכים מהסיכום הישן. ההרצה היומית הבאה תוסיף את כל הפרטים.",
    englishOnlyNote: "הדוח הזה זמין באנגלית בלבד. ההרצה היומית הבאה תוסיף עברית.",
    quickTitle: "כסף על השולחן — לפעול השבוע",
    quickSub: "התמורה הגדולה ביותר במאמץ הקטן ביותר, כל אחד אפשר לבצע תוך כשבועיים.",
    firstStep: "צעד ראשון",
    nextStep: "הצעד הבא",
    allStepsDone: "כל הצעדים בוצעו",
    details: "פרטים",
    totalUpside: "פוטנציאל כולל · 10 שנים",
    recurring: (x) => `${x} בשנה, שוטף`,
    noRecurring: "לא הוערך חיסכון שוטף",
    oneTime: (x) => `${x} חד־פעמי`,
    recCount: (n) => (n === 1 ? "המלצה אחת" : `${n} המלצות`),
    itemsDone: "משימות בוצעו",
    of: "מתוך",
    captured: "מומש",
    byTheme: "לפי נושא",
    ranked: "מדורג לפי התועלת ל־10 שנים",
    shown: (v, t) => (v === t ? `${t} המלצות` : `מוצגות ${v} מתוך ${t}`),
    everyone: "כולם",
    clearTheme: (t) => `ניקוי סינון נושא: ${t}`,
    filterGroup: "סינון המלצות",
    saveError: "הסימון לא נשמר — בדקו את החיבור ונסו שוב.",
    noMatch: "אין המלצות שמתאימות לסינון.",
  notRelevant: "לא רלוונטי",
  dismissPrompt: "למה זה לא רלוונטי? היועץ קורא את זה לפני כל דוח עתידי.",
  dismissPlaceholder: "למשל: אנחנו מוכרים את הנכס בשנה הבאה / עינת לא תעבוד בארה\"ב",
  dismissConfirm: "סימון כלא רלוונטי",
  dismissCancel: "ביטול",
  reasonLabel: "למה",
  restore: "שחזור",
  dismissedCount: (n) => (n === 1 ? "המלצה אחת סומנה כלא רלוונטית" : `${n} המלצות סומנו כלא רלוונטיות`),
  showDismissed: "הצגה",
  hideDismissed: "הסתרה",
    needToKnow: "היועץ צריך לדעת",
    unquantified: "לא כומת",
    recs: (n) => (n === 1 ? "המלצה אחת" : `${n} המלצות`),
    done: "בוצעו",
    perYearShort: " לשנה",
    oneTimeShort: "חד־פעמי",
    riskAvoided: "סיכון שנמנע",
    tenYearShort: "10 שנים",
    whatToChange: "מה לשנות",
    now: "היום",
    target: "יעד",
    why: "למה",
    how: "איך לשנות",
    ifNothing: "אם לא ישתנה דבר: ",
    actionItems: "משימות",
    benefit: "תועלת",
    perYear: "לשנה",
    oneTimeLabel: "חד־פעמי",
    tenYearValue: "ערך ל־10 שנים",
    doFirst: "לבצע קודם",
    confidence: "רמת ודאות",
    by: "עד",
    minutes: (n) => `כ־${n} דק׳`,
    rank: (n) => `מקום ${n}. `,
    detailsOf: (t) => `פרטים: ${t}`,
    actionItemsDone: "משימות בוצעו",
    themeAria: (title, tone, status, n, value) =>
      `${title}: ${tone}. ${status}${n ? `. ${n} המלצות בשווי ${value} ל־10 שנים. סינון הרשימה` : ""}`,
    tone: { good: "תקין", watch: "למעקב", act: "לפעול" },
    urgency: { critical: "דחוף", high: "גבוהה", medium: "השנה", low: "בלי לחץ" },
    effort: { low: "מאמץ נמוך", medium: "מאמץ בינוני", high: "מאמץ גבוה" },
    level: { low: "נמוכה", medium: "בינונית", high: "גבוהה" },
    byProperty: "נדל״ן לפי נכס",
    portfolioWide: "כל הנכסים",
    subTheme: { tax: "מס", profit: "רווח", revenue: "הכנסות" },
  },
};
