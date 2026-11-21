import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api-helpers";
import { hasAppCookie } from "@/lib/assistant-auth";
import { deleteQuestion, markQuestionRead } from "@/lib/assistant-data";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/assistant/questions/[id] { read: true } — mark an answer read.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await hasAppCookie(req))) return errorResponse("Unauthorized", 401);
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { read?: unknown };
    if (body.read !== undefined && body.read !== true) return errorResponse("Only { read: true } is supported");
    const question = await markQuestionRead(id);
    if (!question) return errorResponse("Not found", 404);
    return jsonResponse({ question });
  } catch (error) {
    console.error("Assistant mark-read error:", error);
    return errorResponse("Failed to update question", 500);
  }
}

// DELETE /api/assistant/questions/[id]
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await hasAppCookie(req))) return errorResponse("Unauthorized", 401);
  try {
    const { id } = await params;
    if (!(await deleteQuestion(id))) return errorResponse("Not found", 404);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Assistant delete error:", error);
    return errorResponse("Failed to delete question", 500);
  }
}
