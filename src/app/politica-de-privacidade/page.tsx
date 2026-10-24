import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0F172A] text-slate-100 py-12 px-4">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-[#1E293B] p-8 md:p-12 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-[#38BDF8]" />
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Política de Privacidade e Proteção de Dados (LGPD)
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
          <p>
            A <strong>{DEFAULT_COMPANY_CONFIG.legalName}</strong> (nome fantasia{" "}
            <strong>{DEFAULT_COMPANY_CONFIG.tradeName}</strong>), pessoa jurídica
            de direito privado inscrita no CNPJ sob o nº{" "}
            <strong>{DEFAULT_COMPANY_CONFIG.cnpj}</strong>, estabelece a presente
            Política de Privacidade em estrita conformidade com a{" "}
            <strong>
              Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
            </strong>{" "}
            e com o Marco Civil da Internet (Lei nº 12.965/2014).
          </p>

          <h2 className="text-base font-bold text-[#38BDF8] pt-2">
            1. Dados Coletados e Finalidade Específica (Art. 6º, I e Art. 7º, V da LGPD)
          </h2>
          <p>
            No âmbito da prestação de serviços de suporte técnico, manutenção de
            hardware/infraestrutura e emissão de Laudos Técnicos, coletamos e
            tratamos apenas os dados estritamente necessários para a execução
            contratual e cumprimento de obrigação fiscal/legal:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs">
            <li>
              <strong>Dados de Clientes (PF/PJ):</strong> Nome/Razão Social,
              CPF/CNPJ, Inscrição Estadual, endereço de atendimento, telefone e
              e-mail do responsável técnico ou financeiro.
            </li>
            <li>
              <strong>Inventário e Registros Fotográficos de Equipamentos:</strong>{" "}
              Marca, modelo, número de série (S/N), tag de patrimônio, QR Code e
              fotos técnicas das etapas <em>Identificação</em>, <em>Antes</em>,{" "}
              <em>Durante</em> e <em>Depois</em> do atendimento, destinadas
              exclusivamente à comprovação da integridade física e do serviço
              executado.
            </li>
            <li>
              <strong>Assinaturas Digitais e Logs de Segurança:</strong>{" "}
              Assinatura coletada em tela sensível ao toque (Touch Canvas),
              acompanhada de carimbo de tempo (timestamp) e endereço IP real
              capturado via cabeçalho seguro <code>CF-Connecting-IP</code> /{" "}
              <code>X-Forwarded-For</code>.
            </li>
          </ul>

          <h2 className="text-base font-bold text-[#38BDF8] pt-2">
            2. Arquitetura Self-Hosted & Ausência de Rastreadores de Terceiros
          </h2>
          <p>
            Esta plataforma opera em infraestrutura própria (Self-Hosted) da{" "}
            <strong>InTime Technology</strong>. Não utilizamos cookies
            publicitários, pixels de rastreamento ou ferramentas de analytics
            comerciais de terceiros. Os únicos cookies utilizados são
            estritamente necessários para autenticação criptografada HTTP-Only (
            <code>intime_session</code>) e preferência visual de tema
            (Claro/Escuro).
          </p>

          <h2 className="text-base font-bold text-[#38BDF8] pt-2">
            3. Direitos dos Titulares de Dados (Art. 18 da LGPD)
          </h2>
          <p>
            O titular dos dados ou representante legal do cliente pode, a
            qualquer momento, solicitar a confirmação da existência de
            tratamento, acesso aos laudos e fichas de equipamentos, correção de
            dados cadastrais ou informações sobre o compartilhamento legal
            através do nosso Encarregado de Proteção de Dados (DPO) pelo e-mail:{" "}
            <strong className="text-white">
              {DEFAULT_COMPANY_CONFIG.legal.dpoContactEmail}
            </strong>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
