---
name: run-advisor
description: Generate the household financial advisor report for Hamo Home Equity and save it into the app. Use when the user asks to "run the advisor", "update my recommendations", "refresh the financial analysis", or when the daily advisor routine fires.
---

# Run the household advisor

The app does not call any paid LLM. This skill runs inside Claude Code on the user's
Claude subscription. It reads the household snapshot from the app, reasons over it with
the researched knowledge base, and posts a structured report back. The dashboard then
shows it in the "Advisor" panel.

## Inputs

- `HAMO_BASE_URL`: defaults to `https://trading-diary-lilac.vercel.app`.
- `SAVINGS_INGEST_TOKEN`: a bearer token, matching the Vercel env var of the same name.
  Read it from the environment, or from the gitignored `private-data/.savings-token`
  when running locally. Never print it, and never write it into any committed file.

## Steps

1. **Fetch the context.**
   ```bash
   curl -sf -H "Authorization: Bearer $SAVINGS_INGEST_TOKEN" "$HAMO_BASE_URL/api/savings/advisor/context" > /tmp/advisor-context.json
   ```
   It returns `{ inputHash, unchangedSinceLastReport, latestReportAt, system, outputSchema, snapshot }`.
   - If `unchangedSinceLastReport` is true and the latest report is under 7 days old,
     stop and say nothing changed. A scheduled run should still re-run weekly, because
     laws and rates change.
2. **Read the knowledge base** in `docs/advisor/knowledge/`: `israel.md` and
   `us-and-cross-border.md`. Treat the figures in them as of their "Last verified" date.
   If a figure that drives a recommendation is more than about 6 months old, or the year
   has rolled over (contribution limits, tax brackets), check it with a quick web search
   and say so in the rationale.
3. **Reason as the advisor.** Follow the `system` brief from the context exactly: ground
   every number in the snapshot, never invent figures, list what can't be concluded
   under `questionsForUser`, and put the highest-impact actions first. Then combine:
   - the household facts from the snapshot (ages, goals, accounts, fees, coverage
     duplicates and gaps, data gaps);
   - the law and instrument rules from the knowledge base;
   - Israel–US cross-border interactions: PFIC, FBAR/8938, the treaty, and
     relocation scenarios.

   Each recommendation must include a concrete action (who to call or what to file),
   `estimatedImpactUsdPerYear` when it can be estimated, `owner`, `priority`, and
   `confidence`.
4. **Write the output** as JSON that matches `outputSchema` exactly, to
   `/tmp/advisor-output.json`. Validate it: it must parse and include `headline` and a
   `recommendations` array.
5. **Post it.**
   ```bash
   jq -n --slurpfile o /tmp/advisor-output.json --arg h "$(jq -r .inputHash /tmp/advisor-context.json)" \
     '{output: $o[0], inputHash: $h, model: "claude-code"}' \
   | curl -sf -X POST -H "Authorization: Bearer $SAVINGS_INGEST_TOKEN" -H "Content-Type: application/json" \
       --data-binary @- "$HAMO_BASE_URL/api/savings/advisor/ingest"
   ```
6. **Report back** in a short summary: the headline, the top 3 actions, and any
   questions for the user.

## Notes

- This is educational analysis, not licensed advice. Keep the disclaimers in the output.
- Do not include national ID or SSN numbers in the output.
