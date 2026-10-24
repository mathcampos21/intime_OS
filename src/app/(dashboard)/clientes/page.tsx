"use client";

import React, { useEffect, useState } from "react";
import { Users, Search, Sparkles, MapPin, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

interface CustomerRow {
  id: number;
  isLegalEntity: boolean;
  name: string;
  tradeName?: string | null;
  document: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  contactPerson?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  _count?: {
    equipments: number;
    serviceOrders: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    isLegalEntity: true,
    document: "",
    name: "",
    tradeName: "",
    email: "",
    phone: "",
    mobile: "",
    contactPerson: "",
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    notes: "",
  });

  const loadCustomers = async (q = "") => {
    const res = await fetch(
      `/api/v1/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`
    );
    if (res.ok) {
      const json = await res.json();
      setCustomers(json.data || []);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const handleLookupCnpj = async () => {
    const clean = form.document.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos para consultar na BrasilAPI.");
      return;
    }
    setLoadingLookup(true);
    try {
      const res = await fetch(`/api/v1/lookup?cnpj=${clean}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const d = json.data;
      setForm((prev) => ({
        ...prev,
        isLegalEntity: true,
        document: d.cnpj || prev.document,
        name: d.legalName || prev.name,
        tradeName: d.tradeName || prev.tradeName,
        email: d.email || prev.email,
        phone: d.phone || prev.phone,
        zipCode: d.zipCode || prev.zipCode,
        street: d.street || prev.street,
        number: d.number || prev.number,
        complement: d.complement || prev.complement,
        neighborhood: d.neighborhood || prev.neighborhood,
        city: d.city || prev.city,
        state: d.state || prev.state,
      }));
      toast.success(`Dados de ${d.legalName} preenchidos via BrasilAPI!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na BrasilAPI.");
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleLookupCep = async () => {
    const clean = form.zipCode.replace(/\D/g, "");
    if (clean.length !== 8) {
      toast.error("Informe um CEP com 8 dígitos para consultar no ViaCEP.");
      return;
    }
    setLoadingLookup(true);
    try {
      const res = await fetch(`/api/v1/lookup?cep=${clean}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const d = json.data;
      setForm((prev) => ({
        ...prev,
        zipCode: d.zipCode || prev.zipCode,
        street: d.street || prev.street,
        neighborhood: d.neighborhood || prev.neighborhood,
        city: d.city || prev.city,
        state: d.state || prev.state,
      }));
      toast.success(`Endereço localizado via ViaCEP (${d.city}/${d.state})!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao buscar CEP.");
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success("Cliente cadastrado com sucesso!");
      setShowForm(false);
      setForm({
        isLegalEntity: true,
        document: "",
        name: "",
        tradeName: "",
        email: "",
        phone: "",
        mobile: "",
        contactPerson: "",
        zipCode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        notes: "",
      });
      void loadCustomers(search);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar cliente.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Users className="h-6 w-6 text-[#0284C7] dark:text-[#38BDF8]" />
            Módulo de Clientes (Automação Custo Zero BrasilAPI & ViaCEP)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cadastro completo PF/PJ, contatos técnicos e busca automática gratuita por CNPJ e CEP
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Fechar Formulário" : "Novo Cliente PF / PJ"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSaveCustomer}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 shadow-md space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
              Cadastro de Cliente (Finalidade Contratual LGPD Art. 7º, V)
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isLegalEntity: true }))}
                className={`px-3 py-1 rounded-md font-semibold ${
                  form.isLegalEntity
                    ? "bg-[#0284C7] text-white"
                    : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                Pessoa Jurídica (CNPJ)
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isLegalEntity: false }))}
                className={`px-3 py-1 rounded-md font-semibold ${
                  !form.isLegalEntity
                    ? "bg-[#0284C7] text-white"
                    : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                Pessoa Física (CPF)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                {form.isLegalEntity ? "CNPJ *" : "CPF *"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={form.document}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, document: e.target.value }))
                  }
                  placeholder={
                    form.isLegalEntity ? "00.000.000/0001-00" : "000.000.000-00"
                  }
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
                />
                {form.isLegalEntity && (
                  <button
                    type="button"
                    disabled={loadingLookup}
                    onClick={handleLookupCnpj}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-3 py-2 text-xs font-bold shrink-0"
                    title="Buscar CNPJ automaticamente na BrasilAPI"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    BrasilAPI
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                {form.isLegalEntity ? "Razão Social *" : "Nome Completo *"}
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
              <label className="block text-xs font-semibold mb-1">
                Nome Fantasia / Responsável Técnico
              </label>
              <input
                type="text"
                value={form.tradeName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tradeName: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Telefone Fixo / Celular
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Pessoa de Contato no Cliente
              </label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPerson: e.target.value }))
                }
                placeholder="Ex: Gestor de TI / Financeiro"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            {/* Bloco ViaCEP */}
            <div>
              <label className="block text-xs font-semibold mb-1">
                CEP (Busca Automática ViaCEP)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.zipCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, zipCode: e.target.value }))
                  }
                  placeholder="00000-000"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={loadingLookup}
                  onClick={handleLookupCep}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0F172A] dark:bg-slate-700 text-white px-3 py-2 text-xs font-bold shrink-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                  ViaCEP
                </button>
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Logradouro / Rua
                </label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, street: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Número</label>
                <input
                  type="text"
                  value={form.number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, number: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Bairro</label>
              <input
                type="text"
                value={form.neighborhood}
                onChange={(e) =>
                  setForm((f) => ({ ...f, neighborhood: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Cidade</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">UF</label>
              <input
                type="text"
                maxLength={2}
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-5 py-2 text-xs font-bold shadow"
            >
              Salvar Cliente
            </button>
          </div>
        </form>
      )}

      {/* Barra de Busca + Listagem */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                void loadCustomers(e.target.value);
              }}
              placeholder="Pesquisar cliente por Razão Social, Nome, CPF/CNPJ ou Cidade..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] pl-10 pr-4 py-2 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2">ID</th>
                <th className="py-2.5 px-2">Cliente / Razão Social</th>
                <th className="py-2.5 px-2">CPF / CNPJ</th>
                <th className="py-2.5 px-2">Telefone / Contato</th>
                <th className="py-2.5 px-2">Cidade / UF</th>
                <th className="py-2.5 px-2">Equipamentos / OS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="py-2.5 px-2 font-bold text-[#0284C7] dark:text-[#38BDF8]">
                    #{c.id}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="font-semibold">{c.name}</div>
                    {c.tradeName && (
                      <div className="text-[11px] text-slate-400">
                        {c.tradeName}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 font-mono">{c.document}</td>
                  <td className="py-2.5 px-2">
                    {c.phone || c.mobile || "-"}
                    {c.contactPerson ? ` (${c.contactPerson})` : ""}
                  </td>
                  <td className="py-2.5 px-2">
                    {[c.city, c.state].filter(Boolean).join("/") || "-"}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-[#0284C7] dark:text-[#38BDF8]">
                      {c._count?.equipments ?? 0} Equip. •{" "}
                      {c._count?.serviceOrders ?? 0} OS
                    </span>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
