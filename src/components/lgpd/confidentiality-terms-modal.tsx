"use client";

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

const CONFIDENTIALITY_TERMS_TEXT = `TERMO DE CONFIDENCIALIDADE, SIGILO TÉCNICO E USO ÉTICO DE DADOS (LGPD - LEI Nº 13.709/2018)

Pelo presente instrumento, na qualidade de colaborador(a) ou técnico(a) credenciado(a) da empresa IN TIME TECHNOLOGY E SYSTEMS LTDA, inscrita no CNPJ sob o nº 10.742.889/0001-36 ("InTime Technology"), comprometo-me a cumprir rigorosamente as seguintes obrigações legais e operacionais:

1. SIGILO DE INFORMAÇÕES E EQUIPAMENTOS DOS CLIENTES: Todas as informações acessadas durante o exercício das atividades técnicas — incluindo dados cadastrais de clientes PF/PJ, topologias de rede, senhas administrativas, configurações de servidores, fotos de equipamentos (Antes/Durante/Depois), números de série e diagnósticos constantes nos Laudos Técnicos — são estritamente confidenciais.

2. FINALIDADE EXCLUSIVA (ART. 6º, I DA LGPD): É expressamente vedado copiar, compartilhar em aplicativos de mensagens particulares, exportar ou utilizar fotos de laudos e dados de clientes para qualquer finalidade estranha à execução da respectiva Ordem de Serviço (OS).

3. RASTREABILIDADE E AUDITORIA (ART. 37 DA LGPD): Estou ciente de que todas as ações realizadas nesta plataforma Web e no Aplicativo Android (criação/edição de OS, geração de PDFs, capturas de câmera e downloads) são registradas em Trilha de Auditoria inalterável com identificação do meu usuário, carimbo de tempo (timestamp) e endereço IP real (via Cloudflare Tunnel).`;

interface ConfidentialityTermsModalProps {
  open: boolean;
  userName: string;
  onAccepted: () => void;
}

export function ConfidentialityTermsModal({
  open,
  userName,
  onAccepted,
}: ConfidentialityTermsModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!checked) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          termsTextSnapshot: CONFIDENTIALITY_TERMS_TEXT,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Falha ao registrar aceite.");
      }
      toast.success(
        `Termo ${DEFAULT_COMPANY_CONFIG.legal.confidentialityTermsVersion} assinado e auditado (IP: ${json.ipAddress}).`
      );
      onAccepted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar termo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lgpd-terms-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[#0284C7]/50 bg-[#0F172A] text-slate-100 p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#0284C7]/20 p-3 text-[#38BDF8]">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 id="lgpd-terms-title" className="text-lg font-bold text-white">
              Termo Obrigatório de Confidencialidade e Uso Ético (LGPD)
            </h2>
            <p className="text-xs text-slate-400">
              {DEFAULT_COMPANY_CONFIG.legalName} — CNPJ:{" "}
              {DEFAULT_COMPANY_CONFIG.cnpj} | Versão:{" "}
              {DEFAULT_COMPANY_CONFIG.legal.confidentialityTermsVersion}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-[#1E293B] p-4 max-h-64 overflow-y-auto text-xs text-slate-200 whitespace-pre-line leading-relaxed">
          {CONFIDENTIALITY_TERMS_TEXT}
        </div>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-700/80 bg-[#1E293B]/60 p-3.5 text-xs text-slate-200">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 text-[#0284C7] focus:ring-[#38BDF8]"
          />
          <span>
            Eu, <strong>{userName}</strong>, li integralmente e concordo com o{" "}
            <strong>Termo de Confidencialidade e Uso Ético</strong> da{" "}
            <strong>InTime Technology</strong>, autorizando o registro eletrônico
            deste aceite com meu identificador de usuário, data/hora e endereço IP.
          </span>
        </label>

        <div className="flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="h-3.5 w-3.5 text-[#38BDF8]" />
            Registro auditado com hash SHA-256 no PostgreSQL
          </span>
          <button
            type="button"
            disabled={!checked || submitting}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting
              ? "Registrando Aceite..."
              : "Assinar Digitalmente e Acessar Sistema"}
          </button>
        </div>
      </div>
    </div>
  );
}
