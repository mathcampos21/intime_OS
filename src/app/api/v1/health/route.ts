import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "operational",
      company: DEFAULT_COMPANY_CONFIG.tradeName,
      legalName: DEFAULT_COMPANY_CONFIG.legalName,
      cnpj: DEFAULT_COMPANY_CONFIG.cnpj,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        error: err instanceof Error ? err.message : "Database unreachable",
      },
      { status: 503 }
    );
  }
}
