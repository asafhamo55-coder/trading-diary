import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, jsonResponse } from "@/lib/api-helpers";
import { PROFILE_SECTIONS, parseProfile, type ProfileSection } from "@/lib/property-profile";
import { ownedProperty } from "@/lib/property-record-server";
import type { Prisma } from "@/generated/prisma/client";

// PATCH /api/properties/[id]/profile — replace one section of the property
// record: { section: "insurance", data: { … } }. Other sections are kept.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const property = await ownedProperty(id);
    if (!property) return errorResponse("Property not found", 404);

    const body = (await req.json().catch(() => null)) as { section?: string; data?: unknown } | null;
    const section = body?.section;
    if (!section || !Object.prototype.hasOwnProperty.call(PROFILE_SECTIONS, section)) {
      return errorResponse("Unknown section");
    }
    const parsed = PROFILE_SECTIONS[section as ProfileSection].safeParse(body?.data ?? {});
    if (!parsed.success) return errorResponse(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

    const profile = { ...parseProfile(property.profile), [section]: parsed.data };
    await prisma.property.update({
      where: { id },
      data: { profile: profile as unknown as Prisma.InputJsonValue },
    });
    return jsonResponse(profile);
  } catch (error) {
    console.error("Update property profile error:", error);
    return errorResponse("Failed to save", 500);
  }
}
