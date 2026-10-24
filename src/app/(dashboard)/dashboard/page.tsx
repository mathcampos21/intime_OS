"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  HardDrive,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  QrCode,
  ArrowRight,
  DatabaseBackup,
} from "lucide-react";
import { STATUS_DESIGN_TOKENS } from "@/config/company";
import { QrBarcodeScannerButton } from "@/components/mobile/qr-barcode-scanner";

interface DashboardOrder {
  id: number;
  status: keyof typeof STATUS_DESIGN_TOKENS.serviceOrder;
  reportedDefect: string;
  startDate: string;
  totalAmount: number;
  customer: { name: string };
  technician: { name: string };
}

interface DashboardEquipment {
  id: number;
  name: string;
  qrCodeToken: string;
  status: keyof typeof STATUS_DESIGN_TOKENS.equipment;
  lastInspectedAt?: string | null;
  customer: { name: string };
}

export default function OperationalDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [equipments, setEquipments] = useState<DashboardEquipment[]>([]);
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/service-orders").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/v1/equipments").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/v1/customers").then((r) => (r.ok ? r.json() : { data: [] })),
    ]).then(([osRes, eqRes, custRes]) => {
      setOrders(osRes.data || []);
      setEquipments(eqRes.data || []);
      setCustomersCount((custRes.data || []).length);
    });
  }, []);

  const openAndInProgress = orders.filter(
    (o) =>
      o.status === "ABERTA" ||
      o.status === "EM_ANDAMENTO" ||
      o.status === "ORCAMENTO"
  ).length;
  const waitingParts = orders.filter(
    (o) => o.status === "AGUARDANDO_PECAS"
  ).length;
  const finishedOrders = orders.filter((o) => o.status === "FINALIZADA").length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Atalhos Rápidos + Scanner QR Mobile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Dashboard Operacional InTime Technology
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controle em tempo real de Ordens de Serviço, Laudos Técnicos e Inventário de Equipamentos com Fotos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <QrBarcodeScannerButton
            onCodeScanned={(code) =>
              router.push(`/equipamentos?qr=${encodeURIComponent(code)}`)
            }
          />
          <Link
            href="/ordens-de-servico?nova=1"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            Nova Ordem de Serviço
          </Link>
        </div>
      </div>

      {/* Cards de Indicadores (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              OS em Atendimento / Fila
            </span>
            <Clock className="h-5 w-5 text-[#F59E0B]" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-[#0284C7] dark:text-[#38BDF8]">
            {openAndInProgress}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Abertas, Orçamentos e Em Andamento
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aguardando Peças / Aprovação
            </span>
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-orange-500">
            {waitingParts}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ordens pendentes de retorno ou peça
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              OS Finalizadas / Concluídas
            </span>
            <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-[#10B981]">
            {finishedOrders}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Com Laudo Técnico disponível em PDF
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Equipamentos & Clientes
            </span>
            <HardDrive className="h-5 w-5 text-[#38BDF8]" />
          </div>
          <div className="mt-3 text-3xl font-extrabold">
            {equipments.length}{" "}
            <span className="text-sm font-medium text-slate-400">
              / {customersCount} clientes
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Monitorados com QR Code de Patrimônio
          </p>
        </div>
      </div>

      {/* Duas Colunas: Últimas Ordens de Serviço + Últimos Equipamentos Inspecionados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 e 2: Ordens de Serviço Recentes */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
              Últimas Ordens de Serviço e Atendimentos
            </h2>
            <Link
              href="/ordens-de-servico"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8] hover:underline"
            >
              Ver todas as OS <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-2">Nº OS</th>
                  <th className="py-2.5 px-2">Cliente</th>
                  <th className="py-2.5 px-2">Solicitação / Defeito</th>
                  <th className="py-2.5 px-2">Técnico</th>
                  <th className="py-2.5 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {orders.slice(0, 8).map((os) => {
                  const token =
                    STATUS_DESIGN_TOKENS.serviceOrder[os.status] ||
                    STATUS_DESIGN_TOKENS.serviceOrder.ABERTA;
                  return (
                    <tr
                      key={os.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2.5 px-2 font-bold text-[#0284C7] dark:text-[#38BDF8]">
                        #{os.id}
                      </td>
                      <td className="py-2.5 px-2 font-medium">
                        {os.customer?.name}
                      </td>
                      <td className="py-2.5 px-2 max-w-xs truncate text-slate-600 dark:text-slate-300">
                        {os.reportedDefect}
                      </td>
                      <td className="py-2.5 px-2">{os.technician?.name}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${token.badgeClass}`}
                        >
                          {token.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Nenhuma Ordem de Serviço registrada ainda. Você pode criar uma nova OS ou importar seu banco do{" "}
                      <Link
                        href="/configuracoes/migracao-mapos"
                        className="text-[#0284C7] dark:text-[#38BDF8] underline font-semibold"
                      >
                        MapOS Legado
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Coluna 3: Últimos Equipamentos Inspecionados & Atalhos */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
              Últimos Equipamentos
            </h2>
            <Link
              href="/equipamentos"
              className="text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8] hover:underline"
            >
              Inventário
            </Link>
          </div>

          <div className="space-y-2.5">
            {equipments.slice(0, 5).map((eq) => {
              const eqToken =
                STATUS_DESIGN_TOKENS.equipment[eq.status] ||
                STATUS_DESIGN_TOKENS.equipment.OPERACIONAL;
              return (
                <div
                  key={eq.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/70 dark:bg-[#0F172A]/60 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{eq.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {eq.customer?.name} • {eq.qrCodeToken}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${eqToken.badgeClass}`}
                  >
                    {eqToken.label}
                  </span>
                </div>
              );
            })}
            {equipments.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                Nenhum equipamento cadastrado no inventário.
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 grid grid-cols-2 gap-2">
            <Link
              href="/clientes"
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Users className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
              Novo Cliente
            </Link>
            <Link
              href="/configuracoes/backup"
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <DatabaseBackup className="h-4 w-4 text-[#10B981]" />
              Backup 1-Clique
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
