// In-app "Ask" assistant — pure helpers shared by the client panel, the API
// routes and the pending-bundle builder. No server imports here: this module is
// bundled into the browser.
//
// How it works (docs/assistant.md): the user asks a question on any page; it is
// stored as an AssistantQuestion with status "pending". A Claude Code routine on
// the user's Claude subscription (skill: .claude/skills/answer-questions) polls
// GET /api/assistant/pending, answers from the data bundle + the app's source,
// and POSTs to /api/assistant/answer. No paid LLM API is called by the app.

export type AssistantLanguage = "he" | "en";
export type AssistantStatus = "pending" | "answered" | "failed";

export interface AssistantQuestionDTO {
  id: string;
  question: string;
  language: AssistantLanguage;
  pagePath: string;
  pageTitle: string | null;
  contextKeys: string[];
  status: AssistantStatus;
  answer: string | null;
  answeredAt: string | null;
  answeredBy: string | null;
  createdAt: string;
  readAt: string | null;
}

export const MAX_QUESTION_CHARS = 2000;
export const MAX_ANSWER_CHARS = 20000;
export const MAX_CONTEXT_KEYS = 30;
export const MAX_PATH_CHARS = 300;
export const MAX_TITLE_CHARS = 200;

// ── Language ────────────────────────────────────────────────────────

const HEBREW_LETTER = /[א-תװ-ײיִ-ﭏ]/;
const LATIN_LETTER = /[A-Za-z]/;

/**
 * "he" when the question is Hebrew, else "en". Uses the first strong letter
 * (the same rule as `dir="auto"`), so "מה זה cash-on-cash?" is Hebrew and
 * "What is קרן השתלמות?" is English; a text with over twice as many Hebrew as Latin letters that
 * starts with a Latin ticker ("SPY ירד היום, למה?") is Hebrew too.
 */
export function detectLanguage(text: string): AssistantLanguage {
  let he = 0;
  let latin = 0;
  let first: AssistantLanguage | null = null;
  for (const ch of text) {
    if (HEBREW_LETTER.test(ch)) {
      he++;
      first ??= "he";
    } else if (LATIN_LETTER.test(ch)) {
      latin++;
      first ??= "en";
    }
  }
  if (first === "he") return "he";
  return he > latin * 2 ? "he" : "en";
}

/** true when the text contains any Hebrew letter (input box direction). */
export function hasHebrew(text: string): boolean {
  return HEBREW_LETTER.test(text);
}

// ── Context keys ────────────────────────────────────────────────────
//
// A question carries `contextKeys`: what was on screen when it was asked.
//  - glossary keys from src/lib/explain.ts, e.g. "properties.equity"
//    (read from `data-explain-key` attributes in the DOM);
//  - entity refs: "property:<id>", "savings:<id>", "guidelines"
//    (from the URL, or `data-assistant-context` attributes in the DOM).

export type ContextRef =
  | { kind: "explain"; key: string }
  | { kind: "property"; id: string }
  | { kind: "savings"; id: string }
  | { kind: "guidelines" };

const GLOSSARY_KEY = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;
const ENTITY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function parseContextKey(raw: string): ContextRef | null {
  const k = raw.trim();
  if (!k || k.length > 120) return null;
  if (k === "guidelines") return { kind: "guidelines" };
  const m = /^(property|savings):(.+)$/.exec(k);
  if (m) {
    const id = m[2];
    if (!ENTITY_ID.test(id)) return null;
    return m[1] === "property" ? { kind: "property", id } : { kind: "savings", id };
  }
  return GLOSSARY_KEY.test(k) ? { kind: "explain", key: k } : null;
}

function refToKey(r: ContextRef): string {
  switch (r.kind) {
    case "explain":
      return r.key;
    case "guidelines":
      return "guidelines";
    default:
      return `${r.kind}:${r.id}`;
  }
}

/** Validate, normalise, dedupe and cap untrusted context keys (keeps order). */
export function normalizeContextKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const ref = parseContextKey(v);
    if (!ref) continue;
    const key = refToKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_CONTEXT_KEYS) break;
  }
  return out;
}

const NON_ENTITY_SEGMENTS = new Set(["new", "edit", "mock-preview", "mock-preview-detail"]);

/** Entity refs implied by the URL alone. */
export function contextKeysFromPath(pathname: string): string[] {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const segs = path.split("/").filter(Boolean);
  const keys: string[] = [];
  if (segs[0] === "properties" && segs[1] && !NON_ENTITY_SEGMENTS.has(segs[1]) && ENTITY_ID.test(segs[1])) {
    keys.push(`property:${segs[1]}`);
  }
  if (segs[0] === "trade" && segs[1] === "guidelines") keys.push("guidelines");
  return keys;
}

/** Splits a `data-assistant-context` value ("property:abc savings:xyz") into keys. */
function splitAttr(v: string | null | undefined): string[] {
  return v ? v.split(/[\s,]+/).filter(Boolean) : [];
}

/** The minimal DOM surface used, so tests can pass a stub. */
export interface ContextDomRoot {
  querySelectorAll(selector: string): ArrayLike<{ getAttribute(name: string): string | null }>;
}

/**
 * Everything to attach to a question: URL refs first, then the glossary keys
 * and entity refs found on the page. Never throws (the attributes are added by
 * other components and may be missing or malformed).
 */
export function collectContextKeys(pathname: string, root?: ContextDomRoot | null): string[] {
  const raw: string[] = [...contextKeysFromPath(pathname)];
  if (root) {
    try {
      const entity = root.querySelectorAll("[data-assistant-context]");
      for (let i = 0; i < entity.length; i++) raw.push(...splitAttr(entity[i].getAttribute("data-assistant-context")));
      const explain = root.querySelectorAll("[data-explain-key]");
      for (let i = 0; i < explain.length; i++) raw.push(...splitAttr(explain[i].getAttribute("data-explain-key")));
    } catch {
      // Malformed DOM or selector support — URL refs are still useful.
    }
  }
  return normalizeContextKeys(raw);
}

// ── Suggested starters ──────────────────────────────────────────────

export interface Starter {
  he: string;
  en: string;
}

const GENERAL_STARTERS: Starter[] = [
  { he: "מה המספרים בעמוד הזה אומרים?", en: "What do the numbers on this page mean?" },
  { he: "איך האפליקציה מחשבת את זה?", en: "How does the app calculate this?" },
];

const STARTERS: { match: (segs: string[]) => boolean; items: Starter[] }[] = [
  {
    match: (s) => s[0] === "properties" && !!s[1],
    items: [
      { he: "מה זה cash-on-cash?", en: "What is cash-on-cash return?" },
      { he: "למה ההון העצמי בנכס הזה השתנה?", en: "Why did this property's equity change?" },
      { he: "האם שכר הדירה כאן בשוק?", en: "Is the rent here in line with the market?" },
    ],
  },
  {
    match: (s) => s[0] === "properties",
    items: [
      { he: "מה זה cash-on-cash?", en: "What is cash-on-cash return?" },
      { he: "למה ההון העצמי ירד?", en: "Why did the equity go down?" },
      { he: "איזה נכס מניב הכי טוב?", en: "Which property has the best yield?" },
    ],
  },
  {
    match: (s) => s[0] === "savings" && s[1] === "benefits",
    items: [
      { he: "יש לי כפל ביטוחים?", en: "Do I have duplicate insurance?" },
      { he: "אילו כיסויים חסרים לנו?", en: "Which coverages are we missing?" },
    ],
  },
  {
    match: (s) => s[0] === "savings",
    items: [
      { he: "מה זה דמי ניהול מצבירה ולמה זה חשוב?", en: "What is the accumulation fee and why does it matter?" },
      { he: "מתי אפשר למשוך את קרן ההשתלמות?", en: "When can the study fund be withdrawn?" },
      { he: "האם אנחנו בדרך ליעד הפרישה?", en: "Are we on track for retirement?" },
    ],
  },
  {
    match: (s) => s[0] === "trade" && s[1] === "guidelines",
    items: [
      { he: "למה ההנחיה ממליצה לקנות SPY?", en: "Why does the guideline suggest buying SPY?" },
      { he: "מה זה סטייה מהיעד (drift)?", en: "What is drift from target?" },
      { he: "מה זה איתות ירידה (dip)?", en: "What is a dip signal?" },
    ],
  },
  {
    match: (s) => s[0] === "trade",
    items: [
      { he: "איך מחושב ה־P&L?", en: "How is P&L calculated?" },
      { he: "מה זה R-multiple?", en: "What is an R-multiple?" },
    ],
  },
  {
    match: (s) => s[0] === "home",
    items: [
      { he: "על מה הוצאנו הכי הרבה החודש?", en: "What did we spend the most on this month?" },
      { he: "מה זה שיעור החיסכון?", en: "What is the savings rate?" },
    ],
  },
  {
    match: (s) => s.length === 0,
    items: [
      { he: "איך מחושב השווי הנקי?", en: "How is net worth calculated?" },
      { he: "למה השווי הנקי השתנה החודש?", en: "Why did net worth change this month?" },
      { he: "מה ההמלצה הכי חשובה של היועץ?", en: "What is the advisor's top recommendation?" },
    ],
  },
];

/** Suggested first questions for the current page (page-specific first). */
export function startersFor(pathname: string): Starter[] {
  const segs = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  const hit = STARTERS.find((s) => s.match(segs));
  return [...(hit?.items ?? []), ...GENERAL_STARTERS].slice(0, 4);
}

// ── Input validation ────────────────────────────────────────────────

export interface CreateQuestionInput {
  question: string;
  language: AssistantLanguage;
  pagePath: string;
  pageTitle: string | null;
  contextKeys: string[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export function parseCreateQuestion(body: unknown): CreateQuestionInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const question = typeof b.question === "string" ? b.question.trim() : "";
  if (!question) return { error: "question is required" };
  if (question.length > MAX_QUESTION_CHARS) return { error: `question is longer than ${MAX_QUESTION_CHARS} characters` };
  let pagePath = typeof b.pagePath === "string" ? b.pagePath.trim() : "/";
  if (!pagePath.startsWith("/")) pagePath = "/";
  const pageTitle = typeof b.pageTitle === "string" && b.pageTitle.trim() ? clip(b.pageTitle.trim(), MAX_TITLE_CHARS) : null;
  return {
    question,
    language: detectLanguage(question),
    pagePath: clip(pagePath, MAX_PATH_CHARS),
    pageTitle,
    contextKeys: normalizeContextKeys(b.contextKeys),
  };
}

export interface AnswerInput {
  id: string;
  answer: string;
  status: "answered" | "failed";
  answeredBy: string;
}

export function parseAnswer(body: unknown): AnswerInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id.trim() : "";
  if (!id || !ENTITY_ID.test(id)) return { error: "id is required" };
  const status = b.status === undefined ? "answered" : b.status;
  if (status !== "answered" && status !== "failed") return { error: 'status must be "answered" or "failed"' };
  const answer = typeof b.answer === "string" ? b.answer.trim() : "";
  if (!answer) return { error: status === "failed" ? "answer must give the failure reason" : "answer is required" };
  if (answer.length > MAX_ANSWER_CHARS) return { error: `answer is longer than ${MAX_ANSWER_CHARS} characters` };
  const answeredBy = typeof b.answeredBy === "string" && b.answeredBy.trim() ? clip(b.answeredBy.trim(), 60) : "claude-code";
  return { id, answer, status, answeredBy };
}

// ── Display helpers ─────────────────────────────────────────────────

export function unreadCount(qs: Pick<AssistantQuestionDTO, "status" | "readAt">[]): number {
  return qs.filter((q) => q.status !== "pending" && !q.readAt).length;
}
