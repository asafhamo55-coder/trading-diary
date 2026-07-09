import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { updateTenantSchema } from "@/lib/validators";

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function ownedTenant(id: string, tenantId: string, accountId: string) {
  return prisma.tenant.findFirst({
    where: { id: tenantId, propertyId: id, property: { accountId } },
  });
}

// PATCH /api/properties/[id]/tenants/[tenantId] — edit a tenant
// (also how a lease is ended: set leaseEnd)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tenantId: string }> }
) {
  try {
    const { id, tenantId } = await params;
    const account = await getAccount();
    const existing = await ownedTenant(id, tenantId, account.id);
    if (!existing) return errorResponse("Tenant not found", 404);

    const body = await req.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.monthlyRent !== undefined) patch.monthlyRent = data.monthlyRent;
    if (data.securityDeposit !== undefined) patch.securityDeposit = data.securityDeposit;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.leaseStart !== undefined) {
      const d = parseDate(data.leaseStart);
      if (!d) return errorResponse("Invalid lease start date");
      patch.leaseStart = d;
    }
    if (data.leaseEnd !== undefined) {
      if (data.leaseEnd === null || data.leaseEnd === "") {
        patch.leaseEnd = null;
      } else {
        const d = parseDate(data.leaseEnd);
        if (!d) return errorResponse("Invalid lease end date");
        patch.leaseEnd = d;
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: patch,
    });
    return jsonResponse(tenant);
  } catch (error) {
    console.error("Update tenant error:", error);
    return errorResponse("Failed to update tenant", 500);
  }
}

// DELETE /api/properties/[id]/tenants/[tenantId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tenantId: string }> }
) {
  try {
    const { id, tenantId } = await params;
    const account = await getAccount();
    const existing = await ownedTenant(id, tenantId, account.id);
    if (!existing) return errorResponse("Tenant not found", 404);
    await prisma.tenant.delete({ where: { id: tenantId } });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Delete tenant error:", error);
    return errorResponse("Failed to delete tenant", 500);
  }
}
