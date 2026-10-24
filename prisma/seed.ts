import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_COMPANY_CONFIG } from "../src/config/company";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando Seed da Plataforma InTime Technology...");

  // 1. Configurações Institucionais da In Time Technology e Systems LTDA
  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {
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

  // 2. Administrador Inicial
  const adminEmail =
    process.env.INITIAL_ADMIN_EMAIL || "admin@intimetechnology.com.br";
  const adminPass = process.env.INITIAL_ADMIN_PASSWORD || "InTime@Admin2026";
  const passwordHash = await bcrypt.hash(adminPass, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Administrador InTime Technology",
      role: "ADMIN",
      isActive: true,
    },
    create: {
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

  console.log(`Seed concluído! Login Admin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
