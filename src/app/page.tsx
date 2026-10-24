"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@intimetechnology.com.br");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Falha na autenticação.");
      }

      toast.success(`Bem-vindo(a), ${json.user.name}!`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-[#0F172A] text-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#1E293B] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src={DEFAULT_COMPANY_CONFIG.logoUrl}
            alt="Logotipo Oficial da InTime Technology"
            className="h-14 w-auto bg-white/95 rounded-xl px-4 py-1.5 shadow"
          />
          <h1 className="text-xl font-bold tracking-tight text-white pt-2">
            Plataforma de OS, Laudos & Inventário
          </h1>
          <p className="text-xs text-slate-400">
            {DEFAULT_COMPANY_CONFIG.legalName} — CNPJ {DEFAULT_COMPANY_CONFIG.cnpj}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@intimetechnology.com.br"
                className="w-full rounded-xl border border-slate-700 bg-[#0F172A] pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#38BDF8]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-700 bg-[#0F172A] pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#38BDF8]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 py-3 text-sm font-bold text-white shadow-lg transition"
          >
            <span>{loading ? "Autenticando..." : "Acessar Painel Técnico"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="border-t border-slate-800 pt-4 flex flex-col items-center gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Acesso Protegido por JWT HTTP-Only & Auditoria LGPD</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/politica-de-privacidade"
              className="hover:text-[#38BDF8] underline"
            >
              Política de Privacidade
            </Link>
            <span>•</span>
            <Link href="/termos-de-uso" className="hover:text-[#38BDF8] underline">
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
