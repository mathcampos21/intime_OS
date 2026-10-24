import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  clearAuthCookie,
  getAuthSession,
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

export async function POST(req: NextRequest) {
  try {
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
