// CSV statement import for Hamo Home. Parses Bank of America (checking & card)
// and American Express CSV exports into a normalized transaction shape,
// normalizing each source's sign convention so that:
//   negative amount = money out (spend), positive = money in.
import type { HomeAccountType } from "./home";

export interface ParsedRow {
  date: Date;
  amount: number; // normalized: negative = out, positive = in
  description: string;
  raw: string;
}

// ── CSV parsing (RFC-4180-ish: quotes, escaped quotes, embedded commas) ──
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      /* ignore */
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseAmount(s: string | undefined): number | null {
  if (s == null) return null;
  let t = s.trim().replace(/[$\s,]/g, "");
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (t.startsWith("-")) {
    neg = true;
    t = t.slice(1);
  } else if (t.startsWith("+")) t = t.slice(1);
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, +m[1] - 1, +m[2]));
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_HEADERS = ["date", "posted date", "transaction date", "trans date", "post date"];
const DESC_HEADERS = ["description", "payee", "merchant", "details", "original description", "name"];
const AMOUNT_HEADERS = ["amount"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits"];

function idxOf(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.includes(h));
}

/**
 * Extract normalized rows from a CSV string for a given source type. Locates the
 * header row (skipping any bank preamble) and maps columns by header name.
 */
export function extractRows(csv: string, type: HomeAccountType): ParsedRow[] {
  const grid = parseCsv(csv);
  if (grid.length === 0) return [];

  // Find the header row: one that has a date column and an amount/debit/credit column.
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const cells = grid[i].map((c) => c.trim().toLowerCase());
    const hasDate = idxOf(cells, DATE_HEADERS) !== -1;
    const hasAmt =
      idxOf(cells, AMOUNT_HEADERS) !== -1 ||
      (idxOf(cells, DEBIT_HEADERS) !== -1 && idxOf(cells, CREDIT_HEADERS) !== -1);
    if (hasDate && hasAmt) {
      headerIdx = i;
      headers = cells;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const dateCol = idxOf(headers, DATE_HEADERS);
  const descCol = idxOf(headers, DESC_HEADERS);
  const amtCol = idxOf(headers, AMOUNT_HEADERS);
  const debitCol = idxOf(headers, DEBIT_HEADERS);
  const creditCol = idxOf(headers, CREDIT_HEADERS);

  const out: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const cells = grid[i];
    const date = parseDate(cells[dateCol]);
    if (!date) continue;

    let amount: number | null = null;
    if (amtCol !== -1) amount = parseAmount(cells[amtCol]);
    else {
      const debit = parseAmount(cells[debitCol]);
      const credit = parseAmount(cells[creditCol]);
      if (debit != null && debit !== 0) amount = -Math.abs(debit);
      else if (credit != null && credit !== 0) amount = Math.abs(credit);
    }
    if (amount == null || amount === 0) continue;

    const description = (descCol !== -1 ? cells[descCol] : "").trim() || "(no description)";

    out.push({
      date,
      amount: normalizeSign(amount, type),
      description: cleanDescription(description),
      raw: description,
    });
  }
  return out;
}

/**
 * Normalize each source's sign so negative = money out.
 * - BofA (checking & card): debits/purchases are already negative → keep as-is.
 * - Amex: charges are POSITIVE and payments negative → flip.
 */
function normalizeSign(amount: number, type: HomeAccountType): number {
  return type === "AMEX" ? -amount : amount;
}

/** Tidy a raw statement description into a friendlier merchant label. */
export function cleanDescription(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  // Strip common BofA prefixes/noise.
  s = s.replace(/^CHECKCARD\s+\d{4}\s*/i, "");
  s = s.replace(/^(PURCHASE|POS|DEBIT|CREDIT)\s+/i, "");
  s = s.replace(/\bDES:.*$/i, "");
  s = s.replace(/\bID:.*$/i, "");
  s = s.replace(/\s+\d{2}\/\d{2}\b.*$/, "");
  s = s.replace(/#?\d{5,}/g, "").trim();
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || raw.trim();
}

/** Stable idempotency key for an imported row within an account. */
export function externalKey(homeAccountId: string, r: ParsedRow): string {
  const d = r.date.toISOString().slice(0, 10);
  return `${homeAccountId}|${d}|${r.amount.toFixed(2)}|${r.raw.toLowerCase().slice(0, 60)}`;
}

// ── Classification ──────────────────────────────────────────────────
// Description patterns → seeded category child name. Transfers are excluded
// from spend (this is the card-payment de-duplication).

interface Rule {
  re: RegExp;
  category: string; // must match a seeded category name (parent or child)
  transfer?: boolean;
}

const RULES: Rule[] = [
  // Card payments / internal transfers → excluded from spend
  { re: /payment\s*-?\s*thank you|online payment|mobile payment|auto\s*pay|autopay|e-?payment|epayment|bill\s*pay|payment received|pymt|web pymt/i, category: "Credit Card Payment", transfer: true },
  { re: /\b(amex|american express|bankamericard|bank of america).{0,20}(payment|pymt)/i, category: "Credit Card Payment", transfer: true },
  { re: /transfer|xfer|online banking transfer|to savings|from checking/i, category: "Account Transfer", transfer: true },
  { re: /\batm\b|cash withdrawal/i, category: "ATM / Cash", transfer: true },
  // Income
  { re: /payroll|direct dep|dir dep|salary|\bach credit\b/i, category: "Salary" },
  { re: /refund|reversal/i, category: "Refunds" },
  // Spending
  { re: /trader joe|whole foods|safeway|kroger|costco|aldi|wegmans|publix|grocery|supermarket|ralphs|vons/i, category: "Groceries" },
  { re: /starbucks|dunkin|peet|coffee|cafe|philz/i, category: "Coffee" },
  { re: /doordash|uber eats|ubereats|grubhub|postmates|caviar/i, category: "Delivery" },
  { re: /mcdonald|chipotle|taco|pizza|restaurant|grill|kitchen|sushi|thai|burger|chick-fil|panera|subway/i, category: "Dining out" },
  { re: /shell|chevron|exxon|arco|mobil|76 |valero|bp\b|gas|fuel/i, category: "Gas" },
  { re: /\buber\b|lyft/i, category: "Rideshare & Taxi" },
  { re: /parking|toll|fastrak|ipass/i, category: "Parking & Tolls" },
  { re: /netflix|spotify|hulu|disney\+?|hbo|max\b|youtube premium|paramount|peacock|apple tv/i, category: "Streaming" },
  { re: /amazon|amzn/i, category: "General / Amazon" },
  { re: /comcast|xfinity|at&t|att\b|verizon|t-mobile|tmobile|spectrum|internet/i, category: "Internet & Phone" },
  { re: /pg&e|pge |edison|water|electric|utility|gas company|con ed|duke energy/i, category: "Utilities" },
  { re: /cvs|walgreens|rite aid|pharmacy/i, category: "Pharmacy" },
  { re: /planet fitness|equinox|\bgym\b|fitness|peloton/i, category: "Fitness" },
  { re: /apple\.com\/bill|google \*|microsoft|adobe|dropbox|notion|openai|github/i, category: "Software" },
  { re: /delta|united|american air|southwest|jetblue|alaska air|airline/i, category: "Flights" },
  { re: /airbnb|marriott|hilton|hyatt|hotel|motel|expedia|booking\.com/i, category: "Hotels" },
  { re: /insurance|geico|state farm|progressive|allstate/i, category: "Insurance" },
  { re: /mortgage|loan pmt|home loan/i, category: "Mortgage / Rent" },
];

export interface Classification {
  categoryName: string | null;
  transfer: boolean;
}

export function classify(raw: string): Classification {
  for (const rule of RULES) {
    if (rule.re.test(raw)) {
      return { categoryName: rule.category, transfer: !!rule.transfer };
    }
  }
  return { categoryName: null, transfer: false };
}
