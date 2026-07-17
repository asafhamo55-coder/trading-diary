// Parses broker trade-confirmation email subjects into structured fills.
//
// Example subject:  "BOUGHT 100 NOW @ 110.7944 (UXXX97634)"
//   → { action: "BUY", symbol: "NOW", qty: 100, price: 110.7944, account: "UXXX97634" }
//
// Only plain share fills are supported. Option fills (which carry an
// expiry/strike/right between the symbol and the price, e.g.
// "BOUGHT 1 NOW Jan16'26 110 Call @ 2.35") are intentionally rejected so we
// never mis-log them as shares — the caller surfaces the reason to the user.

export type FillAction = "BUY" | "SELL";

export type ParsedFill = {
  action: FillAction;
  symbol: string;
  qty: number;
  price: number;
  account: string | null;
};

export type ParseResult =
  | { ok: true; fill: ParsedFill }
  | { ok: false; reason: string };

// Optional forward/reply prefixes (possibly stacked, e.g. "Fwd: Re: ...") that
// email clients prepend — we accept them so a forwarded fill parses the same.
const PREFIX = String.raw`(?:(?:Fwd?|Re):\s*)*`;

// prefix  action  qty            symbol           @   price          (account)?
const SUBJECT_RE = new RegExp(
  String.raw`^\s*${PREFIX}(BOUGHT|SOLD)\s+([\d,]+(?:\.\d+)?)\s+([A-Za-z][A-Za-z.\-]*)\s+@\s+\$?([\d,]+(?:\.\d+)?)\s*(?:\(([^)]+)\))?\s*$`,
  "i",
);

// A fill that names the action+qty but has extra tokens before the "@" is
// almost always an option (expiry / strike / Call|Put). Detect it so we can
// give a precise "options not supported" message instead of a generic failure.
const OPTIONISH_RE = new RegExp(
  String.raw`^\s*${PREFIX}(?:BOUGHT|SOLD)\s+[\d,]+(?:\.\d+)?\s+[A-Za-z][A-Za-z.\-]*\s+.+@`,
  "i",
);

function toNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

// The broker account tag in a subject is masked like "UXXX97634"; the account
// number is the trailing digit run ("97634"). Falls back to the trimmed input
// if it holds no digits, or null when empty.
export function brokerAccountNumber(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/(\d+)\s*$/);
  return m ? m[1] : s;
}

export function parseBrokerSubject(subject: string): ParseResult {
  const s = (subject ?? "").trim();
  if (!s) return { ok: false, reason: "Empty subject" };

  const m = SUBJECT_RE.exec(s);
  if (!m) {
    if (OPTIONISH_RE.test(s)) {
      return {
        ok: false,
        reason: "Looks like an option or multi-leg fill — not supported yet",
      };
    }
    return { ok: false, reason: "Not a recognized broker fill subject" };
  }

  const [, verb, qtyRaw, symbolRaw, priceRaw, accountRaw] = m;
  const qty = toNumber(qtyRaw);
  const price = toNumber(priceRaw);

  if (!(qty > 0)) return { ok: false, reason: `Invalid quantity: "${qtyRaw}"` };
  if (!(price > 0)) return { ok: false, reason: `Invalid price: "${priceRaw}"` };

  return {
    ok: true,
    fill: {
      action: verb.toUpperCase() === "BOUGHT" ? "BUY" : "SELL",
      symbol: symbolRaw.toUpperCase(),
      qty,
      price,
      account: accountRaw ? accountRaw.trim() : null,
    },
  };
}
