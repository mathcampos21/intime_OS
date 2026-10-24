import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

const EmployeeCreateSchema = z.object({
  name: z.string().min(2, "Nome completo é obrigatório."),
  cpf: z.string().min(11, "CPF válido é obrigatório."),
  rg: z.string().optional().nullable(),
  jobTitle: z.string().min(2, "Cargo/Função é obrigatório."),
  professionalRegistry: z.string().optional().nullable(),
  email: z.string().email("E-mail corporativo inválido."),
  password: z.string().min(6, "A senha inicial deve ter no mínimo 6 caracteres."),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  role: z.enum(["ADMIN", "TECNICO_INTERNO", "TECNICO_CAMPO"]).default("TECNICO_CAMPO"),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const employees = await prisma.user.findMany({
    select: {
      id: true,
      legacyMaposId: true,
      name: true,
      cpf: true,
      rg: true,
      jobTitle: true,
      professionalRegistry: true,
      email: true,
      phone: true,
      mobile: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      lastLoginIp: true,
      acceptedTermsVersion: true,
      acceptedTermsAt: true,
      createdAt: true,
      _count: {
        select: {
          assignedServiceOrders: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: employees });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN"]);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const parsed = EmployeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados de colaborador inválidos." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const created = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      cpf: parsed.data.cpf.trim(),
      rg: parsed.data.rg?.trim() || null,
      jobTitle: parsed.data.jobTitle.trim(),
      professionalRegistry: parsed.data.professionalRegistry?.trim() || null,
      email: parsed.data.email.toLowerCase().trim(),
      passwordHash,
      phone: parsed.data.phone?.trim() || null,
      mobile: parsed.data.mobile?.trim() || null,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    },
  });

  await recordAuditLog({
    userId: auth.session.userId,
    action: "CREATE_EMPLOYEE",
    entity: "User",
    entityId: created.id,
    details: { name: created.name, email: created.email, role: created.role },
    req,
  });

  return NextResponse.json(
    {
      data: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
      },
    },
    { status: 201 }
  );
}
