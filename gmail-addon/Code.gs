/**
 * Trading Diary Logger — Gmail add-on.
 *
 * Opens a card when you view a broker fill-confirmation email (subject like
 * "BOUGHT 100 NOW @ 110.7944 (UXXX97634)") with editable Symbol/Side/Qty/Price
 * and a button that POSTs the fill to the Trading Diary ingest endpoint.
 *
 * Fill in the three CONFIG values below before deploying (see README.md).
 */

// ── CONFIG ─────────────────────────────────────────────────────────
var APP_URL = 'https://trading-diary-asafhamo55-6286s-projects.vercel.app';
var INGEST_TOKEN = 'PASTE_INGEST_TOKEN_HERE';           // shared secret; matches Vercel env INGEST_TOKEN
var VERCEL_BYPASS_TOKEN = 'PASTE_VERCEL_BYPASS_TOKEN_HERE'; // Vercel → Settings → Deployment Protection → Protection Bypass for Automation
// ───────────────────────────────────────────────────────────────────

/** Contextual trigger — fires when a Gmail message is opened. */
function onGmailMessage(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  var message = GmailApp.getMessageById(e.gmail.messageId);
  var subject = message.getSubject();
  var dateISO = message.getDate().toISOString();

  var fill = parseSubject(subject);
  if (!fill) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Trading Diary'))
      .addSection(
        CardService.newCardSection().addWidget(
          CardService.newTextParagraph().setText(
            "This email doesn't look like a share fill.\n\nExpected a subject like:\n<b>BOUGHT 100 NOW @ 110.7944</b>")))
      .build();
  }

  var section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextInput().setFieldName('symbol').setTitle('Symbol').setValue(fill.symbol));
  section.addWidget(
    CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('action')
      .setTitle('Side')
      .addItem('Buy', 'BUY', fill.action === 'BUY')
      .addItem('Sell', 'SELL', fill.action === 'SELL'));
  section.addWidget(
    CardService.newTextInput().setFieldName('qty').setTitle('Quantity').setValue(String(fill.qty)));
  section.addWidget(
    CardService.newTextInput().setFieldName('price').setTitle('Price').setValue(String(fill.price)));

  var action = CardService.newAction()
    .setFunctionName('logTrade')
    .setParameters({ dateISO: dateISO, messageId: e.gmail.messageId });

  section.addWidget(
    CardService.newTextButton()
      .setText('Log to Trading Diary')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(action));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Log this fill'))
    .addSection(section)
    .build();
}

/** Mirror of src/lib/broker-email.ts — plain shares only. */
function parseSubject(subject) {
  if (!subject) return null;
  var re = /^\s*(BOUGHT|SOLD)\s+([\d,]+(?:\.\d+)?)\s+([A-Za-z][A-Za-z.\-]*)\s+@\s+\$?([\d,]+(?:\.\d+)?)\s*(?:\(([^)]+)\))?\s*$/i;
  var m = re.exec(subject);
  if (!m) return null;
  return {
    action: m[1].toUpperCase() === 'BOUGHT' ? 'BUY' : 'SELL',
    symbol: m[3].toUpperCase(),
    qty: parseFloat(m[2].replace(/,/g, '')),
    price: parseFloat(m[4].replace(/,/g, ''))
  };
}

/** Button handler — POST the (possibly edited) fill to the ingest endpoint. */
function logTrade(e) {
  var inputs = e.commonEventObject.formInputs || {};
  function val(name) {
    var f = inputs[name];
    return f && f.stringInputs && f.stringInputs.value ? f.stringInputs.value[0] : '';
  }

  var payload = {
    symbol: val('symbol'),
    action: val('action'),
    qty: Number(val('qty')),
    price: Number(val('price')),
    dateISO: e.parameters.dateISO,
    messageId: e.parameters.messageId
  };

  var resp = UrlFetchApp.fetch(APP_URL + '/api/trades/ingest-email', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + INGEST_TOKEN,
      'x-vercel-protection-bypass': VERCEL_BYPASS_TOKEN,
      'x-vercel-set-bypass-cookie': 'true'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var data;
  try { data = JSON.parse(resp.getContentText()); } catch (err) { data = { error: resp.getContentText() }; }

  var ok = code >= 200 && code < 300 && data && data.ok;
  var text = ok ? (data.duplicate ? 'Already logged ✓' : data.message) : ('Error: ' + ((data && data.error) || ('HTTP ' + code)));

  var builder = CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text));
  if (ok && data.deepLink) {
    builder.setOpenLink(CardService.newOpenLink().setUrl(APP_URL + data.deepLink));
  }
  return builder.build();
}
