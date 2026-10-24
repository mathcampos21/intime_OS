import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp, getClientUserAgent } from "@/lib/cloudflare-ip";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - TRILHA DE AUDITORIA (CONFORMIDADE LGPD ART. 37)
 * ============================================================================
 * Registra quem criou, editou, exportou ou excluiu registros sensíveis,
 * capturando o IP real (via Cloudflare Tunnel `CF-Connecting-IP`) e User-Agent.
 */

export interface AuditLogInput {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  req?: NextRequest | Request | Headers | null;
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const ipAddress = getClientIp(input.req);
    const userAgent = getClientUserAgent(input.req);

    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
        details: input.details
          ? (JSON.parse(JSON.stringify(input.details)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Nunca interrompe a transação principal caso o log de auditoria falhe, mas registra no stderr
    console.error("[LGPD AuditLog Error]:", error);
  }
}
