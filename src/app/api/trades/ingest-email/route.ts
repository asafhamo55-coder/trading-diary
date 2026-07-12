import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { computeAllTradeFields, calculateCommission } from "@/lib/calculations/trade";
import { parseBrokerSubject, type FillAction } from "@/lib/broker-email";

// POST /api/trades/ingest-email
//
// Logs a single broker fill (from a Gmail-confirmation email) into the trading
// journal. Called by the Gmail add-on, so it authenticates with a shared bearer
// token (INGEST_TOKEN) instead of the app password cookie — this path is listed
// in PUBLIC_PATHS in src/proxy.ts so the cookie gate lets it through.
//
// Body: { subject?, action?, symbol?, qty?, price?, dateISO?, messageId? }
//   - The add-on card is editable, so explicit action/symbol/qty/price override
//     whatever the subject parses to. If those are absent, `subject` is parsed.
//   - messageId (the Gmail message id) is stored on the leg as externalKey, so
//     clicking the button twice is a safe no-op.
//
// Lifecycle: every fill lands on the one open (isCompleted:false) trade for its
// symbol, or opens a new LONG / Momentum trade if none is open. The calc engine
// (isTradeCompleted) closes the trade automatically once buys == sells.

const NEW_TRADE_DIRECTION = "LONG" as const;
const NEW_TRADE_TYPE = "Momentum";

type ResolvedFill = {
  action: FillAction;
  symbol: string;
  qty: number;
  price: number;
};

function resolveFill(body: Record<string, unknown>):
  | { ok: true; fill: ResolvedFill }
  | { ok: false; reason: string } {
  const action = body.action;
  const symbol = body.symbol;
  const qty = body.qty;
  const price = body.price;

  // Explicit (edited-in-card) values take precedence when all present.
  if (action && symbol && qty != null && price != null) {
    const a = String(action).toUpperCase();
    if (a !== "BUY" && a !== "SELL") return { ok: false, reason: `Invalid action: ${action}` };
    const q = Number(qty);
    const p = Number(price);
    if (!(q > 0)) return { ok: false, reason: `Invalid quantity: ${qty}` };
    if (!(p > 0)) return { ok: false, reason: `Invalid price: ${price}` };
    return { ok: true, fill: { action: a as FillAction, symbol: String(symbol).toUpperCase(), qty: q, price: p } };
  }

  // Otherwise parse the raw subject.
  const parsed = parseBrokerSubject(String(body.subject ?? ""));
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const { action: pa, symbol: ps, qty: pq, price: pp } = parsed.fill;
  return { ok: true, fill: { action: pa, symbol: ps, qty: pq, price: pp } };
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: shared bearer token ──────────────────────────────────
    const token = process.env.INGEST_TOKEN;
    if (!token) return errorResponse("INGEST_TOKEN not configured", 500);
    const auth = req.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (provided !== token) return errorResponse("Unauthorized", 401);

    const body = (await req.json()) as Record<string, unknown>;

    const resolved = resolveFill(body);
    if (!resolved.ok) return errorResponse(resolved.reason, 422);
    const fill = resolved.fill;

    const account = await getAccount();

    const messageId = body.messageId ? String(body.messageId) : null;
    const when = body.dateISO ? new Date(String(body.dateISO)) : new Date();
    if (isNaN(when.getTime())) return errorResponse("Invalid dateISO", 422);
    const month = when.getMonth() + 1;

    // ── Idempotency: same Gmail message already logged? ────────────
    if (messageId) {
      const existingLeg = await prisma.tradeLeg.findFirst({
        where: { externalKey: messageId, trade: { accountId: account.id } },
        include: { trade: true },
      });
      if (existingLeg) {
        return jsonResponse({
          ok: true,
          duplicate: true,
          tradeId: existingLeg.tradeId,
          deepLink: `/trade/trades/${existingLeg.tradeId}`,
          message: `Already logged — ${fill.symbol} ${fill.action.toLowerCase()}`,
        });
      }
    }

    const commission = calculateCommission(fill.price, fill.qty, account.commissionPerShare);
    const legType = fill.action; // "BUY" | "SELL" — same as LegType enum

    // Per-symbol leverage for the calc engine.
    const assetLev = await prisma.assetLeverage.findFirst({
      where: { accountId: account.id, symbol: { equals: fill.symbol, mode: "insensitive" } },
    });
    const leverage = assetLev?.leverage ?? 1;

    // Monthly risk unit (for riskReward).
    const review = await prisma.monthlyReview.findUnique({
      where: {
        accountId_month_year: { accountId: account.id, month, year: account.calendarYear },
      },
    });
    const riskUnit = review?.riskUnit ?? 0;

    // ── Find the open trade for this symbol, or open a new one ─────
    const openTrade = await prisma.trade.findFirst({
      where: { accountId: account.id, symbol: fill.symbol, isCompleted: false },
      include: { entries: { orderBy: { legOrder: "asc" } } },
      orderBy: { tradeDate: "desc" },
    });

    let tradeId: string;
    let created: boolean;
    let closed: boolean;

    if (openTrade) {
      // Append a leg to the existing open trade.
      const nextLegOrder = openTrade.entries.reduce((m, e) => Math.max(m, e.legOrder), 0) + 1;
      await prisma.tradeLeg.create({
        data: {
          tradeId: openTrade.id,
          legType,
          price: fill.price,
          quantity: fill.qty,
          commission,
          legOrder: nextLegOrder,
          externalKey: messageId,
        },
      });

      const legs = [
        ...openTrade.entries,
        { legType, price: fill.price, quantity: fill.qty, commission, legOrder: nextLegOrder },
      ].map((e) => ({
        legType: e.legType as "BUY" | "SELL",
        price: e.price,
        quantity: e.quantity,
        commission: e.commission,
        legOrder: e.legOrder,
      }));

      const computed = computeAllTradeFields(
        {
          direction: openTrade.direction as "LONG" | "SHORT",
          symbol: openTrade.symbol,
          entries: legs,
          leverage,
          dailyHigh: openTrade.dailyHigh,
          dailyClose: openTrade.dailyClose,
        },
        riskUnit
      );

      await prisma.trade.update({ where: { id: openTrade.id }, data: computed });
      tradeId = openTrade.id;
      created = false;
      closed = computed.isCompleted;
    } else {
      // Open a new trade — always LONG / Momentum per the workflow.
      const legs = [
        { legType: legType as "BUY" | "SELL", price: fill.price, quantity: fill.qty, commission, legOrder: 1 },
      ];
      const computed = computeAllTradeFields(
        { direction: NEW_TRADE_DIRECTION, symbol: fill.symbol, entries: legs, leverage, dailyHigh: null, dailyClose: null },
        riskUnit
      );

      const trade = await prisma.trade.create({
        data: {
          accountId: account.id,
          tradeDate: when,
          month,
          symbol: fill.symbol,
          direction: NEW_TRADE_DIRECTION,
          tradeType: NEW_TRADE_TYPE,
          ...computed,
          entries: {
            create: [
              { legType, price: fill.price, quantity: fill.qty, commission, legOrder: 1, externalKey: messageId },
            ],
          },
        },
      });
      tradeId = trade.id;
      created = true;
      closed = computed.isCompleted;
    }

    return jsonResponse(
      {
        ok: true,
        created,
        closed,
        tradeId,
        deepLink: `/trade/trades/${tradeId}`,
        message: `${created ? "Opened" : "Added to"} ${fill.symbol} — ${fill.action.toLowerCase()} ${fill.qty} @ ${fill.price}${closed ? " (trade closed)" : ""}`,
      },
      created ? 201 : 200
    );
  } catch (error) {
    console.error("Ingest email error:", error);
    return errorResponse(
      `Ingest failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
