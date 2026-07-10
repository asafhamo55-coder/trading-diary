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
  // Digital-wallet / processor prefixes (Amex & card feeds).
  s = s.replace(/^AplPay\s+/i, "");
  s = s.replace(/^(TST\*|SQ ?\*|SQU\*|PY ?\*|PAYPAL ?\*|GOOGLE ?\*|AMZN Mktp|SP ?\*)\s*/i, "");
  // Bank of America prefixes.
  s = s.replace(/^CHECKCARD\s+\d{2,4}\s*/i, "");
  s = s.replace(/^(PURCHASE|POS|DEBIT|CREDIT|RECURRING)\s+/i, "");
  // BofA structured suffixes (DES:/ID:/INDN:/CO ID:/Confirmation#).
  s = s.replace(/\bDES:.*$/i, "");
  s = s.replace(/\b(Confirmation#|Conf#|ID:|INDN:).*$/i, "");
  s = s.replace(/;.*$/, "");
  // Trailing US state code left over from fixed-width merchant+city fields.
  s = s.replace(/\s+[A-Z]{2}\s*$/, "");
  s = s.replace(/#?\d{5,}/g, "");
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
  // ── Transfers / card payments → excluded from spend (the de-dupe) ──
  // Amex statement side: "MOBILE PAYMENT - THANK YOU".
  { re: /payment\s*-?\s*thank you|payment received|thank you for your payment/i, category: "Credit Card Payment", transfer: true },
  // BofA → Amex: "AMERICAN EXPRESS DES:ACH PMT ...".
  { re: /american express.{0,25}(ach pmt|pmt|payment|epay)/i, category: "Credit Card Payment", transfer: true },
  // BofA → BofA card: "Mobile Banking payment to CRD 6111".
  { re: /payment to crd\b|payment to card|to crd \d/i, category: "Credit Card Payment", transfer: true },
  // Other card issuers.
  { re: /\b(bankamericard|chase|citi|discover|capital one|barclays|synchrony|wells fargo)\b.{0,25}(card|payment|pmt|epay|autopay)/i, category: "Credit Card Payment", transfer: true },
  { re: /\b(autopay|auto\s*pay|online payment|bill\s*pay|e-?payment)\b.{0,15}(card|amex|visa|mastercard|discover)/i, category: "Credit Card Payment", transfer: true },
  // Internal / external account transfers (own accounts, brokerage).
  { re: /extrnltfr|external transfer|online banking transfer|des:ach transf|\bach transf\b|interactive brok|transfer (to|from) (sav|chk|savings|checking)/i, category: "Account Transfer", transfer: true },
  { re: /\batm\b|cash withdrawal|withdrawal - atm/i, category: "ATM / Cash", transfer: true },

  // ── Income ──
  { re: /des:payroll|\bpayroll\b|des:direct-pay|direct dep|dir dep|\bsalary\b/i, category: "Salary" },
  { re: /\brefund\b|reversal|return credit|statement credit|rideshare credit/i, category: "Refunds" },

  // ── Spending — merchants (tuned to real BofA/Amex descriptions) ──
  { re: /kroger fuel|\bmarathon\b|quiktrip|racetrac|\bchevron\b|\bshell\b|\bexxon\b|\barco\b|\bmobil\b|valero|\bbp\b|\bfuel\b|gas station/i, category: "Gas" },
  { re: /trader joe|whole foods|safeway|\bkroger\b|costco|\baldi\b|wegmans|\bpublix\b|sprouts|ralphs|\bvons\b|supermarket|grocery|\bheb\b|food lion/i, category: "Groceries" },
  { re: /starbucks|dunkin|peet|\bcoffee\b|\bcafe\b|philz|dutch bros/i, category: "Coffee" },
  { re: /doordash|uber ?eats|grubhub|postmates|caviar/i, category: "Delivery" },
  // Toast POS (TST*) is overwhelmingly restaurants; plus common dining keywords.
  { re: /\btst\*|toast|mcdonald|chipotle|\btaco\b|pizza|restaurant|\bgrill\b|kitchen|sushi|\bthai\b|burger|chick-?fil|panera|subway|cool river|marlows|buffalo wild|cheesecake|chili'?s|wingstop|\bbbq\b/i, category: "Dining out" },
  { re: /\buber\b|\blyft\b/i, category: "Rideshare & Taxi" },
  { re: /parking|\btoll\b|fastrak|ipass|peachpass/i, category: "Parking & Tolls" },
  { re: /netflix|spotify|hulu|disney\+?|\bhbo\b|youtube premium|paramount|peacock|apple tv|patreon/i, category: "Streaming" },
  { re: /amazon|\bamzn\b/i, category: "General / Amazon" },
  { re: /comcast|xfinity|at&t|\batt\b|verizon|t-?mobile|spectrum|\binternet\b/i, category: "Internet & Phone" },
  { re: /sawnee|\bemc\b|georgia power|\bpg&e\b|edison|con ed|duke energy|water & sewer|water and sewer|\bsewer\b|\bwater\b|\belectric\b|\butility\b|gas company/i, category: "Utilities" },
  { re: /cvs|walgreens|rite aid|pharmacy|\bcvs\/|goodrx/i, category: "Pharmacy" },
  { re: /planet fitness|equinox|\bgym\b|fitness|peloton|life ?time/i, category: "Fitness" },
  { re: /openai|chatgpt|microsoft|adobe|dropbox|notion|github|google \*|apple\.com|\bicloud\b|anthropic/i, category: "Software" },
  { re: /\bdelta\b|united air|southwest|jetblue|american air|alaska air|\bairline\b|jetset/i, category: "Flights" },
  { re: /airbnb|marriott|hilton|hyatt|\bhotel\b|\bmotel\b|expedia|booking\.com|vrbo/i, category: "Hotels" },
  { re: /geico|state farm|progressive|allstate|\bnationwide\b|\binsurance\b/i, category: "Insurance" },
  { re: /\bmortgage\b|loan pmt|home loan|\brent\b/i, category: "Mortgage / Rent" },
  // Zelle "for <reason>" context — common household services.
  { re: /zelle.*(repair|handyman|contractor|plumb|electr|floor|roof)/i, category: "Repairs & Maintenance" },
  { re: /zelle.*(clean|maid|housekeep|lawn|landscap|garden|pool)/i, category: "Repairs & Maintenance" },
  { re: /zelle.*(tutor|nanny|babysit|school|lesson|coach)/i, category: "Childcare" },
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
