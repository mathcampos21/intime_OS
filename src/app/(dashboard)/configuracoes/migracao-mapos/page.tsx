"use client";

import React, { useState } from "react";
import {
  ArrowLeftRight,
  Eye,
  Play,
  CheckCircle2,
  Database,
  FolderArchive,
} from "lucide-react";
import { toast } from "sonner";
import type { MaposDryRunSummary } from "@/modules/mapos-migration/mapos-migrator.service";

export default function MaposMigrationPage() {
  const [sqlFile, setSqlFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<MaposDryRunSummary | null>(
    null
  );
  const [executedSuccess, setExecutedSuccess] = useState(false);

  const handleRunMigration = async (mode: "dry-run" | "execute") => {
    if (!sqlFile) {
      toast.error("Selecione o arquivo .sql exportado pelo MapOS antigo.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("sqlFile", sqlFile);
      fd.append("mode", mode);
      if (zipFile) {
        fd.append("attachmentsZip", zipFile);
      }

      const res = await fetch("/api/v1/mapos-migration", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (mode === "dry-run") {
        setDryRunResult(json.summary);
        setExecutedSuccess(false);
        toast.success(
          "Pré-visualização (Dry-Run) concluída! Confira os registros abaixo antes de confirmar."
        );
      } else {
        setDryRunResult(json.result);
        setExecutedSuccess(true);
        toast.success(
          `Migração do MapOS concluída com sucesso! Próxima OS ajustada para #${json.result.osIdRange.nextSequenceIdOs}.`
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar migração MapOS."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-[#0284C7] dark:text-[#38BDF8]" />
          Módulo de Migração Automática do MapOS Legado (Preservação 100%)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Importação idempotente (`UPSERT`) do arquivo `banco.sql` (MySQL/MariaDB), preservando o número exato de cada OS (`idOs`), criando automaticamente os Equipamentos a partir de `descricaoProduto` e ajustando a sequence (`setval`) do PostgreSQL
        </p>
      </div>

      {/* Painel de Upload (.SQL + .ZIP de Anexos) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 shadow-md space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] p-4 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-[#0284C7] dark:text-[#38BDF8]">
              <Database className="h-4 w-4" />
              1. Arquivo de Dump `.sql` do MapOS Legado (Obrigatório)
            </label>
            <input
              type="file"
              accept=".sql,.txt"
              onChange={(e) => setSqlFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#0284C7] file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-white"
            />
            <p className="text-[11px] text-slate-400">
              Suporta dumps gerados pelo phpMyAdmin, mysqldump ou pelo painel de backup nativo do MapOS.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] p-4 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-[#0284C7] dark:text-[#38BDF8]">
              <FolderArchive className="h-4 w-4" />
              2. Arquivo `.zip` da pasta `assets/anexos` do MapOS (Opcional)
            </label>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-white"
            />
            <p className="text-[11px] text-slate-400">
              Move automaticamente os anexos antigos para o volume persistente `/app/uploads/attachments` mantendo o vínculo com a OS original.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={loading || !sqlFile}
            onClick={() => handleRunMigration("dry-run")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#0284C7] bg-[#0284C7]/10 hover:bg-[#0284C7]/20 disabled:opacity-40 text-[#0284C7] dark:text-[#38BDF8] px-5 py-2.5 text-xs font-bold transition"
          >
            <Eye className="h-4 w-4" />
            1. Analisar e Pré-Visualizar (Dry-Run Seguro)
          </button>

          <button
            type="button"
            disabled={loading || !sqlFile}
            onClick={() => handleRunMigration("execute")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-40 text-white px-6 py-2.5 text-xs font-bold shadow-lg transition"
          >
            <Play className="h-4 w-4" />
            {loading
              ? "Importando Registros..."
              : "2. Confirmar e Executar Migração Completa (UPSERT)"}
          </button>
        </div>
      </div>

      {/* Resultado do Dry-Run / Execução */}
      {dryRunResult && (
        <div className="rounded-2xl border-2 border-[#0284C7] bg-white dark:bg-[#1E293B] p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
                {executedSuccess
                  ? "Relatório Final da Migração Executada no PostgreSQL"
                  : "Resumo da Pré-Visualização (Dry-Run) — Pronta para Importar"}
              </h2>
              <p className="text-xs text-slate-400">
                Continuidade Histórica de OS: Menor ID{" "}
                <strong>#{dryRunResult.osIdRange.minIdOs ?? "-"}</strong> • Maior
                ID <strong>#{dryRunResult.osIdRange.maxIdOs ?? "-"}</strong> •{" "}
                <span className="text-[#38BDF8] font-bold">
                  Próxima OS Nova (setval): #
                  {dryRunResult.osIdRange.nextSequenceIdOs}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Clientes (clientes)", val: dryRunResult.counts.clientes },
              {
                label: "Funcionários (usuarios)",
                val: dryRunResult.counts.usuarios,
              },
              {
                label: "Ordens de Serviço (os)",
                val: dryRunResult.counts.os,
              },
              {
                label: "Equipamentos Auto-Criados",
                val: dryRunResult.counts.equipamentosAutoGerados,
              },
              {
                label: "Serviços & Vínculos",
                val:
                  dryRunResult.counts.servicos +
                  dryRunResult.counts.servicos_os,
              },
              {
                label: "Produtos, Garantias & Anexos",
                val:
                  dryRunResult.counts.produtos +
                  dryRunResult.counts.produtos_os +
                  dryRunResult.counts.garantias +
                  dryRunResult.counts.anexos,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] p-3.5"
              >
                <div className="text-2xl font-extrabold text-[#0284C7] dark:text-[#38BDF8]">
                  {item.val}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Amostra de OS e Equipamentos Extraídos de `descricaoProduto` */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Amostra de Ordens de Serviço e Equipamentos Extraídos de `descricaoProduto`:
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th className="py-2 px-2">ID Original (`idOs`)</th>
                    <th className="py-2 px-2">ID Cliente</th>
                    <th className="py-2 px-2">Status Convertido</th>
                    <th className="py-2 px-2">
                      Equipamento Criado no Novo Inventário
                    </th>
                    <th className="py-2 px-2">Data Abertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800">
                  {dryRunResult.sampleServiceOrders.map((s) => (
                    <tr key={s.idOs}>
                      <td className="py-2 px-2 font-bold text-[#38BDF8]">
                        OS #{s.idOs}
                      </td>
                      <td className="py-2 px-2">Cliente #{s.customerId}</td>
                      <td className="py-2 px-2">{s.status}</td>
                      <td className="py-2 px-2 font-semibold">
                        {s.equipmentExtracted}
                      </td>
                      <td className="py-2 px-2">{s.startDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
