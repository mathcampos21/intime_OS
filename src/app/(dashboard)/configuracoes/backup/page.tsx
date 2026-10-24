"use client";

import React, { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  RotateCcw,
  ShieldCheck,
  Clock,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

interface BackupItem {
  id: number;
  fileName: string;
  fileSize: number;
  sha256Hash: string;
  type: string;
  notes?: string | null;
  createdAt: string;
  createdBy?: { name: string } | null;
}

export default function BackupAndRestorePage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [expectedHash, setExpectedHash] = useState("");

  const loadBackups = async () => {
    const res = await fetch("/api/v1/backup");
    if (res.ok) {
      const json = await res.json();
      setBackups(json.data || []);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(
        `Backup ${json.data.fileName} gerado com hash SHA-256 verificado!`
      );
      void loadBackups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar backup.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLocal = async (b: BackupItem) => {
    if (
      !window.confirm(
        `Confirma a restauração transacional do pacote ${b.fileName}?\nO hash SHA-256 (${b.sha256Hash.slice(
          0,
          16
        )}...) será validado antes de substituir os dados.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_local", backupId: b.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(json.message);
      void loadBackups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na restauração.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Selecione o arquivo .zip de backup.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("backupZip", uploadFile);
      if (expectedHash.trim()) {
        fd.append("expectedSha256", expectedHash.trim());
      }

      const res = await fetch("/api/v1/backup", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(json.message);
      setUploadFile(null);
      setExpectedHash("");
      void loadBackups();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao restaurar arquivo enviado."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <DatabaseBackup className="h-6 w-6 text-[#0284C7] dark:text-[#38BDF8]" />
            Módulo de Backup & Restauração 1-Clique (Exclusivo ADMIN)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pacote único compactado (.zip) contendo Dump PostgreSQL + Fotos de `/app/uploads` + Manifesto `metadata.json` com Hash SHA-256
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleCreateBackup}
          className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-3 text-sm font-bold shadow-lg transition"
        >
          <DatabaseBackup className="h-4 w-4" />
          {loading
            ? "Processando Pacote..."
            : "Gerar Backup Completo Agora (1-Clique)"}
        </button>
      </div>

      {/* Cards de Status do Agendamento Cron & Upload de Restauração */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0284C7] dark:text-[#38BDF8]">
            <Clock className="h-4 w-4" />
            <span>Agendamento Automático Diário (Cron) & Retenção</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            O motor de backup da <strong>InTime Technology</strong> executa
            automaticamente todos os dias às <strong>03:00 AM</strong>{" "}
            (fuso `America/Sao_Paulo`), salvando os pacotes no volume Docker
            persistente <code>/app/backups</code> (`intime_backups`) e mantendo
            os últimos <strong>10 backups</strong> íntegros.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold pt-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Verificação Criptográfica SHA-256 Ativa em 100% dos Pacotes</span>
          </div>
        </div>

        <form
          onSubmit={handleRestoreUpload}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Upload className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
            <span>Restauração Externa via Upload de Pacote (.zip)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[#0284C7] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            <input
              type="text"
              value={expectedHash}
              onChange={(e) => setExpectedHash(e.target.value)}
              placeholder="Hash SHA-256 esperado (Opcional)"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-1.5 text-xs font-mono"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !uploadFile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 text-white px-4 py-2 text-xs font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Validar SHA-256 & Restaurar Sistema
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Backups Armazenados no Volume /app/backups */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-2">Data / Hora</th>
              <th className="py-2.5 px-2">Arquivo (.zip)</th>
              <th className="py-2.5 px-2">Tipo</th>
              <th className="py-2.5 px-2">Tamanho</th>
              <th className="py-2.5 px-2">Hash de Integridade SHA-256</th>
              <th className="py-2.5 px-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {backups.map((b) => (
              <tr key={b.id}>
                <td className="py-2.5 px-2 whitespace-nowrap">
                  {new Date(b.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 px-2 font-mono font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                  {b.fileName}
                </td>
                <td className="py-2.5 px-2">
                  <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold">
                    {b.type}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  {(b.fileSize / 1024).toFixed(1)} KB
                </td>
                <td
                  className="py-2.5 px-2 font-mono text-[11px] text-slate-400 max-w-xs truncate"
                  title={b.sha256Hash}
                >
                  {b.sha256Hash}
                </td>
                <td className="py-2.5 px-2 text-right space-x-2 whitespace-nowrap">
                  <a
                    href={`/api/v1/backup?download=${encodeURIComponent(
                      b.fileName
                    )}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-2.5 py-1.5 text-[11px] font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar .ZIP
                  </a>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleRestoreLocal(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-2.5 py-1.5 text-[11px] font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar
                  </button>
                </td>
              </tr>
            ))}
            {backups.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Nenhum backup gerado ainda. Clique em &ldquo;Gerar Backup Completo Agora (1-Clique)&rdquo; acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
