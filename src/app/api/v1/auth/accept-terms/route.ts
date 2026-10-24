import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, setAuthCookie, signSessionToken } from "@/lib/auth";
import { getClientIp, getClientUserAgent } from "@/lib/cloudflare-ip";
import { recordAuditLog } from "@/lib/audit";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

const AcceptTermsSchema = z.object({
  accepted: z.literal(true, {
    errorMap: () => ({
      message:
        "É obrigatório concordar com o Termo de Confidencialidade e Uso Ético (LGPD).",
    }),
  }),
  termsTextSnapshot: z.string().min(20),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const parsed = AcceptTermsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados de aceite inválidos." },
      { status: 400 }
    );
  }

  const version = DEFAULT_COMPANY_CONFIG.legal.confidentialityTermsVersion;
  const ipAddress = getClientIp(req);
  const userAgent = getClientUserAgent(req);
  const termsHash = crypto
    .createHash("sha256")
    .update(parsed.data.termsTextSnapshot)
    .digest("hex");

  const now = new Date();

  await prisma.$transaction([
    prisma.termsAcceptance.create({
      data: {
        userId: auth.session.userId,
        termsVersion: version,
        termsHash,
        ipAddress,
        userAgent,
        acceptedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: auth.session.userId },
      data: {
        acceptedTermsVersion: version,
        acceptedTermsAt: now,
      },
    }),
  ]);

  const updatedSession = {
    ...auth.session,
    acceptedTermsVersion: version,
    requiresTermsAcceptance: false,
  };
  const newToken = await signSessionToken(updatedSession);
  setAuthCookie(newToken);

  await recordAuditLog({
    userId: auth.session.userId,
    action: "ACCEPT_LGPD_CONFIDENTIALITY_TERMS",
    entity: "TermsAcceptance",
    entityId: auth.session.userId,
    details: { version, termsHash, ipAddress },
    req,
  });

  return NextResponse.json({
    success: true,
    acceptedVersion: version,
    acceptedAt: now.toISOString(),
    ipAddress,
    token: newToken,
  });
}
