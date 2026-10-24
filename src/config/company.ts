import { z } from "zod";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - CONFIGURAÇÃO INSTITUCIONAL & IDENTIDADE VISUAL
 * ============================================================================
 * Este módulo centraliza os dados oficiais da InTime Technology, a paleta de
 * cores do Design System (Light & Dark Mode) e os textos legais padrão (LGPD e
 * Garantia). Em tempo de execução, o serviço `getCompanyConfig()` sincroniza
 * automaticamente estes valores com a tabela `company_settings` no PostgreSQL,
 * permitindo que o ADMIN atualize logotipo, contatos e termos pelo painel sem
 * necessidade de rebuild.
 */

export const CompanyConfigSchema = z.object({
  // Dados Jurídicos e Institucionais
  tradeName: z.string().min(2, "Nome Fantasia é obrigatório"),
  legalName: z.string().min(2, "Razão Social é obrigatória"),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido"),
  stateRegistration: z.string().optional().nullable(),
  municipalRegistration: z.string().optional().nullable(),

  // Canais de Atendimento e Presença Digital
  email: z.string().email("E-mail institucional inválido"),
  phone: z.string().min(8, "Telefone inválido"),
  whatsapp: z.string().optional().nullable(),
  website: z.string().url("URL do site inválida").optional().nullable(),

  // Ativos de Marca (Armazenados em /public/brand/ ou /app/uploads/brand/)
  logoUrl: z.string().default("/brand/logo.svg"),
  faviconUrl: z.string().default("/brand/favicon.svg"),

  // Endereço Corporativo
  address: z.object({
    zipCode: z.string().optional().nullable(),
    street: z.string().optional().nullable(),
    number: z.string().optional().nullable(),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().optional().nullable(),
    city: z.string().default("São Paulo"),
    state: z.string().default("SP"),
  }),

  // Design System: Paleta de Cores Oficial InTime Technology
  theme: z.object({
    primary: z.object({
      DEFAULT: z.string().default("#0284C7"), // InTime Royal Blue (Botões principais, links ativos)
      hover: z.string().default("#0369A1"),   // Deep Ocean Blue (Hover / Foco)
      foreground: z.string().default("#FFFFFF"),
    }),
    secondary: z.object({
      DEFAULT: z.string().default("#0F172A"), // Deep Tech Navy (Sidebars, cabeçalhos, dark surfaces)
      surface: z.string().default("#1E293B"), // Slate Tech Surface (Cards secundários / Dark Mode)
      foreground: z.string().default("#F8FAFC"),
    }),
    accent: z.object({
      DEFAULT: z.string().default("#38BDF8"), // Electric Cyan / Sky (Destaques visuais, badges, progresso)
      foreground: z.string().default("#0F172A"),
    }),
    status: z.object({
      operational: z.string().default("#10B981"), // Verde Esmeralda (Operacional / Concluído / Finalizada)
      warning: z.string().default("#F59E0B"),     // Âmbar (Em Atendimento / Em Manutenção / Aguardando)
      danger: z.string().default("#EF4444"),      // Vermelho (Crítico / Cancelado / Desativado)
      restricted: z.string().default("#F97316"),  // Laranja (Com Restrição)
    }),
  }),

  // Cláusulas Legais, Garantia e Conformidade LGPD (Lei nº 13.709/2018)
  legal: z.object({
    defaultWarrantyDays: z.number().int().min(0).default(90),
    defaultWarrantyTerms: z.string(),
    lgpdClauseText: z.string(),
    confidentialityTermsVersion: z.string().default("v1.0-LGPD-2026"),
    dpoContactEmail: z.string().email().default("privacidade@intimetechnology.com.br"),
  }),

  // Políticas de Backup Automático (Volume Persistente /app/backups)
  backup: z.object({
    cronEnabled: z.boolean().default(true),
    cronSchedule: z.string().default("0 3 * * *"), // Todos os dias às 03:00 AM
    retentionCount: z.number().int().min(1).max(90).default(10),
    uploadsPath: z.string().default("/app/uploads"),
    backupsPath: z.string().default("/app/backups"),
  }),
});

export type CompanyConfig = z.infer<typeof CompanyConfigSchema>;

/**
 * Configuração Institucional Padrão (Fallback estático & Seed inicial do Banco)
 */
export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  tradeName: "InTime Technology",
  legalName: "In Time Technology e Systems LTDA",
  cnpj: "10.742.889/0001-36",
  stateRegistration: "ISENTO",
  municipalRegistration: null,

  email: "contato@intimetechnology.com.br",
  phone: "(11) 3000-0000",
  whatsapp: "(11) 99999-0000",
  website: "https://intimetechnology.com.br",

  logoUrl: "/brand/logo.svg",
  faviconUrl: "/brand/favicon.svg",

  address: {
    zipCode: "01001-000",
    street: "Centro Empresarial InTime Technology",
    number: "100",
    complement: "Conjunto Técnico",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
  },

  theme: {
    primary: {
      DEFAULT: "#0284C7",
      hover: "#0369A1",
      foreground: "#FFFFFF",
    },
    secondary: {
      DEFAULT: "#0F172A",
      surface: "#1E293B",
      foreground: "#F8FAFC",
    },
    accent: {
      DEFAULT: "#38BDF8",
      foreground: "#0F172A",
    },
    status: {
      operational: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
      restricted: "#F97316",
    },
  },

  legal: {
    defaultWarrantyDays: 90,
    defaultWarrantyTerms:
      "Garantia legal de 90 (noventa) dias restrita aos serviços técnicos executados e peças substituídas discriminadas nesta Ordem de Serviço, nos termos do Art. 26, inciso II do Código de Defesa do Consumidor (Lei nº 8.078/1990). A garantia não cobre danos decorrentes de mau uso, quedas, derramamento de líquidos, surtos ou oscilações da rede elétrica, infecções por softwares maliciosos (vírus/ransomware) ou violação dos lacres de garantia da InTime Technology por terceiros não autorizados.",
    lgpdClauseText:
      "CONFORMIDADE LGPD (Lei nº 13.709/2018): A In Time Technology e Systems LTDA (CNPJ 10.742.889/0001-36) atua como Controladora/Operadora dos dados pessoais e corporativos coletados nesta Ordem de Serviço e Laudo Técnico. Os dados cadastrais, registros fotográficos de equipamentos (Antes/Durante/Depois), números de série e assinaturas digitais são tratados estritamente para execução contratual (Art. 7º, V da LGPD), exercício regular de direitos (Art. 7º, VI) e cumprimento de obrigações legais/fiscais (Art. 7º, II), sendo armazenados em infraestrutura privada criptografada.",
    confidentialityTermsVersion: "v1.0-LGPD-2026",
    dpoContactEmail: "privacidade@intimetechnology.com.br",
  },

  backup: {
    cronEnabled: true,
    cronSchedule: "0 3 * * *",
    retentionCount: 10,
    uploadsPath: process.env.UPLOADS_DIR || "/app/uploads",
    backupsPath: process.env.BACKUPS_DIR || "/app/backups",
  },
};

/**
 * Mapeamento Semântico de Status de OS e Equipamentos para Cores e Badges
 */
export const STATUS_DESIGN_TOKENS = {
  serviceOrder: {
    ORCAMENTO: {
      label: "Orçamento",
      colorHex: "#38BDF8",
      badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    },
    ABERTA: {
      label: "Aberta",
      colorHex: "#0284C7",
      badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
    EM_ANDAMENTO: {
      label: "Em Andamento",
      colorHex: "#F59E0B",
      badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    AGUARDANDO_PECAS: {
      label: "Aguardando Peças/Aprovação",
      colorHex: "#F97316",
      badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    },
    FINALIZADA: {
      label: "Finalizada",
      colorHex: "#10B981",
      badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    CANCELADA: {
      label: "Cancelada",
      colorHex: "#EF4444",
      badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    },
  },
  equipment: {
    OPERACIONAL: {
      label: "Operacional",
      colorHex: "#10B981",
      badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    EM_MANUTENCAO: {
      label: "Em Manutenção",
      colorHex: "#F59E0B",
      badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    COM_RESTRICAO: {
      label: "Com Restrição",
      colorHex: "#F97316",
      badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    },
    DESATIVADO: {
      label: "Desativado",
      colorHex: "#EF4444",
      badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    },
  },
} as const;
