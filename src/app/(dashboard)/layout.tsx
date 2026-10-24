"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  ClipboardList,
  HardDrive,
  Users,
  UserCheck,
  DatabaseBackup,
  ArrowLeftRight,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";
import { ConfidentialityTermsModal } from "@/components/lgpd/confidentiality-terms-modal";

interface AuthUser {
  userId: number;
  name: string;
  email: string;
  role: "ADMIN" | "TECNICO_INTERNO" | "TECNICO_CAMPO";
  requiresTermsAcceptance: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => null);
  }, []);

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard Operacional",
      icon: LayoutDashboard,
      roles: ["ADMIN", "TECNICO_INTERNO", "TECNICO_CAMPO"],
    },
    {
      href: "/ordens-de-servico",
      label: "Ordens de Serviço & Laudos",
      icon: ClipboardList,
      roles: ["ADMIN", "TECNICO_INTERNO", "TECNICO_CAMPO"],
    },
    {
      href: "/equipamentos",
      label: "Equipamentos & QR Code",
      icon: HardDrive,
      roles: ["ADMIN", "TECNICO_INTERNO", "TECNICO_CAMPO"],
    },
    {
      href: "/clientes",
      label: "Clientes (BrasilAPI/CEP)",
      icon: Users,
      roles: ["ADMIN", "TECNICO_INTERNO", "TECNICO_CAMPO"],
    },
    {
      href: "/funcionarios",
      label: "Equipe Técnica & RBAC",
      icon: UserCheck,
      roles: ["ADMIN", "TECNICO_INTERNO"],
    },
    {
      href: "/configuracoes/backup",
      label: "Backup & Restauração",
      icon: DatabaseBackup,
      roles: ["ADMIN"],
    },
    {
      href: "/configuracoes/migracao-mapos",
      label: "Migração MapOS Legado",
      icon: ArrowLeftRight,
      roles: ["ADMIN"],
    },
  ];

  const handleLogout = async () => {
    await fetch("/api/v1/auth", { method: "DELETE" });
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100">
      {/* Modal Obrigatório LGPD no Primeiro Login do Colaborador */}
      {user && (
        <ConfidentialityTermsModal
          open={user.requiresTermsAcceptance}
          userName={user.name}
          onAccepted={() =>
            setUser((prev) =>
              prev ? { ...prev, requiresTermsAcceptance: false } : null
            )
          }
        />
      )}

      {/* Barra Superior Mobile */}
      <header className="lg:hidden flex items-center justify-between border-b border-slate-800 bg-[#0F172A] px-4 py-3 text-white no-print">
        <div className="flex items-center gap-2.5">
          <img
            src={DEFAULT_COMPANY_CONFIG.faviconUrl}
            alt="Ícone InTime Technology"
            className="h-8 w-8 rounded-lg"
          />
          <div>
            <span className="font-bold text-sm tracking-tight">
              In<span className="text-[#38BDF8]">Time</span> OS
            </span>
            <span className="block text-[10px] text-slate-400">
              CNPJ {DEFAULT_COMPANY_CONFIG.cnpj}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"
          aria-label="Abrir menu de navegação"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Menu Lateral (Deep Tech Navy #0F172A) */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } lg:flex lg:flex-col w-full lg:w-68 shrink-0 bg-[#0F172A] text-slate-100 border-r border-slate-800/80 justify-between no-print`}
        aria-label="Navegação Principal InTime Technology"
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center gap-3">
            <img
              src={DEFAULT_COMPANY_CONFIG.logoUrl}
              alt="Logotipo InTime Technology"
              className="h-11 w-auto bg-white rounded-xl px-3 py-1"
            />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              if (user && !item.roles.includes(user.role)) return null;
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-[#0284C7] text-white shadow-md shadow-[#0284C7]/25"
                      : "text-slate-300 hover:bg-[#1E293B] hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-white" : "text-[#38BDF8]"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-3">
          {user && (
            <div className="rounded-xl bg-[#1E293B] p-3 text-xs space-y-1">
              <div className="font-bold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#0284C7]/25 px-2 py-0.5 text-[10px] font-bold text-[#38BDF8]">
                <ShieldCheck className="h-3 w-3" /> {user.role}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#1E293B] py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              aria-label="Alternar tema Claro ou Escuro"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" /> Modo Claro
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-[#38BDF8]" /> Modo Escuro
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 px-3 py-2 text-xs font-semibold text-red-400"
              aria-label="Sair do sistema"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="flex-1 min-w-0 p-4 md:p-7 overflow-y-auto">{children}</main>
    </div>
  );
}
