// Household advisor report, schema v2: types, the JSON schema the model
// writes against, and the pure parse / normalize / rank / roll-up logic.
//
// No Node or SDK imports: the dashboard (client) uses the same helpers to
// roll up action-item progress, and the server uses them to validate what the
// daily Claude Code routine (or the in-app generator) produces.
//
// Shape, top to bottom:
//   quickWins[] — "money on the table, act this week"  ← level 0
//   headline + executiveSummary (3–5 bullets)          ← level 1
//   themes[] with summed benefit                        ← level 1
//   recommendations[] ranked by benefit.tenYearUsd      ← level 2
//   each with whatToChange / why / howToChange /
//   actionItems / dependsOn / risksIfIgnored            ← level 3
//
// Bilingual: every user-facing text is a Localized `{ en, he }` object (never
// parallel *He fields). Amounts inside the structured `benefit` stay numbers
// and are formatted by the UI in the display currency. Normalization accepts
// a bare string as English-only (`he: ""`); the UI falls back to English for
// any empty Hebrew field. For v2 output the server requires Hebrew on the
// headline, summary bullets, recommendation titles and quick-win directives
// (the parts everyone reads); other fields fall back to English per field.

export class AdvisorError extends Error {
  constructor(message: string, readonly kind: "refusal" | "max_tokens" | "parse" | "empty") {
    super(message);
  }
}

// ── Vocabulary ─────────────────────────────────────────────────────

export interface Localized {
  en: string;
  he: string;
}
export type AdvisorLang = "en" | "he";

/** The text in `lang`, falling back to English when the Hebrew is missing. */
export const tx = (l: Localized | null | undefined, lang: AdvisorLang): string =>
  !l ? "" : lang === "he" ? l.he || l.en : l.en || l.he;

export const ADVISOR_THEMES = [
  { id: "fees", title: { en: "Fees", he: "דמי ניהול" } },
  { id: "retirement", title: { en: "Retirement gap", he: "פער פרישה" } },
  { id: "insurance", title: { en: "Insurance", he: "ביטוח" } },
  { id: "tax", title: { en: "Tax & reporting", he: "מס ודיווח" } },
  { id: "allocation", title: { en: "Allocation", he: "הקצאת נכסים" } },
  { id: "opportunities", title: { en: "New investment ideas", he: "הזדמנויות השקעה חדשות" } },
  { id: "real-estate", title: { en: "Real estate", he: "נדל״ן" } },
  { id: "education", title: { en: "Education", he: "חינוך" } },
  { id: "cash", title: { en: "Cash & liquidity", he: "מזומן ונזילות" } },
  { id: "data", title: { en: "Missing data", he: "נתונים חסרים" } },
  { id: "other", title: { en: "Other", he: "אחר" } },
] as const;

export type AdvisorThemeId = (typeof ADVISOR_THEMES)[number]["id"];
const THEME_IDS = new Set<string>(ADVISOR_THEMES.map((t) => t.id));
/** The standing theme every report fills with 2–4 investment types the household doesn't hold. */
export const OPPORTUNITIES_THEME = "opportunities";
export const MIN_OPPORTUNITIES = 2;
export const themeTitle = (id: string): Localized => {
  const t = ADVISOR_THEMES.find((x) => x.id === id)?.title;
  return t ? { en: t.en, he: t.he } : { en: id, he: "" };
};

export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

/** critical = money/cover is being lost now or a hard deadline is < 30 days away. */
export const URGENCY_LEVELS = ["critical", "high", "medium", "low"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const THEME_TONES = ["good", "watch", "act"] as const;
export type ThemeTone = (typeof THEME_TONES)[number];

/**
 * Ten-year value of a recurring annual saving, compounded at a 4% real
 * return: the future value of a 10-payment annuity, (1.04^10 − 1) / 0.04.
 */
export const TEN_YEAR_REAL_RATE = 0.04;
export const TEN_YEAR_FACTOR = (Math.pow(1 + TEN_YEAR_REAL_RATE, 10) - 1) / TEN_YEAR_REAL_RATE; // ≈ 12.006

/** The ranking number: annual × FV factor + one-time. */
export function tenYearValue(annualUsd: number | null | undefined, oneTimeUsd: number | null | undefined): number {
  return Math.round((annualUsd ?? 0) * TEN_YEAR_FACTOR + (oneTimeUsd ?? 0));
}

export const MAX_QUICK_WINS = 5;

// ── Types ──────────────────────────────────────────────────────────

export interface AdvisorBenefit {
  annualUsd: number | null;
  oneTimeUsd: number | null;
  /** Comparable ranking number (see tenYearValue); conservative for risk items. */
  tenYearUsd: number;
  riskReduction: Localized | null;
  /** How the numbers were estimated, with snapshot inputs. */
  basis: Localized;
}

export interface AdvisorUrgency {
  level: UrgencyLevel;
  /** ISO date (YYYY-MM-DD) of a hard deadline, if there is one. */
  deadline: string | null;
  note: Localized | null;
}

export interface AdvisorActionItem {
  id: string;
  /** task.en is also the persistence key input (see actionKey). */
  task: Localized;
  /** Household member key, or "household". */
  who: string;
  /** Provider / professional, with phone or URL when known. */
  contact: Localized | null;
  dueBy: string | null;
  effortMinutes: number | null;
  /** Always false from the model; the UI overlays the persisted status. */
  done: boolean;
}

export const EMAIL_CONTACT_ROLES = ["insurance_agent", "pension_agent", "cpa", "hr_benefits", "provider", "property_manager", "other"] as const;
export type EmailContactRole = (typeof EMAIL_CONTACT_ROLES)[number];
export const PROPERTY_SUB_THEMES = ["tax", "profit", "revenue"] as const;
export type PropertySubTheme = (typeof PROPERTY_SUB_THEMES)[number];

/**
 * A ready-to-send email to whoever must act (agent, provider, CPA, HR,
 * property manager). Single-language: Hebrew for Israeli accounts, English
 * for US ones. Account numbers never appear: the body uses
 * {{account:<snapshot account id>}} placeholders that the app fills in from
 * the user's own data when the email is opened (see advisor-email.ts).
 */
export interface AdvisorEmail {
  id: string;
  contactRole: EmailContactRole;
  contactId: string | null;
  accountIds: string[];
  language: AdvisorLang;
  subject: string;
  body: string;
  /** The action item that "Mark as sent" ticks (falls back to the first open one). */
  actionItemId: string | null;
}

export interface AdvisorRecommendation {
  /** Stable kebab-case slug, reused across runs for the same recommendation. */
  id: string;
  themeId: string;
  /** Set for property-level recommendations (snapshot realEstate.rentals[].id). */
  propertyId: string | null;
  subTheme: PropertySubTheme | null;
  title: Localized;
  owner: string;
  confidence: Level;
  benefit: AdvisorBenefit;
  effort: Level;
  urgency: AdvisorUrgency;
  whatToChange: { current: Localized; target: Localized };
  why: Localized;
  howToChange: Localized[];
  actionItems: AdvisorActionItem[];
  dependsOn: string[];
  risksIfIgnored: Localized;
  emails: AdvisorEmail[];
}

export interface AdvisorQuickWin {
  recId: string;
  /** One imperative sentence: provider, exact ask, number, deadline. */
  directive: Localized;
}

export interface AdvisorTheme {
  id: string;
  title: Localized;
  status: Localized;
  tone: ThemeTone;
  /** Server-computed from the theme's recommendations. */
  totalTenYearUsd: number;
  totalAnnualUsd: number;
  recommendationCount: number;
}

export interface AdvisorTotals {
  tenYearUsd: number;
  annualUsd: number;
  oneTimeUsd: number;
  recommendationCount: number;
  actionItemCount: number;
}

/** The normalized report the app stores and renders. */
export interface AdvisorOutput {
  version: 2;
  /** True when mapped from a v1 report (no benefits/steps/action items/Hebrew yet). */
  legacy?: boolean;
  /** Languages with full coverage of the headline/summary/titles/directives. */
  languages: AdvisorLang[];
  headline: Localized;
  executiveSummary: Localized[];
  quickWins: AdvisorQuickWin[];
  themes: AdvisorTheme[];
  recommendations: AdvisorRecommendation[];
  totals: AdvisorTotals;
  questionsForUser: { question: Localized; why: Localized }[];
  disclaimers: Localized[];
}

// ── JSON schema (what the model writes) ────────────────────────────
// Structured-outputs style: every object closed, every field required,
// optionals expressed as nullable. Theme totals and the sort order are
// computed by the server, so they are not part of the model's output.

const LOC_DESC = "English (en) and natural Israeli financial Hebrew (he). Keep Hebrew product names native (קרן השתלמות, ביטוח מנהלים).";
const loc = (description: string) => ({
  type: "object",
  additionalProperties: false,
  required: ["en", "he"],
  description: `${description} ${LOC_DESC}`,
  properties: { en: { type: "string" }, he: { type: "string" } },
});
const locOrNull = (description: string) => ({ ...loc(description), type: ["object", "null"] });
const nullable = (type: "string" | "number", description: string) => ({ type: [type, "null"], description });
const THEME_ENUM = ADVISOR_THEMES.map((t) => t.id);

export const ADVISOR_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "executiveSummary", "quickWins", "themes", "recommendations", "questionsForUser", "disclaimers"],
  properties: {
    headline: loc("One-sentence bottom line for the household."),
    executiveSummary: {
      type: "array",
      items: loc("One bullet."),
      description:
        "3–5 bullets: where the household stands (net worth, retirement readiness vs goal, biggest risk) and the total quantified upside if they do everything. Snapshot numbers only.",
    },
    quickWins: {
      type: "array",
      description:
        "\"Money on the table — act this week\": the top 3–5 recommendations by tenYearUsd ÷ effort that are high-confidence and doable within ~2 weeks. Each references a recommendation id.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["recId", "directive"],
        properties: {
          recId: { type: "string", description: "The id of a recommendation in this report." },
          directive: loc(
            "One imperative sentence naming the provider, the exact ask, the number and the deadline, ending with the saving (e.g. 'Call <provider> and ask to cut the accumulation fee from 1.00% to 0.20% — saves ~$3,200/yr')."
          ),
        },
      },
    },
    themes: {
      type: "array",
      description:
        "The high-level layer. One entry per theme you assessed, including themes that are fine (tone good). Always include 'opportunities'.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "status", "tone"],
        properties: {
          id: { type: "string", enum: THEME_ENUM },
          title: loc("Theme title."),
          status: loc("One line: where this theme stands, with a number."),
          tone: { type: "string", enum: [...THEME_TONES], description: "good = on track, watch = minor, act = needs action." },
        },
      },
    },
    recommendations: {
      type: "array",
      description:
        "Every recommendation, quantified. Order does not matter: the server ranks by benefit.tenYearUsd. Include 2–4 'opportunities' recommendations: investment types the household doesn't hold today that fit its profile.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "themeId",
          "title",
          "owner",
          "confidence",
          "benefit",
          "effort",
          "urgency",
          "whatToChange",
          "why",
          "howToChange",
          "actionItems",
          "dependsOn",
          "risksIfIgnored",
          "propertyId",
          "subTheme",
          "emails",
        ],
        properties: {
          id: {
            type: "string",
            description:
              "Stable kebab-case slug (e.g. fees-adult1-pension-accumulation). Reuse the id from previousRecommendations when it is the same recommendation.",
          },
          themeId: { type: "string", enum: THEME_ENUM },
          propertyId: nullable("string", "For property-level recommendations: the snapshot realEstate.rentals[].id (or residence id); else null."),
          subTheme: {
            type: ["string", "null"],
            enum: [...PROPERTY_SUB_THEMES, null],
            description: "For property-level recommendations: tax | profit | revenue; else null.",
          },
          title: loc("Imperative, specific: what to do and to what."),
          owner: { type: "string", description: 'Household member key from the snapshot, or "household".' },
          confidence: { type: "string", enum: [...LEVELS] },
          benefit: {
            type: "object",
            additionalProperties: false,
            required: ["annualUsd", "oneTimeUsd", "tenYearUsd", "riskReduction", "basis"],
            properties: {
              annualUsd: nullable("number", "Recurring USD per year, from snapshot figures; null if not recurring."),
              oneTimeUsd: nullable("number", "One-off USD gain or avoided cost; null if none."),
              tenYearUsd: {
                type: "number",
                description:
                  "Ranking number: annualUsd × 12.006 (10 years compounded at 4% real) + oneTimeUsd. For pure risk items, a conservative expected value (probability × loss, or the cost of the gap) — explain it in basis.",
              },
              riskReduction: locOrNull("What risk shrinks and by how much, in words; null if none."),
              basis: loc("How it was estimated: snapshot inputs, the rule used, and a range when uncertain."),
            },
          },
          effort: { type: "string", enum: [...LEVELS] },
          urgency: {
            type: "object",
            additionalProperties: false,
            required: ["level", "deadline", "note"],
            properties: {
              level: { type: "string", enum: [...URGENCY_LEVELS] },
              deadline: nullable("string", "YYYY-MM-DD of a hard deadline (filing date, enrolment window, liquidity date), else null."),
              note: locOrNull("Why now / what the deadline is; null if nothing specific."),
            },
          },
          whatToChange: {
            type: "object",
            additionalProperties: false,
            required: ["current", "target"],
            properties: {
              current: loc("Current state in concrete numbers."),
              target: loc("Desired state in concrete numbers."),
            },
          },
          why: loc("Rationale grounded in snapshot numbers and the knowledge-base rule it relies on."),
          howToChange: { type: "array", items: loc("One step."), description: "Ordered steps of the approach." },
          actionItems: {
            type: "array",
            description: "Tick-off-able tasks (≤ 1 hour each where possible).",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "task", "who", "contact", "dueBy", "effortMinutes", "done"],
              properties: {
                id: { type: "string", description: "Short id unique within the recommendation (a1, a2…)." },
                task: loc(
                  "One concrete task: who to call / which form / what to ask for. Copy the en text of continuing tasks verbatim from previousRecommendations (it is the tick key)."
                ),
                who: { type: "string", description: 'Member key who does it, or "household".' },
                contact: locOrNull("Provider or professional, with phone/URL if known; null if none."),
                dueBy: nullable("string", "YYYY-MM-DD, if there is a natural due date."),
                effortMinutes: nullable("number", "Rough minutes to complete."),
                done: { type: "boolean", description: "Always false; the app tracks completion." },
              },
            },
          },
          dependsOn: { type: "array", items: { type: "string" }, description: "Ids of recommendations that should happen first." },
          risksIfIgnored: loc("What happens if nothing changes (for opportunities: the risks of the idea itself), quantified where possible."),
          emails: {
            type: "array",
            description:
              "One email per person who must act (agent, provider, CPA, HR, property manager); [] when the household acts alone. Never write account or policy numbers: use {{account:<snapshot account id>}}.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "contactRole", "contactId", "accountIds", "language", "subject", "body", "actionItemId"],
              properties: {
                id: { type: "string", description: "Short id unique within the recommendation (e1, e2…)." },
                contactRole: { type: "string", enum: [...EMAIL_CONTACT_ROLES] },
                contactId: nullable("string", "A snapshot contacts[].id (or the account's contactId) if one fits, else null."),
                accountIds: { type: "array", items: { type: "string" }, description: "Snapshot savingsAccounts[].id values the email concerns." },
                language: { type: "string", enum: ["he", "en"], description: "he for Israeli accounts/agents, en for US providers/HR/CPA/property managers." },
                subject: { type: "string" },
                body: {
                  type: "string",
                  description:
                    "Complete letter: who we are; which account via {{account:<id>}}; exactly what to do or check, with numbers; documents to send back; a reply-by date; signed with the owner's name. Formal Israeli business Hebrew for he; concise professional English for en.",
                },
                actionItemId: nullable("string", "The id of the action item this email completes (e.g. a2)."),
              },
            },
          },
        },
      },
    },
    questionsForUser: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "why"],
        properties: { question: loc("The question."), why: loc("Why it matters.") },
      },
    },
    disclaimers: { type: "array", items: loc("One disclaimer.") },
  },
} as const;

// ── Coercion helpers ───────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim() : fallback);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** `{ en, he }` or a bare string (English only). */
export function toLocalized(v: unknown): Localized {
  if (typeof v === "string") return { en: v.trim(), he: "" };
  if (isObj(v)) return { en: str(v.en), he: str(v.he) };
  return { en: "", he: "" };
}
const locOrNullOf = (v: unknown): Localized | null => {
  const l = toLocalized(v);
  return l.en || l.he ? l : null;
};
const locList = (v: unknown): Localized[] => (Array.isArray(v) ? v.map(toLocalized).filter((l) => l.en || l.he) : []);
const hasText = (l: Localized) => !!(l.en || l.he);

export function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "rec"
  );
}

const URGENCY_RANK: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const EFFORT_RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };
/** Divisor for the quick-win score (benefit ÷ effort). */
export const EFFORT_WEIGHT: Record<Level, number> = { low: 1, medium: 2, high: 4 };

/**
 * Rank: 10-year benefit (desc), then urgency, then the earlier deadline,
 * then lower effort; otherwise the model's order (stable sort).
 */
export function compareRecommendations(a: AdvisorRecommendation, b: AdvisorRecommendation): number {
  if (b.benefit.tenYearUsd !== a.benefit.tenYearUsd) return b.benefit.tenYearUsd - a.benefit.tenYearUsd;
  const u = URGENCY_RANK[a.urgency.level] - URGENCY_RANK[b.urgency.level];
  if (u) return u;
  const da = a.urgency.deadline ?? "9999";
  const db = b.urgency.deadline ?? "9999";
  if (da !== db) return da < db ? -1 : 1;
  return EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
}

export function rankRecommendations(recs: AdvisorRecommendation[]): AdvisorRecommendation[] {
  return recs
    .map((r, i) => ({ r, i }))
    .sort((x, y) => compareRecommendations(x.r, y.r) || x.i - y.i)
    .map((x) => x.r);
}

export const quickWinScore = (r: AdvisorRecommendation): number => r.benefit.tenYearUsd / EFFORT_WEIGHT[r.effort];

/**
 * Sum each theme's recommendations; add themes that recommendations reference
 * but the model forgot to list, and always the standing opportunities theme.
 * Ordered by total 10-year benefit (desc), with empty themes (status-only,
 * e.g. "on track") last in the model's order.
 */
export function computeThemes(
  declared: Pick<AdvisorTheme, "id" | "title" | "status" | "tone">[],
  recs: AdvisorRecommendation[],
  opts: { ensureOpportunities?: boolean } = {}
): AdvisorTheme[] {
  const byId = new Map<string, AdvisorTheme>();
  const blank = (id: string): AdvisorTheme => ({
    id,
    title: themeTitle(id),
    status: { en: "", he: "" },
    tone: "watch",
    totalTenYearUsd: 0,
    totalAnnualUsd: 0,
    recommendationCount: 0,
  });
  for (const t of declared) {
    if (byId.has(t.id)) continue;
    byId.set(t.id, { ...t, totalTenYearUsd: 0, totalAnnualUsd: 0, recommendationCount: 0 });
  }
  for (const r of recs) {
    let t = byId.get(r.themeId);
    if (!t) {
      t = blank(r.themeId);
      byId.set(r.themeId, t);
    }
    t.totalTenYearUsd += r.benefit.tenYearUsd;
    t.totalAnnualUsd += r.benefit.annualUsd ?? 0;
    t.recommendationCount += 1;
  }
  if (opts.ensureOpportunities && !byId.has(OPPORTUNITIES_THEME)) byId.set(OPPORTUNITIES_THEME, blank(OPPORTUNITIES_THEME));
  const order = [...byId.keys()];
  return [...byId.values()].sort(
    (a, b) => b.totalTenYearUsd - a.totalTenYearUsd || b.recommendationCount - a.recommendationCount || order.indexOf(a.id) - order.indexOf(b.id)
  );
}

export function computeTotals(recs: AdvisorRecommendation[]): AdvisorTotals {
  return {
    tenYearUsd: recs.reduce((s, r) => s + r.benefit.tenYearUsd, 0),
    annualUsd: recs.reduce((s, r) => s + (r.benefit.annualUsd ?? 0), 0),
    oneTimeUsd: recs.reduce((s, r) => s + (r.benefit.oneTimeUsd ?? 0), 0),
    recommendationCount: recs.length,
    actionItemCount: recs.reduce((s, r) => s + r.actionItems.length, 0),
  };
}

/**
 * Quick wins in benefit ÷ effort order (max 5). When the model supplied none
 * (or it's a legacy report), derive them: confidence not low, effort not high,
 * not a critical-path dependency, positive benefit; the title is the directive.
 */
export function rankQuickWins(declared: AdvisorQuickWin[], recs: AdvisorRecommendation[]): AdvisorQuickWin[] {
  const byId = new Map(recs.map((r) => [r.id, r]));
  const score = (q: AdvisorQuickWin) => quickWinScore(byId.get(q.recId)!);
  if (declared.length > 0) {
    const seen = new Set<string>();
    return declared
      .filter((q) => byId.has(q.recId) && !seen.has(q.recId) && seen.add(q.recId))
      .map((q, i) => ({ q, i }))
      .sort((a, b) => score(b.q) - score(a.q) || a.i - b.i)
      .map((x) => x.q)
      .slice(0, MAX_QUICK_WINS);
  }
  return recs
    .filter((r) => r.confidence !== "low" && r.effort !== "high" && r.benefit.tenYearUsd > 0 && r.dependsOn.length === 0)
    .sort((a, b) => quickWinScore(b) - quickWinScore(a))
    .slice(0, 3)
    .map((r) => ({ recId: r.id, directive: r.title }));
}

// ── v2 normalization ───────────────────────────────────────────────

function normalizeActionItems(v: unknown, owner: string): AdvisorActionItem[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: AdvisorActionItem[] = [];
  v.forEach((raw, i) => {
    const a: Obj = isObj(raw) ? raw : { task: raw };
    const task = toLocalized(a.task);
    if (!task.en && task.he) task.en = task.he; // key needs a stable text
    if (!task.en) return;
    let id = str(a.id) || `a${i + 1}`;
    while (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    const minutes = num(a.effortMinutes);
    out.push({
      id,
      task,
      who: str(a.who) || owner,
      contact: locOrNullOf(a.contact),
      dueBy: str(a.dueBy) || null,
      effortMinutes: minutes != null && minutes > 0 ? Math.round(minutes) : null,
      done: false,
    });
  });
  return out;
}

function normalizeRecommendation(raw: unknown, i: number, issues: string[]): AdvisorRecommendation | null {
  const where = `recommendations[${i}]`;
  if (!isObj(raw)) {
    issues.push(`${where} is not an object`);
    return null;
  }
  const title = toLocalized(raw.title);
  if (!hasText(title)) {
    issues.push(`${where}.title is missing`);
    return null;
  }
  const label = title.en || title.he;
  if (!title.he) issues.push(`${where}.title.he is missing ("${label}")`);
  const b = isObj(raw.benefit) ? raw.benefit : {};
  const annualUsd = num(b.annualUsd);
  const oneTimeUsd = num(b.oneTimeUsd);
  let tenYearUsd = num(b.tenYearUsd);
  if (tenYearUsd == null) {
    if (annualUsd != null || oneTimeUsd != null) tenYearUsd = tenYearValue(annualUsd, oneTimeUsd);
    else issues.push(`${where}.benefit.tenYearUsd is missing ("${label}")`);
  }
  if (!Array.isArray(raw.howToChange)) issues.push(`${where}.howToChange must be an array ("${label}")`);
  if (!Array.isArray(raw.actionItems)) issues.push(`${where}.actionItems must be an array ("${label}")`);

  const owner = str(raw.owner) || "household";
  const themeRaw = str(raw.themeId);
  const u = isObj(raw.urgency) ? raw.urgency : {};
  const w = isObj(raw.whatToChange) ? raw.whatToChange : {};
  return {
    id: str(raw.id) ? slugify(str(raw.id)) : slugify(title.en || `rec-${i + 1}`),
    themeId: THEME_IDS.has(themeRaw) ? themeRaw : "other",
    title,
    owner,
    confidence: oneOf(raw.confidence, LEVELS, "medium"),
    benefit: {
      annualUsd,
      oneTimeUsd,
      tenYearUsd: Math.max(0, Math.round(tenYearUsd ?? 0)),
      riskReduction: locOrNullOf(b.riskReduction),
      basis: toLocalized(b.basis),
    },
    effort: oneOf(raw.effort, LEVELS, "medium"),
    urgency: {
      level: oneOf(u.level, URGENCY_LEVELS, "medium"),
      deadline: str(u.deadline) || null,
      note: locOrNullOf(u.note),
    },
    whatToChange: { current: toLocalized(w.current), target: toLocalized(w.target) },
    why: toLocalized(raw.why),
    howToChange: locList(raw.howToChange),
    actionItems: normalizeActionItems(raw.actionItems, owner),
    dependsOn: (Array.isArray(raw.dependsOn) ? raw.dependsOn : []).map((d) => slugify(str(d))).filter((d) => d !== "rec"),
    risksIfIgnored: toLocalized(raw.risksIfIgnored),
    propertyId: str(raw.propertyId) || null,
    subTheme: str(raw.propertyId) ? oneOf(raw.subTheme, PROPERTY_SUB_THEMES, "profit") : null,
    emails: normalizeEmails(raw.emails, issues, where),
  };
}

function normalizeEmails(v: unknown, issues: string[], where: string): AdvisorEmail[] {
  if (!Array.isArray(v)) return [];
  const out: AdvisorEmail[] = [];
  v.forEach((raw, i) => {
    if (!isObj(raw)) return;
    const body = str(raw.body);
    const subject = str(raw.subject);
    if (!body || !subject) {
      issues.push(`${where}.emails[${i}] needs subject and body`);
      return;
    }
    if (/\b\d{6,}\b/.test(body.replace(/\{\{[^}]*\}\}/g, ""))) {
      issues.push(`${where}.emails[${i}] looks like it contains an account number — use {{account:<id>}}`);
    }
    out.push({
      id: str(raw.id) || `e${i + 1}`,
      contactRole: oneOf(raw.contactRole, EMAIL_CONTACT_ROLES, "other"),
      contactId: str(raw.contactId) || null,
      accountIds: (Array.isArray(raw.accountIds) ? raw.accountIds : []).map((x) => str(x)).filter(Boolean),
      language: raw.language === "he" ? "he" : "en",
      subject,
      body,
      actionItemId: str(raw.actionItemId) || null,
    });
  });
  return out;
}

/** Make recommendation ids unique (a model can repeat a slug). */
function dedupeIds(recs: AdvisorRecommendation[]): AdvisorRecommendation[] {
  const seen = new Map<string, number>();
  return recs.map((r) => {
    const n = seen.get(r.id) ?? 0;
    seen.set(r.id, n + 1);
    return n === 0 ? r : { ...r, id: `${r.id}-${n + 1}` };
  });
}

type Base = Pick<AdvisorOutput, "headline" | "executiveSummary" | "questionsForUser" | "disclaimers" | "languages">;

function finish(
  base: Base,
  declaredThemes: Pick<AdvisorTheme, "id" | "title" | "status" | "tone">[],
  recs: AdvisorRecommendation[],
  declaredWins: AdvisorQuickWin[],
  ensureOpportunities: boolean
): AdvisorOutput {
  const ids = new Set(recs.map((r) => r.id));
  const ranked = rankRecommendations(recs).map((r) => ({ ...r, dependsOn: r.dependsOn.filter((d) => d !== r.id && ids.has(d)) }));
  return {
    version: 2,
    ...base,
    quickWins: rankQuickWins(declaredWins, ranked),
    themes: computeThemes(declaredThemes, ranked, { ensureOpportunities }),
    recommendations: ranked,
    totals: computeTotals(ranked),
  };
}

function questionsOf(v: unknown): { question: Localized; why: Localized }[] {
  return Array.isArray(v)
    ? v.filter(isObj).map((q) => ({ question: toLocalized(q.question), why: toLocalized(q.why) })).filter((q) => hasText(q.question))
    : [];
}

function normalizeV2(o: Obj, opts: { strict: boolean; requiredPropertyIds?: string[] }): AdvisorOutput {
  const issues: string[] = [];
  const recs = dedupeIds(
    (o.recommendations as unknown[]).map((r, i) => normalizeRecommendation(r, i, issues)).filter((r): r is AdvisorRecommendation => r != null)
  );
  const headline = toLocalized(o.headline);
  const summary = locList(o.executiveSummary);
  if (!headline.he) issues.push("headline.he is missing");
  if (!Array.isArray(o.executiveSummary)) issues.push("executiveSummary must be an array");
  else if (summary.some((s) => !s.he)) issues.push("executiveSummary bullets need he");

  const ids = new Set(recs.map((r) => r.id));
  const wins: AdvisorQuickWin[] = [];
  if (Array.isArray(o.quickWins)) {
    o.quickWins.forEach((q, i) => {
      if (!isObj(q)) return;
      const recId = slugify(str(q.recId));
      const directive = toLocalized(q.directive);
      if (!ids.has(recId)) issues.push(`quickWins[${i}].recId "${str(q.recId)}" is not a recommendation id`);
      else if (!hasText(directive)) issues.push(`quickWins[${i}].directive is missing`);
      else {
        if (!directive.he) issues.push(`quickWins[${i}].directive.he is missing`);
        wins.push({ recId, directive });
      }
    });
  } else issues.push("quickWins is required");

  const opportunities = recs.filter((r) => r.themeId === OPPORTUNITIES_THEME).length;
  if (opportunities < MIN_OPPORTUNITIES) issues.push(`at least ${MIN_OPPORTUNITIES} "opportunities" recommendations are required (got ${opportunities})`);
  for (const pid of opts.requiredPropertyIds ?? []) {
    if (!recs.some((r) => r.propertyId === pid)) issues.push(`no recommendation reviews rental property ${pid} (set propertyId)`);
  }

  // Hard failures always; language/coverage rules only for fresh model output.
  const hard = issues.filter((m) => /tenYearUsd|must be an array|title is missing|not an object|not a recommendation id|directive is missing/.test(m));
  const fatal = opts.strict ? issues : hard;
  if (fatal.length) {
    const shown = fatal.slice(0, 6).join("; ");
    throw new AdvisorError(`Advisor output failed validation: ${shown}${fatal.length > 6 ? ` (+${fatal.length - 6} more)` : ""}.`, "parse");
  }

  const declared = (Array.isArray(o.themes) ? o.themes : []).filter(isObj).map((t) => {
    const id = THEME_IDS.has(str(t.id)) ? str(t.id) : "other";
    const title = toLocalized(t.title);
    const def = themeTitle(id);
    return {
      id,
      title: { en: title.en || def.en, he: title.he || def.he },
      status: toLocalized(t.status),
      tone: oneOf(t.tone, THEME_TONES, "watch"),
    };
  });
  const heComplete = !!headline.he && summary.every((s) => !!s.he) && recs.every((r) => !!r.title.he) && wins.every((w) => !!w.directive.he);
  return finish(
    {
      headline,
      executiveSummary: summary,
      questionsForUser: questionsOf(o.questionsForUser),
      disclaimers: locList(o.disclaimers),
      languages: heComplete ? ["en", "he"] : ["en"],
    },
    declared,
    recs,
    wins,
    true
  );
}

// ── v1 (legacy) mapping ────────────────────────────────────────────

const LEGACY_THEME: Record<string, AdvisorThemeId> = {
  fees: "fees",
  consolidation: "fees",
  allocation: "allocation",
  insurance: "insurance",
  "insurance-overlap": "insurance",
  tax: "tax",
  liquidity: "cash",
  "cash-flow": "cash",
  retirement: "retirement",
  property: "real-estate",
  education: "education",
  "data-gap": "data",
};
const LEGACY_URGENCY: Record<string, UrgencyLevel> = { high: "high", medium: "medium", low: "low" };
const en = (s: string): Localized => ({ en: s, he: "" });

function mapLegacy(o: Obj): AdvisorOutput {
  const recs = (o.recommendations as unknown[]).filter(isObj).map((r, i): AdvisorRecommendation => {
    const title = str(r.title) || `Recommendation ${i + 1}`;
    const owner = str(r.owner) || "household";
    const annual = num(r.estimatedImpactUsdPerYear);
    const action = str(r.action);
    return {
      id: slugify(title),
      themeId: LEGACY_THEME[str(r.category)] ?? "other",
      title: en(title),
      owner,
      confidence: oneOf(r.confidence, LEVELS, "medium"),
      benefit: {
        annualUsd: annual,
        oneTimeUsd: null,
        tenYearUsd: annual != null && annual > 0 ? tenYearValue(annual, null) : 0,
        riskReduction: null,
        basis: en(annual != null ? "Older report: annual estimate only, compounded 10 years at 4% real." : "Older report: not quantified."),
      },
      effort: "medium",
      urgency: { level: LEGACY_URGENCY[str(r.priority)] ?? "medium", deadline: null, note: null },
      whatToChange: { current: en(""), target: en("") },
      why: en(str(r.rationale)),
      howToChange: action ? [en(action)] : [],
      actionItems: action ? [{ id: "a1", task: en(action), who: owner, contact: null, dueBy: null, effortMinutes: null, done: false }] : [],
      dependsOn: [],
      risksIfIgnored: en(""),
      propertyId: null,
      subTheme: null,
      emails: [],
    };
  });
  const commentary = str(o.netWorthCommentary);
  return {
    ...finish(
      {
        headline: en(str(o.headline)),
        executiveSummary: commentary ? [en(commentary)] : [],
        questionsForUser: questionsOf(o.questionsForUser),
        disclaimers: locList(o.disclaimers),
        languages: ["en"],
      },
      [],
      dedupeIds(recs),
      [],
      false
    ),
    legacy: true,
  };
}

/** v2 if it carries any v2-only field; v1 reports have rationale/action/priority. */
function isV2(o: Obj): boolean {
  if (Array.isArray(o.themes) || Array.isArray(o.executiveSummary) || Array.isArray(o.quickWins)) return true;
  const recs = o.recommendations as unknown[];
  return recs.some((r) => isObj(r) && ("benefit" in r || "actionItems" in r || "howToChange" in r));
}

/**
 * Validate and normalize advisor output (v2, or a v1 report mapped to v2 with
 * `legacy: true`). Ranks recommendations, quick wins and theme totals
 * regardless of the order the model returned. Throws AdvisorError("parse").
 *
 * strict (default) is for fresh model output: it also enforces the Hebrew
 * fields, valid quick-win ids, ≥2 opportunities, no raw account numbers in
 * emails and (with requiredPropertyIds) a recommendation for every rental. Stored reports are re-read
 * leniently so an older v2 report still renders.
 */
export function normalizeAdvisorOutput(raw: unknown, opts: { strict?: boolean; requiredPropertyIds?: string[] } = {}): AdvisorOutput {
  if (!isObj(raw) || !(typeof raw.headline === "string" || isObj(raw.headline)) || !Array.isArray(raw.recommendations)) {
    throw new AdvisorError("Advisor output is missing required fields (headline, recommendations).", "parse");
  }
  if (raw.version === 2 && raw.legacy) {
    // A stored, already-mapped legacy report.
    const out = normalizeV2(raw, { strict: false });
    return {
      ...out,
      themes: out.themes.filter((t) => t.id !== OPPORTUNITIES_THEME || t.recommendationCount > 0),
      legacy: true,
      languages: ["en"],
    };
  }
  return isV2(raw) ? normalizeV2(raw, { strict: opts.strict ?? true, requiredPropertyIds: opts.requiredPropertyIds }) : mapLegacy(raw);
}

/** Parse JSON text, then normalizeAdvisorOutput (strict). */
export function parseAdvisorOutput(text: string, opts: { requiredPropertyIds?: string[] } = {}): AdvisorOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AdvisorError("Advisor returned invalid JSON.", "parse");
  }
  return normalizeAdvisorOutput(raw, opts);
}

/** Lenient read of a stored report: null instead of throwing. */
export function readAdvisorOutput(v: unknown): AdvisorOutput | null {
  try {
    return normalizeAdvisorOutput(v, { strict: false });
  } catch {
    return null;
  }
}

// ── Action-item status (persisted checkboxes) ──────────────────────
//
// Key = hash(recommendation id + normalized English task text). Not the
// report id (a new report arrives every day) and not the item id (a1, a2…
// are positional and shift when the model inserts a step). The
// recommendation id is a semantic slug the brief tells the model to keep
// stable, and the context endpoint hands the previous report's ids and task
// wording back to the model so continuing items keep their text;
// normalization makes the key tolerant of case, punctuation and whitespace
// edits. The English text is used so toggling the UI language never changes
// a key. A reworded task is treated as a new task (unchecked) — the safe
// default.

export function normalizeTask(task: string): string {
  return task
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** cyrb53: a fast 53-bit string hash (same result in the browser and Node). */
function cyrb53(s: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** `task` is the English task text (AdvisorActionItem.task.en). */
export function actionKey(recId: string, task: string): string {
  return `ak_${cyrb53(`${slugify(recId)}\u0000${normalizeTask(task)}`).toString(36)}`;
}
export const itemKey = (rec: AdvisorRecommendation, item: AdvisorActionItem) => actionKey(rec.id, item.task.en);

/**
 * "Not relevant" is stored as a reserved pseudo task on the recommendation, so
 * it rides the same per-id persistence as ticks and survives regeneration.
 */
export const DISMISS_TASK = "__not_relevant__";
export const dismissKey = (recId: string) => actionKey(recId, DISMISS_TASK);
export const isDismissed = (rec: Pick<AdvisorRecommendation, "id">, status: ActionStatusMap) => !!status[dismissKey(rec.id)]?.done;

/** The dismissal row's task column: the marker plus JSON { title, reason }. */
export function encodeDismissal(title: string, reason: string | null): string {
  return `${DISMISS_TASK}:${JSON.stringify({ title, reason })}`;
}
export function decodeDismissal(task: string): { title: string; reason: string | null } | null {
  if (!task.startsWith(`${DISMISS_TASK}:`)) return null;
  const rest = task.slice(DISMISS_TASK.length + 1);
  try {
    const v = JSON.parse(rest) as { title?: unknown; reason?: unknown };
    return { title: typeof v.title === "string" ? v.title : "", reason: typeof v.reason === "string" && v.reason ? v.reason : null };
  } catch {
    return { title: rest, reason: null }; // saved before reasons existed: plain title
  }
}

/** `reason` is set only on "not relevant" rows. */
export type ActionStatusMap = Record<string, { done: boolean; doneAt: string | null; reason?: string | null }>;

export interface Progress {
  done: number;
  total: number;
}

export function recProgress(rec: AdvisorRecommendation, status: ActionStatusMap): Progress {
  const done = rec.actionItems.filter((a) => status[itemKey(rec, a)]?.done).length;
  return { done, total: rec.actionItems.length };
}

export function sumProgress(recs: AdvisorRecommendation[], status: ActionStatusMap): Progress {
  return recs.reduce(
    (acc, r) => {
      const p = recProgress(r, status);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

/** Benefit already captured: recommendations with every action item ticked. */
export function capturedTenYearUsd(recs: AdvisorRecommendation[], status: ActionStatusMap): number {
  return recs.reduce((s, r) => {
    const p = recProgress(r, status);
    return p.total > 0 && p.done === p.total ? s + r.benefit.tenYearUsd : s;
  }, 0);
}

/** First action item not yet ticked (null when all are done or there are none). */
export function nextActionItem(rec: AdvisorRecommendation, status: ActionStatusMap): AdvisorActionItem | null {
  return rec.actionItems.find((a) => !status[itemKey(rec, a)]?.done) ?? null;
}

/**
 * Compact view of the last report for the next run, so the model can reuse
 * recommendation ids and continuing task wording (and skip what's done).
 */
export function previousRecommendationsOf(
  output: AdvisorOutput | null,
  status: ActionStatusMap
): { id: string; title: string; themeId: string; actionItems: { task: string; done: boolean }[] }[] {
  if (!output) return [];
  // Dismissed ones travel separately (dismissedRecommendations).
  return output.recommendations.filter((r) => !isDismissed(r, status)).map((r) => ({
    id: r.id,
    title: r.title.en,
    themeId: r.themeId,
    actionItems: r.actionItems.map((a) => ({ task: a.task.en, done: !!status[itemKey(r, a)]?.done })),
  }));
}

/** English titles of the last report's investment ideas, so the next run rotates them. */
export function previousOpportunityTitlesOf(output: AdvisorOutput | null): string[] {
  return output ? output.recommendations.filter((r) => r.themeId === OPPORTUNITIES_THEME).map((r) => r.title.en) : [];
}
