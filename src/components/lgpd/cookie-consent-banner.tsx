"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "intime_lgpd_cookie_consent_v1";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!saved) {
      setVisible(true);
    }
  }, []);

  const handleAcceptEssential = () => {
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({
        essentialOnly: true,
        acceptedAt: new Date().toISOString(),
      })
    );
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Aviso de Privacidade e Cookies Estritamente Necessários (LGPD)"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-2xl border border-[#38BDF8]/30 bg-[#0F172A]/95 p-4 text-slate-100 shadow-2xl backdrop-blur-md no-print"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-xs leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-[#38BDF8]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Privacidade Custo Zero & Conformidade LGPD (Lei nº 13.709/2018)</span>
          </div>
          <p className="text-slate-300">
            A <strong>In Time Technology e Systems LTDA (CNPJ 10.742.889/0001-36)</strong> utiliza{" "}
            <strong>exclusivamente cookies estritamente necessários</strong> (Sessão segura HTTP-Only, proteção CSRF e preferência de tema Light/Dark), sem qualquer rastreador comercial ou envio de dados a terceiros. Consulte nossa{" "}
            <Link
              href="/politica-de-privacidade"
              className="underline text-[#38BDF8] hover:text-white"
            >
              Política de Privacidade
            </Link>{" "}
            e{" "}
            <Link
              href="/termos-de-uso"
              className="underline text-[#38BDF8] hover:text-white"
            >
              Termos de Uso
            </Link>
            .
          </p>

          {showPrefs && (
            <div className="mt-2 rounded-lg border border-slate-700 bg-[#1E293B] p-3 space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span>
                  <strong>1. Cookies Essenciais de Segurança (`intime_session`):</strong> Autenticação JWT HTTP-Only e proteção CSRF.
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-semibold">
                  Sempre Ativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  <strong>2. Rastreadores Publicitários / Analytics de Terceiros:</strong>
                </span>
                <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300 font-semibold">
                  Desativado / Inexistente
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPrefs((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Cookie className="h-3.5 w-3.5 text-[#38BDF8]" />
            {showPrefs ? "Ocultar Detalhes" : "Preferências"}
          </button>
          <button
            type="button"
            onClick={handleAcceptEssential}
            className="rounded-lg bg-[#0284C7] hover:bg-[#0369A1] px-4 py-2 text-xs font-semibold text-white shadow"
          >
            Entendi e Concordo
          </button>
        </div>
      </div>
    </aside>
  );
}
