import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { ensureHomeSchema } from "@/lib/home-schema";
import { seedDefaultCategories } from "@/lib/home-data";
import { extractRows, externalKey, classify } from "@/lib/home-import";

// POST /api/home/import — import a CSV statement into a home account.
// Body: { homeAccountId, csv, filename? }
export async function POST(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();
    const homeAccountId: string = body?.homeAccountId;
    const csv: string = body?.csv;
    const filename: string = (body?.filename || "statement.csv").slice(0, 200);
    if (!homeAccountId || typeof csv !== "string" || !csv.trim()) {
      return errorResponse("Provide an account and CSV contents");
    }

    await ensureHomeSchema();
    await seedDefaultCategories(account.id);

    const homeAccount = await prisma.homeAccount.findFirst({
      where: { id: homeAccountId, accountId: account.id },
    });
    if (!homeAccount) return errorResponse("Account not found", 404);

    const rows = extractRows(csv, homeAccount.type);
    if (rows.length === 0) {
      return errorResponse(
        "Couldn't find any transactions in that file. Make sure it's the raw CSV export with a Date and Amount column."
      );
    }

    // Category name → id (case-insensitive), and learned rules for this account.
    const categories = await prisma.homeCategory.findMany({
      where: { accountId: account.id },
      select: { id: true, name: true },
    });
    const catIdByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const learned = await prisma.homeCategoryRule.findMany({
      where: { accountId: account.id },
      orderBy: { priority: "desc" },
      select: { matcher: true, categoryId: true },
    });

    // Dedup against rows already imported into this account. Occurrence-aware:
    // we skip an incoming row only if the DB already holds that exact row
    // (same account+date+amount+description). Genuine same-day repeats (e.g.
    // two identical coffees) are preserved because we only skip up to the
    // number already stored, never collapse repeats within one file.
    const existing = await prisma.homeTransaction.findMany({
      where: { homeAccountId },
      select: { externalKey: true },
    });
    const existingCount = new Map<string, number>();
    for (const e of existing) {
      if (e.externalKey) existingCount.set(e.externalKey, (existingCount.get(e.externalKey) ?? 0) + 1);
    }
    const fileSeen = new Map<string, number>();

    let added = 0;
    let duplicates = 0;
    let needsReviewCount = 0;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    const importRec = await prisma.homeImport.create({
      data: {
        accountId: account.id,
        homeAccountId,
        filename,
        source: homeAccount.type,
        rowCount: rows.length,
      },
    });

    const data: {
      accountId: string;
      homeAccountId: string;
      date: Date;
      year: number;
      month: number;
      amount: number;
      description: string;
      rawDescription: string;
      categoryId: string | null;
      isExcluded: boolean;
      excludeReason: string | null;
      needsReview: boolean;
      importId: string;
      externalKey: string;
    }[] = [];

    for (const r of rows) {
      const key = externalKey(homeAccountId, r);
      const alreadyInDb = existingCount.get(key) ?? 0;
      const seenInFile = fileSeen.get(key) ?? 0;
      fileSeen.set(key, seenInFile + 1);
      // This occurrence is a duplicate only if the DB already has at least
      // this many identical rows.
      if (seenInFile < alreadyInDb) {
        duplicates++;
        continue;
      }

      // Learned rules win over built-in classification.
      let categoryId: string | null = null;
      let excluded = false;
      let excludeReason: string | null = null;
      const rawLower = r.raw.toLowerCase();
      const learnedHit = learned.find((l) => l.matcher && rawLower.includes(l.matcher));
      if (learnedHit) {
        categoryId = learnedHit.categoryId;
      } else {
        const c = classify(r.raw);
        if (c.categoryName) categoryId = catIdByName.get(c.categoryName.toLowerCase()) ?? null;
        if (c.transfer) {
          excluded = true;
          excludeReason = "Auto: card payment / transfer";
        }
      }
      const needsReview = !excluded && categoryId === null;
      if (needsReview) needsReviewCount++;

      if (!minDate || r.date < minDate) minDate = r.date;
      if (!maxDate || r.date > maxDate) maxDate = r.date;

      data.push({
        accountId: account.id,
        homeAccountId,
        date: r.date,
        year: r.date.getUTCFullYear(),
        month: r.date.getUTCMonth() + 1,
        amount: r.amount,
        description: r.description,
        rawDescription: r.raw,
        categoryId,
        isExcluded: excluded,
        excludeReason,
        needsReview,
        importId: importRec.id,
        externalKey: key,
      });
      added++;
    }

    if (data.length > 0) {
      await prisma.homeTransaction.createMany({ data });
    }
    await prisma.homeImport.update({
      where: { id: importRec.id },
      data: {
        addedCount: added,
        duplicateCount: duplicates,
        periodStart: minDate,
        periodEnd: maxDate,
      },
    });

    return jsonResponse({
      ok: true,
      rowCount: rows.length,
      added,
      duplicates,
      needsReview: needsReviewCount,
    });
  } catch (error) {
    console.error("Home import error:", error);
    return errorResponse(
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      500
    );
  }
}
