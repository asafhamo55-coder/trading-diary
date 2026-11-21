# In-app assistant ("שאל / Ask")

Ask a question about anything in the app, such as a number, a term or a recommendation, from any
page. Claude Code answers it on your Claude subscription. The app never calls a paid LLM API, the
same as the [advisor](../.claude/skills/run-advisor/SKILL.md).

## How it works

1. **Ask.** The floating **שאל / Ask** button (bottom-right on every page except `/login`) opens a
   panel. Type a question in Hebrew or English, or tap a suggested starter for the page. The panel
   attaches the page's context automatically:
   - the current path and page title;
   - **context keys**: glossary keys of the metrics on screen (from `data-explain-key` attributes,
     see `src/lib/explain.ts`), and entity references:
     - `property:<id>` on `/properties/<id>`;
     - `guidelines` on `/trade/guidelines`;
     - any `data-assistant-context="savings:<id> property:<id>"` attribute on the page.

   The question is saved as **pending**. Its language is detected from the text: if the first letter
   is Hebrew, the answer is in Hebrew.
2. **Answer.** A Claude Code routine runs the
   [`answer-questions`](../.claude/skills/answer-questions/SKILL.md) skill. It calls
   `GET /api/assistant/pending`, which returns the pending questions plus a data bundle:
   - the advisor's household snapshot;
   - the glossary entries for the on-screen metrics;
   - the referenced property or savings-account records;
   - the trading-guidelines status.

   The skill reads the app's own calculation code (`src/lib/savings.ts`, `property.ts`,
   `guidelines.ts`, `fx.ts`, `advisor.ts`, `explain.ts`) and the knowledge base in
   `docs/advisor/knowledge/`. It writes a short markdown answer in the question's language and posts
   it to `POST /api/assistant/answer`. If it can't answer, it marks the question **failed** with a
   reason.
3. **Read.** The button shows a badge with the number of unread answers. The panel refreshes on
   every page load and every 60 seconds while it is open. Opening the panel marks the answers read.
   Answers render as safe markdown, never as raw HTML, right-to-left for Hebrew.

## Response time

The routine runs **at most hourly**, so an answer usually arrives within about an hour. A pending
question says so, with the time it was asked. Nothing runs while there are no pending questions: the
skill stops right after the first request.

### Run it now from the terminal

In this repo, ask Claude Code:

> answer my app questions

This runs the same skill locally. It reads the token from `SAVINGS_INGEST_TOKEN` or the gitignored
`private-data/.savings-token`.

## Setting up the routine

Create a Claude Code cloud routine (`/schedule`) on this repo that runs hourly with the prompt
"answer my app questions" (the `answer-questions` skill). Give it these environment variables:

- `SAVINGS_INGEST_TOKEN`: the same value as the Vercel env var;
- optionally `HAMO_BASE_URL`, which defaults to `https://trading-diary-lilac.vercel.app`.

## API

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /api/assistant/questions` | app-password cookie | latest 50 questions, newest first |
| `POST /api/assistant/questions` | cookie | `{ question, pagePath, pageTitle?, contextKeys? }` → creates a pending question |
| `PATCH /api/assistant/questions/[id]` | cookie | `{ read: true }` → marks an answer read |
| `DELETE /api/assistant/questions/[id]` | cookie | deletes a question |
| `GET /api/assistant/pending` | bearer `SAVINGS_INGEST_TOKEN` | up to 20 pending questions (oldest first) plus the data bundle |
| `POST /api/assistant/answer` | bearer `SAVINGS_INGEST_TOKEN` | `{ id, answer, status: "answered" \| "failed", answeredBy? }` |

The two bearer routes are in `PUBLIC_PATHS` in `src/proxy.ts` and check the token themselves
(`src/lib/ingest-auth.ts`).

The table `AssistantQuestion` (`prisma/schema.prisma`) is created on first use by the self-heal DDL
in `src/lib/assistant-schema.ts`, so no manual migration is needed.

## Privacy

- Questions and answers are stored in the app's own Postgres database and are visible only behind
  the app password. You can delete any question from the panel.
- The pending bundle goes only to the token-authenticated routine. Before it is sent, the server
  strips:
  - tenant names, emails and phones;
  - full policy and account numbers;
  - provider login URLs;
  - any field named like a national ID, SSN, passport, email or phone;
  - SSN-shaped and 9-digit ID-shaped number runs in text.

  See `redactSensitive` in `src/lib/assistant-bundle.ts`.
- The skill must not include national ID numbers, full policy numbers or contact details in an
  answer, and must not invent data.
- No personal data lives in the code, tests or docs: the repo is public.

## Code map

- `src/lib/assistant.ts`: language detection, context keys, starters, input validation (pure,
  shared with the browser).
- `src/lib/assistant-bundle.ts`: the pure pending-bundle planner and builder, and redaction.
- `src/lib/assistant-markdown.ts`: the safe markdown subset parser.
- `src/lib/assistant-data.ts`: persistence and the bundle loader.
- `src/lib/advisor-context.ts`: the shared advisor-snapshot builder.
- `src/components/assistant/*`: the button (`AssistantLauncher`, mounted in `src/app/layout.tsx`),
  the panel and the markdown renderer.
- `tests/lib/assistant.test.ts`: the unit tests.
