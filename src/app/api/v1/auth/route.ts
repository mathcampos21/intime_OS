import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  clearAuthCookie,
  getAuthSession,
  hashPassword,
  setAuthCookie,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { getClientIp } from "@/lib/cloudflare-ip";
import { recordAuditLog } from "@/lib/audit";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

const LoginRequestSchema = z.object({
  email: z.string().email("Informe um e-mail corporativo válido."),
  password: z.string().min(4, "Informe sua senha de acesso."),
});

/**
 * Auto-Bootstrap (First-Boot Seed):
 * Caso o banco de dados PostgreSQL acabe de ser criado no Docker/Portainer e
 * ainda não possua nenhum usuário cadastrado (`COUNT(users) = 0`), cria
 * automaticamente o Administrador Inicial e as Configurações da InTime Technology.
 */
async function ensureInitialAdminBootstrapped(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const adminEmail = (
    process.env.INITIAL_ADMIN_EMAIL || "admin@intimetechnology.com.br"
  )
    .toLowerCase()
    .trim();
  const adminPassword =
    process.env.INITIAL_ADMIN_PASSWORD || "InTime@Admin2026";
  const passwordHash = await hashPassword(adminPassword);

  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tradeName: DEFAULT_COMPANY_CONFIG.tradeName,
      legalName: DEFAULT_COMPANY_CONFIG.legalName,
      cnpj: DEFAULT_COMPANY_CONFIG.cnpj,
      email: DEFAULT_COMPANY_CONFIG.email,
      phone: DEFAULT_COMPANY_CONFIG.phone,
      whatsapp: DEFAULT_COMPANY_CONFIG.whatsapp,
      website: DEFAULT_COMPANY_CONFIG.website,
      logoUrl: DEFAULT_COMPANY_CONFIG.logoUrl,
      primaryColor: DEFAULT_COMPANY_CONFIG.theme.primary.DEFAULT,
      secondaryColor: DEFAULT_COMPANY_CONFIG.theme.secondary.DEFAULT,
      accentColor: DEFAULT_COMPANY_CONFIG.theme.accent.DEFAULT,
      defaultWarrantyDays: DEFAULT_COMPANY_CONFIG.legal.defaultWarrantyDays,
      defaultWarrantyTerms: DEFAULT_COMPANY_CONFIG.legal.defaultWarrantyTerms,
      lgpdClauseText: DEFAULT_COMPANY_CONFIG.legal.lgpdClauseText,
    },
  });

  await prisma.user.create({
    data: {
      name: "Administrador InTime Technology",
      cpf: "000.000.000-01",
      jobTitle: "Diretor Técnico / Admin",
      professionalRegistry: "CFT/CREA-SP",
      email: adminEmail,
      passwordHash,
      phone: DEFAULT_COMPANY_CONFIG.phone,
      role: "ADMIN",
      isActive: true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Garante que no primeiro boot do container o Admin Inicial exista no banco
    await ensureInitialAdminBootstrapped();

    const body = await req.json();
    const parsed = LoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Credenciais inválidas." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      await recordAuditLog({
        action: "LOGIN_FAILED",
        entity: "User",
        details: { email, reason: "User not found or inactive" },
        req,
      });
      return NextResponse.json(
        { error: "E-mail ou senha incorretos, ou colaborador inativo." },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(
      parsed.data.password,
      user.passwordHash
    );
    if (!passwordValid) {
      await recordAuditLog({
        userId: user.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        details: { email, reason: "Invalid password" },
        req,
      });
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(req);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      },
    });

    const requiredTermsVersion =
      DEFAULT_COMPANY_CONFIG.legal.confidentialityTermsVersion;
    const requiresTermsAcceptance =
      user.acceptedTermsVersion !== requiredTermsVersion;

    const sessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      acceptedTermsVersion: user.acceptedTermsVersion,
      requiresTermsAcceptance,
    };

    const token = await signSessionToken(sessionPayload);
    setAuthCookie(token);

    await recordAuditLog({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entity: "User",
      entityId: user.id,
      details: { role: user.role, clientIp },
      req,
    });

    return NextResponse.json({
      token,
      user: sessionPayload,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erro interno ao autenticar na plataforma.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: session });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuthSession(req);
  clearAuthCookie();
  if (session) {
    await recordAuditLog({
      userId: session.userId,
      action: "LOGOUT",
      entity: "User",
      entityId: session.userId,
      req,
    });
  }
  return NextResponse.json({ success: true });
}
