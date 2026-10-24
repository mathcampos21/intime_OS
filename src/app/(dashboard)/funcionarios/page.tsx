"use client";

import React, { useEffect, useState } from "react";
import { UserCheck, Plus, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface EmployeeRow {
  id: number;
  name: string;
  cpf: string;
  jobTitle: string;
  professionalRegistry?: string | null;
  email: string;
  phone?: string | null;
  role: "ADMIN" | "TECNICO_INTERNO" | "TECNICO_CAMPO";
  isActive: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  acceptedTermsVersion?: string | null;
  _count?: { assignedServiceOrders: number };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    rg: "",
    jobTitle: "Técnico de Campo",
    professionalRegistry: "",
    email: "",
    password: "",
    phone: "",
    role: "TECNICO_CAMPO" as "ADMIN" | "TECNICO_INTERNO" | "TECNICO_CAMPO",
  });

  const loadEmployees = async () => {
    const res = await fetch("/api/v1/employees");
    if (res.ok) {
      const json = await res.json();
      setEmployees(json.data || []);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(`Colaborador ${form.name} cadastrado com sucesso!`);
      setShowForm(false);
      setForm({
        name: "",
        cpf: "",
        rg: "",
        jobTitle: "Técnico de Campo",
        professionalRegistry: "",
        email: "",
        password: "",
        phone: "",
        role: "TECNICO_CAMPO",
      });
      void loadEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-[#0284C7] dark:text-[#38BDF8]" />
            Módulo de Funcionários & Equipe Técnica (RBAC)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controle de técnicos de bancada, técnicos de campo (App Android), registros profissionais e aceite LGPD
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Fechar Cadastro" : "Novo Colaborador / Técnico"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 shadow-md grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">CPF *</label>
            <input
              type="text"
              required
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Cargo / Função Técnica *
            </label>
            <input
              type="text"
              required
              value={form.jobTitle}
              onChange={(e) =>
                setForm((f) => ({ ...f, jobTitle: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Registro Profissional (CFT / CREA)
            </label>
            <input
              type="text"
              value={form.professionalRegistry}
              onChange={(e) =>
                setForm((f) => ({ ...f, professionalRegistry: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              E-mail Corporativo *
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Senha Inicial *
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Perfil de Permissão (RBAC) *
            </label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as
                    | "ADMIN"
                    | "TECNICO_INTERNO"
                    | "TECNICO_CAMPO",
                }))
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
            >
              <option value="TECNICO_CAMPO">TECNICO_CAMPO (App Mobile + OS)</option>
              <option value="TECNICO_INTERNO">TECNICO_INTERNO (Bancada + OS)</option>
              <option value="ADMIN">ADMIN (Acesso Total + Backup/Migração)</option>
            </select>
          </div>

          <div className="flex items-end justify-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white py-2.5 text-xs font-bold shadow"
            >
              Cadastrar Colaborador
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-2">ID</th>
              <th className="py-2.5 px-2">Colaborador / Cargo</th>
              <th className="py-2.5 px-2">E-mail / CPF</th>
              <th className="py-2.5 px-2">Perfil RBAC</th>
              <th className="py-2.5 px-2">Termo LGPD / Último IP</th>
              <th className="py-2.5 px-2">OS Atendidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="py-2.5 px-2 font-bold text-[#0284C7] dark:text-[#38BDF8]">
                  #{emp.id}
                </td>
                <td className="py-2.5 px-2">
                  <div className="font-semibold">{emp.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {emp.jobTitle}{" "}
                    {emp.professionalRegistry
                      ? `• ${emp.professionalRegistry}`
                      : ""}
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <div>{emp.email}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {emp.cpf}
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#0284C7]/15 px-2 py-0.5 text-[11px] font-bold text-[#0284C7] dark:text-[#38BDF8]">
                    <ShieldCheck className="h-3 w-3" /> {emp.role}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  {emp.acceptedTermsVersion ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                      {emp.acceptedTermsVersion}
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium">
                      Pendente 1º Login
                    </span>
                  )}
                  {emp.lastLoginIp && (
                    <div className="text-[10px] text-slate-400">
                      IP: {emp.lastLoginIp}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2 font-bold">
                  {emp._count?.assignedServiceOrders ?? 0} OS
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
