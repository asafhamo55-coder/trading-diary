# Trading Diary — Gmail Add-on

A one-click button inside Gmail that logs a broker fill-confirmation email
(subject like `BOUGHT 100 NOW @ 110.7944 (UXXX97634)`) straight into the trading
journal.

## How it works

1. You open a broker email in Gmail.
2. The add-on parses the subject and shows an **editable** card: Symbol / Side /
   Quantity / Price.
3. You click **Log to Trading Diary**. The card POSTs the fill to
   `POST /api/trades/ingest-email`.
4. The server appends the fill to the open trade for that symbol (or opens a new
   LONG / Momentum trade), and closes the trade automatically once buys == sells.
   Clicking twice is a safe no-op (deduped on the Gmail message id).

## One-time setup

### 1. Enable Vercel Protection Bypass for Automation
The app sits behind Vercel Deployment Protection (SSO), which would block the
add-on's request. Give the add-on a bypass token:

- Vercel → project **trading-diary** → **Settings → Deployment Protection**
- Under **Protection Bypass for Automation**, click **Add Secret** (Vercel
  generates one). Copy it.

### 2. Create the Apps Script project
- Go to <https://script.google.com> → **New project**.
- Replace the default `Code.gs` with the contents of `Code.gs` here.
- Add a file **appsscript.json** (Project Settings → tick *"Show appsscript.json
  manifest file"*, then paste the contents of `appsscript.json` here).

### 3. Fill in the three CONFIG values at the top of `Code.gs`
- `APP_URL` — already set to the production URL.
- `INGEST_TOKEN` — the shared secret (also set as an env var on Vercel; see below).
- `VERCEL_BYPASS_TOKEN` — the secret from step 1.

### 4. Deploy as a Gmail add-on
- Apps Script → **Deploy → Test deployments → Install** (installs it on your own
  account only — no Google verification needed for personal use).
- Open a broker email in Gmail; the **Trading Diary Logger** add-on appears in
  the right-hand sidebar.

## Server side (already deployed)
- `INGEST_TOKEN` must be set as a Vercel env var (Production) — the same value
  you paste into `Code.gs`.
- Endpoint: `src/app/api/trades/ingest-email/route.ts`
- Parser: `src/lib/broker-email.ts`
- Idempotency column: `TradeLeg.externalKey` (run the
  `/api/admin/migrate-leg-externalkey` route once after deploy).
