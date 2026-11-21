import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { updateProfileSchema } from "@/lib/savings-validators";
import { getProfile, updateProfile } from "@/lib/savings-data";

// GET /api/savings/profile — household profile (members, goals, risk, FX override)
export async function GET() {
  try {
    return jsonResponse(await getProfile());
  } catch (error) {
    console.error("Get profile error:", error);
    return errorResponse("Failed to load profile", 500);
  }
}

// PUT /api/savings/profile — update; omitted fields are left unchanged, null clears
export async function PUT(req: NextRequest) {
  try {
    const parsed = updateProfileSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.message);
    return jsonResponse(await updateProfile(parsed.data));
  } catch (error) {
    console.error("Update profile error:", error);
    return errorResponse("Failed to update profile", 500);
  }
}
