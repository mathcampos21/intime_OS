import React from "react";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-100 py-12 px-4">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-[#1E293B] p-8 md:p-12 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-[#38BDF8]" />
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Termos de Uso e Condições de Garantia Técnica
              </h1>
              <p className="text-xs text-slate-400">
                {DEFAULT_COMPANY_CONFIG.legalName} — CNPJ:{" "}
                {DEFAULT_COMPANY_CONFIG.cnpj}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] px-4 py-2 text-xs font-bold text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Sistema
          </Link>
        </div>

        <section className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-base font-bold text-[#38BDF8]">
            1. Objeto da Plataforma
          </h2>
          <p>
            A plataforma <strong>InTime OS Platform</strong> (Web e Aplicativo
            Android) é de titularidade exclusiva de{" "}
            <strong>{DEFAULT_COMPANY_CONFIG.legalName}</strong> (CNPJ{" "}
            <strong>{DEFAULT_COMPANY_CONFIG.cnpj}</strong>), destinando-se ao
            controle operacional de Ordens de Serviço (OS), emissão de Laudos
            Técnicos com registro fotográfico e gestão de inventário de
            equipamentos por etiqueta QR Code.
          </p>

          <h2 className="text-base font-bold text-[#38BDF8] pt-2">
            2. Condições Gerais de Garantia dos Serviços e Peças
          </h2>
          <p>{DEFAULT_COMPANY_CONFIG.legal.defaultWarrantyTerms}</p>

          <h2 className="text-base font-bold text-[#38BDF8] pt-2">
            3. Validade Jurídica da Assinatura Digital em Tela (Touch Canvas)
          </h2>
          <p>
            Nos termos do Art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e
            da Lei nº 14.063/2020, as assinaturas eletrônicas colhidas na tela
            do dispositivo móvel ou navegador, vinculadas ao documento de
            identificação do recebedor, carimbo de tempo e endereço IP de
            conexão, possuem plena validade probatória para comprovar a
            aprovação de orçamentos, vistoria de equipamentos e entrega de
            serviços concluídos.
          </p>

          <h2 className="text-base font-bold text-[#38BDF8] pt-2">
            4. Responsabilidades da Equipe Técnica e Controle de Acesso (RBAC)
          </h2>
          <p>
            Todo colaborador autenticado sob os perfis <code>ADMIN</code>,{" "}
            <code>TECNICO_INTERNO</code> ou <code>TECNICO_CAMPO</code> possui
            credencial individual e intransferível, submetida ao Termo de
            Confidencialidade e Uso Ético assinado no primeiro acesso e auditada
            continuamente na tabela <code>audit_logs</code>.
          </p>
        </section>
      </article>
    </main>
  );
}
