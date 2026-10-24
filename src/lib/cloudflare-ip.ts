import type { NextRequest } from "next/server";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - EXTRATOR DE IP REAL (CLOUDFLARE TUNNEL & REVERSE PROXY)
 * ============================================================================
 * Lê com prioridade o cabeçalho `CF-Connecting-IP` injetado pelo Cloudflare
 * Tunnel, seguido de `X-Real-IP` e `X-Forwarded-For`, garantindo que os logs
 * de auditoria LGPD, termos de confidencialidade e assinaturas digitais de OS
 * registrem o endereço IP real do técnico em campo ou do cliente.
 */
export function getClientIp(req?: NextRequest | Request | Headers | null): string {
  if (!req) return "127.0.0.1";

  const headers = req instanceof Headers ? req : req.headers;

  // 1. Cabeçalho oficial do Cloudflare Tunnel / Cloudflare Proxy
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }

  // 2. Cabeçalho X-Forwarded-For (primeiro IP da cadeia de proxies)
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor && xForwardedFor.trim().length > 0) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  // 3. Cabeçalho X-Real-IP (Nginx / Traefik / Portainer)
  const xRealIp = headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim().length > 0) {
    return xRealIp.trim();
  }

  return "127.0.0.1";
}

export function getClientUserAgent(req?: NextRequest | Request | Headers | null): string {
  if (!req) return "Unknown";
  const headers = req instanceof Headers ? req : req.headers;
  return headers.get("user-agent") || "InTime-Mobile-Client";
}
