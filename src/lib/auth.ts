import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - AUTENTICAÇÃO JWT + HTTP-ONLY COOKIES + RBAC
 * ============================================================================
 * Atende simultaneamente:
 * - Painel Web (Cookie HTTP-Only `intime_session` com proteção SameSite=Lax)
 * - App Android Capacitor (Header `Authorization: Bearer <token>` ou Cookie)
 */

export const SESSION_COOKIE_NAME = "intime_session";
const TOKEN_EXPIRATION_SECONDS = 60 * 60 * 12; // 12 horas de turno técnico

export interface SessionPayload {
  userId: number;
  name: string;
  email: string;
  role: Role;
  acceptedTermsVersion: string | null;
  requiresTermsAcceptance: boolean;
}

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "intime-technology-jwt-secret-key-256bits-production-2026";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 12);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("urn:intimetechnology:os-platform")
    .setExpirationTime(`${TOKEN_EXPIRATION_SECONDS}s`)
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      issuer: "urn:intimetechnology:os-platform",
    });

    if (typeof payload.userId !== "number" || typeof payload.role !== "string") {
      return null;
    }

    return {
      userId: payload.userId,
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      acceptedTermsVersion:
        typeof payload.acceptedTermsVersion === "string"
          ? payload.acceptedTermsVersion
          : null,
      requiresTermsAcceptance: Boolean(payload.requiresTermsAcceptance),
    };
  } catch {
    return null;
  }
}

/**
 * Define o cookie HTTP-Only seguro para o navegador
 */
export function setAuthCookie(token: string): void {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_EXPIRATION_SECONDS,
  });
}

export function clearAuthCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Obtém a sessão autenticada a partir de uma requisição API (Cookie ou Bearer Token)
 * ou diretamente de Server Components.
 */
export async function getAuthSession(
  req?: NextRequest | Request
): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (req) {
    // 1. Verifica Header Authorization: Bearer <token> (App Android Capacitor)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    // 2. Verifica Cookie na requisição
    if (!token && "cookies" in req && typeof req.cookies.get === "function") {
      token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    }
  }

  // 3. Fallback para cookies() do Next.js App Router
  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // Ignora erro caso chamado fora de contexto de request Next.js
    }
  }

  if (!token) return null;

  const decoded = await verifySessionToken(token);
  if (!decoded) return null;

  // Confirma se o colaborador continua ativo no banco e verifica versão do Termo LGPD
  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      acceptedTermsVersion: true,
    },
  });

  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  const requiredVersion = DEFAULT_COMPANY_CONFIG.legal.confidentialityTermsVersion;

  return {
    userId: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    acceptedTermsVersion: dbUser.acceptedTermsVersion,
    requiresTermsAcceptance: dbUser.acceptedTermsVersion !== requiredVersion,
  };
}

/**
 * Guardião RBAC para rotas de API: valida sessão e perfis permitidos (`ADMIN`, `TECNICO_INTERNO`, `TECNICO_CAMPO`)
 */
export async function requireRole(
  req: NextRequest | Request,
  allowedRoles?: Role[]
): Promise<
  | { authorized: true; session: SessionPayload }
  | { authorized: false; status: number; error: string }
> {
  const session = await getAuthSession(req);
  if (!session) {
    return {
      authorized: false,
      status: 401,
      error: "Não autenticado. Faça login na plataforma InTime Technology.",
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return {
      authorized: false,
      status: 403,
      error: `Acesso negado. Seu perfil (${session.role}) não possui permissão para esta operação.`,
    };
  }

  return { authorized: true, session };
}
