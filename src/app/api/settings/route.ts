import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { accountSettingsSchema, assetLeverageSchema } from "@/lib/validators";

// GET /api/settings — get account settings
export async function GET() {
  try {
    const account = await getAccount();
    const leverages = await prisma.assetLeverage.findMany({
      where: { accountId: account.id },
      orderBy: { symbol: "asc" },
    });

    return jsonResponse({
      ...account,
      assetLeverages: leverages,
    });
  } catch (error) {
    return errorResponse("Failed to fetch settings", 500);
  }
}

// PUT /api/settings — update account settings
export async function PUT(req: NextRequest) {
  try {
    const account = await getAccount();
    const body = await req.json();

    // Handle account settings update
    if (body.accountSettings) {
      const parsed = accountSettingsSchema.safeParse(body.accountSettings);
      if (!parsed.success) return errorResponse(parsed.error.message);

      await prisma.account.update({
        where: { id: account.id },
        data: parsed.data,
      });
    }

    // Handle asset leverage upsert
    if (body.assetLeverage) {
      const parsed = assetLeverageSchema.safeParse(body.assetLeverage);
      if (!parsed.success) return errorResponse(parsed.error.message);

      await prisma.assetLeverage.upsert({
        where: {
          accountId_symbol: {
            accountId: account.id,
            symbol: parsed.data.symbol,
          },
        },
        update: { leverage: parsed.data.leverage },
        create: {
          accountId: account.id,
          symbol: parsed.data.symbol,
          leverage: parsed.data.leverage,
        },
      });
    }

    // Handle asset leverage deletion
    if (body.deleteAssetLeverage) {
      await prisma.assetLeverage.delete({
        where: {
          accountId_symbol: {
            accountId: account.id,
            symbol: body.deleteAssetLeverage,
          },
        },
      });
    }

    // Return updated settings
    const updated = await prisma.account.findUnique({
      where: { id: account.id },
      include: { assetLeverages: true },
    });

    return jsonResponse(updated);
  } catch (error) {
    return errorResponse("Failed to update settings", 500);
  }
}
