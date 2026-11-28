---
name: import-tax-return
description: Turn filed tax return PDFs (US federal Form 1040 with schedules, the Georgia Form 500, FBAR/8938 pages — a CPA's full client copy) into validated tax-return records and load them into Hamo Home Equity, which also backfills that year's property books from Schedule E and feeds the advisor. Use when the user asks to "import my tax return", "load the 2025 return", "read these tax forms", or drops a tax return PDF in the project.
---

# Import a tax return (PDF → JSON → /api/savings/tax-returns)

You are the extractor. The app never reads PDFs and never calls a paid LLM: you
read the return here, write one JSON record per year × jurisdiction, validate it
with the repo's schema, and post it. Read `extraction-guide.md` before
extracting. `example.json` is a synthetic, schema-valid record — copy the shape,
never the numbers.

## 0. Ground rules — no PII, ever

- **Nothing that identifies a person or an account leaves this machine**: no
  SSN/ITIN, EIN, preparer PTIN, dates of birth, e-file PINs or signatures, bank
  account or routing numbers (skip the direct-deposit page entirely), foreign
  account numbers, and no dependents' names. People are household member keys
  only (get them from the app, below). The validator and the server reject
  identifier patterns; don't rely on that — never write them in the first place.
- **Never print identifiers to the terminal.** When you inspect text, mask first
  (`sed -E 's/[0-9]{3}[- ][0-9]{2}[- ][0-9]{4}/[SSN]/g; s/[0-9]{2}-[0-9]{7}/[EIN]/g; s/[0-9]{7,}/[ID]/g; s/(PIN\)? +)[0-9]{4,6}/\1[PIN]/g'`) — returns print SSNs with spaces as well as dashes, and the 1040 shows the designee PIN and
  read only the lines you need.
- **Never commit** PDFs, extracted text or records. Work only under the
  gitignored `private-data/tax/`.
- **Never invent numbers.** A line not printed is `null`; anything you couldn't
  place goes in `notes` (no identifiers in notes either).

## 1. Inputs

- The PDF path(s) the user gave.
- `SAVINGS_INGEST_TOKEN` from the environment, or `private-data/.savings-token`.
  Never print it.
- `HAMO_BASE_URL`, default `https://trading-diary-lilac.vercel.app`.
- Member keys and property ids (read-only):
  ```bash
  curl -sS -H "Authorization: Bearer $TOKEN" "$HAMO_BASE_URL/api/savings/advisor/context" \
    | jq '{members: [.snapshot.household.members[] | {key, role}], rentals: [.snapshot.realEstate.rentals[] | {id, address, unit}]}'
  ```

## 2. Extract

1. `mkdir -p private-data/tax && pdftotext -layout "<pdf>" private-data/tax/<year>.txt`
2. Map forms to pages by their headers (masked), e.g. with a small script that
   prints page number + first two lines per page. Identify the layout
   (guide §1).
3. Fill one record per jurisdiction, following the guide's form → field map:
   `private-data/tax/<year>-US-federal.json` and `private-data/tax/<year>-US-GA.json`.
   - Rentals: one entry per Schedule E property column. Set `propertyId` (or
     `unitIds` for a multi-unit building filed as one column) from the app's
     rentals; leave both null for a property the app doesn't have (it's listed,
     not created).
   - Foreign accounts: institution, type, owner key and max value only.
4. If the return has a two-year comparison and the prior year isn't loaded as a
   full return, write `private-data/tax/<prior>-US-federal.json` with only
   `summary` and `"partial": true`.

## 3. Validate, then load

```bash
npx tsx scripts/validate-tax-return.ts private-data/tax/<year>-US-federal.json   # → OK …
curl -sS --fail-with-body -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary @private-data/tax/<year>-US-federal.json "$HAMO_BASE_URL/api/savings/tax-returns" \
  | jq '{replaced, skipped, backfill}'
```

A full federal return rewrites that year's Schedule E rows in the property books
(only rows it created before — statement imports and manual entries are never
touched) and fills empty tax-basis fields. A 422 lists the offending fields; fix
and re-post. Re-posting a year replaces it; a partial never replaces a full one.

## 4. Report back

Per year: AGI, total tax, refund/owed, rentals loaded (and any `unmatched`
addresses), backfilled transaction count, basis fields filled, and anything left
in `notes`. Suggest running the advisor so it picks the returns up.
