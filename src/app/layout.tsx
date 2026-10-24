import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsentBanner } from "@/components/lgpd/cookie-consent-banner";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

export const metadata: Metadata = {
  title: `${DEFAULT_COMPANY_CONFIG.tradeName} | Controle de OS, Laudos e Inventário`,
  description: `Plataforma corporativa de Ordens de Serviço, Laudos Técnicos e Inventário de Equipamentos com Fotos — ${DEFAULT_COMPANY_CONFIG.legalName} (CNPJ ${DEFAULT_COMPANY_CONFIG.cnpj}).`,
  icons: {
    icon: DEFAULT_COMPANY_CONFIG.faviconUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          {children}
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
