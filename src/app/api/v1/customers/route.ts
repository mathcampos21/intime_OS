import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

const CustomerCreateSchema = z.object({
  isLegalEntity: z.boolean().default(true),
  name: z.string().min(2, "Razão Social ou Nome Completo é obrigatório."),
  tradeName: z.string().optional().nullable(),
  document: z.string().min(11, "CPF ou CNPJ é obrigatório."),
  stateRegistration: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  contactRole: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
            { document: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      _count: {
        select: {
          equipments: true,
          serviceOrders: true,
        },
      },
      units: true,
    },
    orderBy: { name: "asc" },
    take: 150,
  });

  return NextResponse.json({ data: customers });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const parsed = CustomerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados de cliente inválidos." },
      { status: 400 }
    );
  }

  const created = await prisma.customer.create({
    data: {
      isLegalEntity: parsed.data.isLegalEntity,
      name: parsed.data.name.trim(),
      tradeName: parsed.data.tradeName?.trim() || null,
      document: parsed.data.document.trim(),
      stateRegistration: parsed.data.stateRegistration?.trim() || null,
      email: parsed.data.email?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      mobile: parsed.data.mobile?.trim() || null,
      contactPerson: parsed.data.contactPerson?.trim() || null,
      contactRole: parsed.data.contactRole?.trim() || null,
      zipCode: parsed.data.zipCode?.trim() || null,
      street: parsed.data.street?.trim() || null,
      number: parsed.data.number?.trim() || null,
      complement: parsed.data.complement?.trim() || null,
      neighborhood: parsed.data.neighborhood?.trim() || null,
      city: parsed.data.city?.trim() || null,
      state: parsed.data.state?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "CREATE_CUSTOMER",
    entity: "Customer",
    entityId: created.id,
    details: { name: created.name, document: created.document },
    req,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
