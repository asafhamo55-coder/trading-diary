---
name: answer-questions
description: Answer the questions the user asked in the Hamo Home Equity app's "Ask" assistant and post the answers back into the app. Use when the user says "answer my app questions", "answer the assistant questions", "check my Ask questions", or when the hourly answer-questions routine fires.
---

# Answer the in-app assistant questions

The app does not call any paid LLM. When the user taps **שאל / Ask** on a page, the question is
saved as `pending` together with the page it was asked on and the on-screen context. This skill
runs inside Claude Code on the user's Claude subscription: it fetches the pending questions and a
data bundle, answers each one, and posts the answers back. The app shows them in the Ask panel
with a badge on the button.

This skill does not change the repo: no edits, commits or pushes. It only reads the source and
calls two API routes.

## Inputs

- `HAMO_BASE_URL`: defaults to `https://trading-diary-lilac.vercel.app`.
- `SAVINGS_INGEST_TOKEN`: a bearer token matching the Vercel env var of the same name. Read it from
  the environment, or from the gitignored `private-data/.savings-token` when running locally.
  **Never print it**, echo it, or write it into any file.

```bash
BASE="${HAMO_BASE_URL:-https://trading-diary-lilac.vercel.app}"
TOKEN="${SAVINGS_INGEST_TOKEN:-$(cat private-data/.savings-token 2>/dev/null)}"
```

## Steps

1. **Fetch the pending questions.**
   ```bash
   curl -sf -H "Authorization: Bearer $TOKEN" "$BASE/api/assistant/pending" > /tmp/assistant-pending.json
   jq '.count' /tmp/assistant-pending.json
   ```
   - **If `count` is 0, stop at once and say nothing more than "No pending questions."** Don't
     read the codebase or the knowledge base. A scheduled run with nothing to do should end here.
   - If the request fails (401, 500, network), stop and report the HTTP status. Don't retry in a
     loop.

   The response is:
   ```
   { generatedAt, count,
     questions: [{ id, question, language: "he"|"en", pagePath, pageTitle, contextKeys, createdAt,
                   refs: { explain[], properties[], savingsAccounts[], guidelines, missing[] } }],
     data: { advisorSnapshot, glossary, properties, savingsAccounts, guidelines } }
   ```
   - `data.advisorSnapshot`: the same household snapshot the advisor uses (net worth with totals by
     module/owner/country/type, FX rate, savings accounts, properties + real-estate review, trade
     equity, cash flow, retirement, children, coverage gaps/duplicates, history, data gaps,
     assumptions, `tradingGuidelines`). It may be `null` if building it failed.
   - `data.glossary[key]`: the in-app explanation (Hebrew, sometimes English) of each on-screen
     metric the question's page showed (`refs.explain`).
   - `data.properties[id]` / `data.savingsAccounts[id]`: the full record of the property or savings
     account the question was asked about (`refs.properties`, `refs.savingsAccounts`).
   - `data.guidelines`: the trading-account guidelines status (summary, buckets, drift, actions, dip
     signals, cash, freshness) when the question came from `/trade/guidelines`.
   - `refs.missing`: context the page pointed at but the server couldn't find. Mention it only if it
     matters for the answer.

2. **Understand each question.** Use `pagePath` and `pageTitle` to know which screen the user was
   looking at, and `contextKeys` / `refs` for what was on it. Pull the relevant numbers from `data`.

3. **Explain how the app calculates things by reading the actual source**, not from memory. Read
   only what the question needs:
   - `src/lib/explain.ts`: the glossary behind every ⓘ tooltip. Start here for "what is X / how is
     X calculated"; its entries name the code they mirror.
   - `src/lib/savings.ts`: net worth, fees and fee drag, liquidity, retirement projection, coverage.
   - `src/lib/property.ts` (plus `property-portfolio.ts`, `property-attention.ts`): rental yield,
     cash-on-cash, equity, appreciation, occupancy, sale scenarios.
   - `src/lib/guidelines.ts`: SPY/QQQ/large-cap/cash buckets, drift bands, actions, dip signals.
   - `src/lib/fx.ts` / `src/lib/fx-server.ts`: the USD/ILS rate and its sources.
   - `src/lib/advisor.ts` / `src/lib/advisor-report.ts`: what the advisor looks at and how it ranks.
   - `docs/advisor/knowledge/israel.md` and `docs/advisor/knowledge/us-and-cross-border.md` for law,
     tax and finance concepts (קרן השתלמות, pension, ניוד, PFIC, FBAR, the treaty, 401(k), Roth…).
     Treat their figures as of their "Last verified" date; if a figure that drives the answer is
     stale (over about 6 months, or the year rolled over), check it with a quick web search and say
     so.
   - When running locally, `private-data/advisor/*.md` may add household notes. Never quote them
     into anything public.

4. **Write the answer** in the question's `language` (`he` → natural Israeli Hebrew; `en` →
   English). Markdown, rendered by a small safe renderer that supports `##`/`###` headings,
   paragraphs, `-` and `1.` lists, `**bold**`, `*italic*`, `` `code` ``, simple `| tables |` and
   `[links](https://…)`. No raw HTML (it is shown as text).
   - **Lead with the direct answer** in one or two sentences, then the user's own numbers from
     `data`, then (if asked "how") the formula in words and one worked line with their numbers.
   - **Concise**: usually 80–200 words. A short table is fine for comparing a few items.
   - **Format numbers**: thousands separators, currency symbols (`$12,400`, `₪45,000`), percentages
     to 1–2 decimals, dates as they appear in the app. Say which currency and as-of date a figure is.
   - **Next steps** when relevant: one to three concrete actions (which screen to open, what to
     update, who to call). Skip them for a pure definition.
   - Hebrew answers: keep tickers, US forms and English product names in Latin script (SPY, 401(k),
     Form 8938); Israeli products in Hebrew (קרן השתלמות, ביטוח מנהלים).
   - **Never invent data.** If the bundle doesn't have the figure, say what's missing and where in
     the app to add it. Don't guess balances, rates, phone numbers or URLs.
   - **Never include national ID (תעודת זהות) or SSN numbers**, full policy/account numbers, tenant
     contact details or the token.
   - This is educational, not licensed advice. For tax/legal questions add one short line saying so.

5. **Post each answer** as soon as it is written (so a later failure doesn't lose earlier ones):
   ```bash
   jq -n --arg id "$ID" --rawfile a /tmp/assistant-answer.md \
     '{id: $id, answer: $a, status: "answered", answeredBy: "claude-code"}' \
   | curl -sS --fail-with-body -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
       --data-binary @- "$BASE/api/assistant/answer"
   ```
   - 422 means the body was invalid (empty answer, over 20,000 characters, bad status). Fix and
     re-post.
   - **If a question can't be answered** (it's unintelligible, needs data the app doesn't have and
     can't be explained in general terms, or something errored), post it with `status: "failed"` and
     a one- or two-sentence reason in the question's language as `answer`, e.g. "לא מצאתי נתוני
     שכירות לנכס הזה. הוסיפו חוזה שכירות בעמוד הנכס ושאלו שוב." The user can ask again.
   - Prefer a partial, honest answer over `failed` when the concept can be explained but the user's
     specific number is missing.

6. **Report back** in a short summary: how many questions were answered or failed, and one line per
   question (its first words, not the answer). Don't print the token or the full bundle.

## Notes

- Questions are answered oldest first; the endpoint returns up to 20 per run. If `count` is 20,
  there may be more: run step 1 again after posting.
- Answers are stored in the app's database and shown only behind the app password.
- See `docs/assistant.md` for the full flow.
