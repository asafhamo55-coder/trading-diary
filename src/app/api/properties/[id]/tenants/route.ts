import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonResponse, errorResponse, getAccount } from "@/lib/api-helpers";
import { createTenantSchema } from "@/lib/validators";

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// POST /api/properties/[id]/tenants — add a tenant to a property
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getAccount();
    const property = await prisma.property.findFirst({
      where: { id, accountId: account.id },
    });
    if (!property) return errorResponse("Property not found", 404);

    const body = await req.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);
    const data = parsed.data;

    const leaseStart = parseDate(data.leaseStart);
    if (!leaseStart) return errorResponse("Invalid lease start date");
    const leaseEnd = data.leaseEnd ? parseDate(data.leaseEnd) : null;
    if (data.leaseEnd && !leaseEnd) return errorResponse("Invalid lease end date");
    if (leaseEnd && leaseEnd < leaseStart)
      return errorResponse("Lease end can't be before lease start");

    const tenant = await prisma.tenant.create({
      data: {
        propertyId: id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        leaseStart,
        leaseEnd,
        monthlyRent: data.monthlyRent ?? null,
        securityDeposit: data.securityDeposit ?? null,
        notes: data.notes ?? null,
      },
    });
    return jsonResponse(tenant, 201);
  } catch (error) {
    console.error("Create tenant error:", error);
    return errorResponse("Failed to create tenant", 500);
  }
}
