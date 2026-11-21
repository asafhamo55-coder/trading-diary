import { prisma } from "./db";
import { getAccount } from "./api-helpers";
import { ensureAssistantSchema } from "./assistant-schema";
import {
  normalizeContextKeys,
  type AnswerInput,
  type AssistantQuestionDTO,
  type CreateQuestionInput,
} from "./assistant";
import { buildPendingBundle, planBundle, type PendingBundle } from "./assistant-bundle";
import { buildAdvisorContextSnapshot } from "./advisor-context";
import { EXPLAIN, isExplainKey } from "./explain";
import { getProperties } from "./property-data";
import { getSavingsAccount } from "./savings-data";
import { getGuidelineStatus } from "./guidelines-data";
import { summarizeGuidelines } from "./guidelines";

// Persistence for the in-app "Ask" assistant (AssistantQuestion) plus the
// server half of the pending bundle. See src/lib/assistant.ts and docs/assistant.md.

let schemaReady: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureAssistantSchema().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/** Run a Prisma op; if it fails (table missing on a fresh deploy), heal and retry once. */
async function withHeal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    schemaReady = null;
    await ensureReady();
    return await run();
  }
}

type Row = Awaited<ReturnType<typeof prisma.assistantQuestion.findFirstOrThrow>>;

function serialize(r: Row): AssistantQuestionDTO {
  return {
    id: r.id,
    question: r.question,
    language: r.language === "he" ? "he" : "en",
    pagePath: r.pagePath,
    pageTitle: r.pageTitle,
    contextKeys: normalizeContextKeys(r.contextKeys),
    status: r.status === "answered" || r.status === "failed" ? r.status : "pending",
    answer: r.answer,
    answeredAt: r.answeredAt?.toISOString() ?? null,
    answeredBy: r.answeredBy,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
  };
}

async function accountId(): Promise<string> {
  return (await getAccount()).id;
}

export async function createQuestion(input: CreateQuestionInput): Promise<AssistantQuestionDTO> {
  return withHeal(async () => {
    const row = await prisma.assistantQuestion.create({
      data: {
        accountId: await accountId(),
        question: input.question,
        language: input.language,
        pagePath: input.pagePath,
        pageTitle: input.pageTitle,
        contextKeys: input.contextKeys,
      },
    });
    return serialize(row);
  });
}

export async function listQuestions(limit = 50): Promise<AssistantQuestionDTO[]> {
  return withHeal(async () => {
    const rows = await prisma.assistantQuestion.findMany({
      where: { accountId: await accountId() },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(serialize);
  });
}

/** Marks the question read (idempotent). null when it isn't this account's. */
export async function markQuestionRead(id: string): Promise<AssistantQuestionDTO | null> {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.assistantQuestion.findFirst({ where: { id, accountId: acct } });
    if (!row) return null;
    if (row.readAt) return serialize(row);
    return serialize(await prisma.assistantQuestion.update({ where: { id }, data: { readAt: new Date() } }));
  });
}

export async function deleteQuestion(id: string): Promise<boolean> {
  return withHeal(async () => {
    const res = await prisma.assistantQuestion.deleteMany({ where: { id, accountId: await accountId() } });
    return res.count > 0;
  });
}

export async function listPendingQuestions(limit = 20): Promise<AssistantQuestionDTO[]> {
  return withHeal(async () => {
    const rows = await prisma.assistantQuestion.findMany({
      where: { accountId: await accountId(), status: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map(serialize);
  });
}

/** Saves an answer (or a failure reason). null when the id doesn't exist. */
export async function saveAnswer(input: AnswerInput): Promise<AssistantQuestionDTO | null> {
  return withHeal(async () => {
    const acct = await accountId();
    const row = await prisma.assistantQuestion.findFirst({ where: { id: input.id, accountId: acct } });
    if (!row) return null;
    const updated = await prisma.assistantQuestion.update({
      where: { id: input.id },
      // A re-answer (e.g. after a failure) shows up as unread again.
      data: { status: input.status, answer: input.answer, answeredBy: input.answeredBy, answeredAt: new Date(), readAt: null },
    });
    return serialize(updated);
  });
}

/**
 * Pending questions + the data bundle the answerer needs. Each data source is
 * loaded independently and degrades to null/empty, so one broken module never
 * blocks answering a question about another.
 */
export async function getPendingBundle(): Promise<PendingBundle> {
  const questions = await listPendingQuestions();
  if (questions.length === 0) return buildPendingBundle([], null);
  const plan = planBundle(questions);

  const allProperties = await getProperties().catch(() => []);
  const [advisorSnapshot, savingsRows, guidelines] = await Promise.all([
    buildAdvisorContextSnapshot({ properties: allProperties }).catch((e) => {
      console.error("Assistant bundle: advisor snapshot failed:", e);
      return null;
    }),
    Promise.all(plan.savingsIds.map((id) => getSavingsAccount(id).catch(() => null))),
    plan.guidelines
      ? getGuidelineStatus()
          .then((s) => ({
            summary: summarizeGuidelines(s.result),
            result: s.result,
            cash: s.cash,
            config: s.config,
            freshness: s.freshness,
            generatedAt: s.generatedAt,
          }))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const glossary: Record<string, unknown> = {};
  for (const k of plan.explainKeys) if (isExplainKey(k)) glossary[k] = EXPLAIN[k];

  const properties: Record<string, Record<string, unknown>> = {};
  for (const id of plan.propertyIds) {
    const p = allProperties.find((x) => x.id === id);
    if (p) properties[id] = p as unknown as Record<string, unknown>;
  }
  const savingsAccounts: Record<string, Record<string, unknown>> = {};
  plan.savingsIds.forEach((id, i) => {
    const a = savingsRows[i];
    if (a) savingsAccounts[id] = a as unknown as Record<string, unknown>;
  });

  return buildPendingBundle(questions, { advisorSnapshot, glossary, properties, savingsAccounts, guidelines });
}
