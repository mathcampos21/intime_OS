"use client";

import React, { useEffect, useState } from "react";
import {
  ClipboardList,
  Plus,
  FileDown,
  Search,
  Edit3,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_DESIGN_TOKENS } from "@/config/company";
import {
  NativeCameraWebp,
  type CapturedPhotoItem,
} from "@/components/mobile/native-camera-webp";
import { SignatureTouchCanvas } from "@/components/mobile/signature-touch-canvas";
import {
  generateServiceOrderPdf,
  type PrintableServiceOrderData,
} from "@/modules/service-orders/pdf-generator";

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<PrintableServiceOrderData[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>(
    []
  );
  const [employees, setEmployees] = useState<Array<{ id: number; name: string }>>(
    []
  );
  const [equipments, setEquipments] = useState<
    Array<{ id: number; customerId: number; name: string; qrCodeToken: string }>
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    id: undefined as number | undefined,
    customerId: 0,
    technicianId: 0,
    status:
      "ABERTA" as keyof typeof STATUS_DESIGN_TOKENS.serviceOrder,
    priority: "NORMAL" as "BAIXA" | "NORMAL" | "ALTA" | "CRITICA",
    warrantyDays: 90,
    reportedDefect: "",
    technicalDiagnosis: "",
    technicalReport: "",
    recommendations: "",
    observations: "",
    equipmentIds: [] as number[],
    services: [
      { description: "Atendimento e Diagnóstico Técnico", quantity: 1, unitPrice: 150 },
    ],
    products: [] as Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>,
    discountAmount: 0,
    customerSignerName: "",
    customerSignerDoc: "",
  });

  const [photos, setPhotos] = useState<CapturedPhotoItem[]>([]);
  const [techSigBase64, setTechSigBase64] = useState<string | null>(null);
  const [custSigBase64, setCustSigBase64] = useState<string | null>(null);

  const loadOrders = async (q = search, st = statusFilter) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (st && st !== "TODOS") params.set("status", st);

    const res = await fetch(`/api/v1/service-orders?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setOrders(json.data || []);
    }
  };

  useEffect(() => {
    void loadOrders();
    Promise.all([
      fetch("/api/v1/customers").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/v1/employees").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/v1/equipments").then((r) => (r.ok ? r.json() : { data: [] })),
    ]).then(([cRes, eRes, eqRes]) => {
      const cList = cRes.data || [];
      const eList = eRes.data || [];
      setCustomers(cList);
      setEmployees(eList);
      setEquipments(eqRes.data || []);
      setForm((f) => ({
        ...f,
        customerId: cList[0]?.id || 0,
        technicianId: eList[0]?.id || 0,
      }));
    });

    if (typeof window !== "undefined") {
      if (new URLSearchParams(window.location.search).get("nova") === "1") {
        setShowForm(true);
      }
    }
  }, []);

  const customerEquipments = equipments.filter(
    (eq) => eq.customerId === Number(form.customerId)
  );

  const handleEditOrder = (os: PrintableServiceOrderData) => {
    setForm({
      id: os.id,
      customerId:
        customers.find((c) => c.name === os.customer.name)?.id ||
        customers[0]?.id ||
        0,
      technicianId:
        employees.find((e) => e.name === os.technician.name)?.id ||
        employees[0]?.id ||
        0,
      status:
        (os.status as keyof typeof STATUS_DESIGN_TOKENS.serviceOrder) ||
        "ABERTA",
      priority:
        (os.priority as "BAIXA" | "NORMAL" | "ALTA" | "CRITICA") || "NORMAL",
      warrantyDays: os.warrantyDays ?? 90,
      reportedDefect: os.reportedDefect || "",
      technicalDiagnosis: os.technicalDiagnosis || "",
      technicalReport: os.technicalReport || "",
      recommendations: os.recommendations || "",
      observations: os.observations || "",
      equipmentIds: [],
      services:
        os.serviceItems.length > 0
          ? os.serviceItems.map((s) => ({
              description: s.description,
              quantity: Number(s.quantity),
              unitPrice: Number(s.unitPrice),
            }))
          : [],
      products: os.productItems.map((p) => ({
        description: p.description,
        quantity: Number(p.quantity),
        unitPrice: Number(p.unitPrice),
      })),
      discountAmount: Number(os.discountAmount || 0),
      customerSignerName: os.customerSignerName || os.customer.name,
      customerSignerDoc: os.customerSignerDoc || os.customer.document,
    });
    setPhotos([]);
    setShowForm(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/service-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId: Number(form.customerId),
          technicianId: Number(form.technicianId),
          photos: photos.map((p) => ({
            base64: p.base64,
            stage: p.stage,
            caption: p.caption,
          })),
          technicianSignatureBase64: techSigBase64,
          customerSignatureBase64: custSigBase64,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(
        `OS #${json.data.id} e Laudo Técnico gravados com sucesso!`
      );
      setShowForm(false);
      setPhotos([]);
      setTechSigBase64(null);
      setCustSigBase64(null);
      void loadOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar OS.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[#0284C7] dark:text-[#38BDF8]" />
            Módulo de Ordens de Serviço (OS) & Laudo Técnico com Fotos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vínculo de equipamentos, fotos Antes/Durante/Depois em WebP, assinatura digital Touch Canvas e emissão de PDF com cláusulas LGPD
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm((f) => ({ ...f, id: undefined }));
            setShowForm((v) => !v);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Fechar Editor de OS" : "Abrir Nova Ordem de Serviço"}
        </button>
      </div>

      {/* Formulário Completo de OS + Laudo Técnico + Câmera + Assinaturas */}
      {showForm && (
        <form
          onSubmit={handleSaveOrder}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-lg font-extrabold text-[#0284C7] dark:text-[#38BDF8]">
              {form.id
                ? `Editando Ordem de Serviço #${form.id} & Laudo Técnico`
                : "Nova Ordem de Serviço & Laudo Técnico"}
            </h2>
            <span className="text-xs text-slate-400">
              InTime Technology • CNPJ 10.742.889/0001-36
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Cliente *
              </label>
              <select
                required
                value={form.customerId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    customerId: Number(e.target.value),
                    equipmentIds: [],
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              >
                <option value={0}>Selecione o cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Técnico Responsável *
              </label>
              <select
                required
                value={form.technicianId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    technicianId: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Status da OS *
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target
                      .value as keyof typeof STATUS_DESIGN_TOKENS.serviceOrder,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              >
                <option value="ORCAMENTO">Orçamento</option>
                <option value="ABERTA">Aberta</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="AGUARDANDO_PECAS">
                  Aguardando Peças/Aprovação
                </option>
                <option value="FINALIZADA">Finalizada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
          </div>

          {/* Seleção de 1 ou mais Equipamentos do Cliente */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#0F172A]/60 p-4 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Equipamentos do Cliente Vinculados a esta OS:
            </label>
            <div className="flex flex-wrap gap-2">
              {customerEquipments.map((eq) => {
                const selected = form.equipmentIds.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        equipmentIds: selected
                          ? f.equipmentIds.filter((id) => id !== eq.id)
                          : [...f.equipmentIds, eq.id],
                      }))
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? "border-[#0284C7] bg-[#0284C7] text-white"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B]"
                    }`}
                  >
                    {eq.name} ({eq.qrCodeToken})
                  </button>
                );
              })}
              {customerEquipments.length === 0 && (
                <span className="text-xs text-slate-400">
                  Este cliente ainda não possui equipamentos cadastrados no inventário.
                </span>
              )}
            </div>
          </div>

          {/* Seções do Laudo Técnico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                1. Defeito / Solicitação Relatada pelo Cliente *
              </label>
              <textarea
                rows={3}
                required
                value={form.reportedDefect}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reportedDefect: e.target.value }))
                }
                placeholder="Descreva o problema relatado na abertura da OS..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                2. Diagnóstico / Inspeção Técnica
              </label>
              <textarea
                rows={3}
                value={form.technicalDiagnosis}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technicalDiagnosis: e.target.value }))
                }
                placeholder="Resultado dos testes de hardware, tensões, logs e causa raiz..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                3. Laudo Técnico (Serviços e Procedimentos Realizados)
              </label>
              <textarea
                rows={3}
                value={form.technicalReport}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technicalReport: e.target.value }))
                }
                placeholder="Detalhe os reparos, substituições de componentes e validações efetuadas..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                4. Recomendações Técnicas & Garantia (Dias)
              </label>
              <textarea
                rows={3}
                value={form.recommendations}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recommendations: e.target.value }))
                }
                placeholder="Recomendações preventivas de infraestrutura/energia ao cliente..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Câmera Integrada: Fotos Antes / Durante / Depois */}
          <div className="space-y-3">
            <NativeCameraWebp
              serviceOrderId={form.id}
              defaultStage="ANTES"
              showStageSelector={true}
              onPhotoCaptured={(p) => setPhotos((prev) => [...prev, p])}
            />

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((p, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-[#0F172A]"
                  >
                    <img
                      src={p.base64}
                      alt={p.altText}
                      className="h-24 w-full object-cover"
                    />
                    <div className="p-2 text-[11px] flex items-center justify-between">
                      <span className="font-bold text-[#0284C7] dark:text-[#38BDF8]">
                        [{p.stage}] {p.caption}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-red-500"
                        aria-label="Remover foto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quadros de Assinatura Digital na Tela (Técnico e Cliente) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SignatureTouchCanvas
              label="Assinatura Digital do Técnico Responsável"
              signerSubtitle="Confirma a veracidade do diagnóstico e procedimentos técnicos"
              onSignatureConfirm={(url) => setTechSigBase64(url)}
            />

            <div className="space-y-2">
              <SignatureTouchCanvas
                label="Assinatura Digital do Cliente (Recebimento / Aprovação)"
                signerSubtitle="Coleta na tela do celular Android ou tablet em campo"
                onSignatureConfirm={(url) => setCustSigBase64(url)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.customerSignerName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customerSignerName: e.target.value,
                    }))
                  }
                  placeholder="Nome legível do recebedor no cliente"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={form.customerSignerDoc}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customerSignerDoc: e.target.value,
                    }))
                  }
                  placeholder="CPF/RG do recebedor"
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-6 py-2.5 text-xs font-bold shadow-lg"
            >
              Salvar Ordem de Serviço & Laudo Técnico
            </button>
          </div>
        </form>
      )}

      {/* Filtros + Tabela de OS */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                void loadOrders(e.target.value, statusFilter);
              }}
              placeholder="Pesquisar por Nº da OS (ex: 1450), Cliente, Defeito ou Laudo..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] pl-10 pr-4 py-2 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              void loadOrders(search, e.target.value);
            }}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-3 py-2 text-xs font-semibold"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ORCAMENTO">Orçamento</option>
            <option value="ABERTA">Aberta</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="AGUARDANDO_PECAS">Aguardando Peças/Aprovação</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2">Nº OS</th>
                <th className="py-2.5 px-2">Abertura</th>
                <th className="py-2.5 px-2">Cliente</th>
                <th className="py-2.5 px-2">Defeito / Laudo</th>
                <th className="py-2.5 px-2">Técnico</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2 text-right">Ações / PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {orders.map((os) => {
                const token =
                  STATUS_DESIGN_TOKENS.serviceOrder[
                    os.status as keyof typeof STATUS_DESIGN_TOKENS.serviceOrder
                  ] || STATUS_DESIGN_TOKENS.serviceOrder.ABERTA;
                return (
                  <tr
                    key={os.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-2 font-extrabold text-[#0284C7] dark:text-[#38BDF8]">
                      #{os.id}
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {new Date(os.startDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2.5 px-2 font-semibold">
                      {os.customer?.name}
                    </td>
                    <td className="py-2.5 px-2 max-w-xs truncate">
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
                    <td className="py-2.5 px-2 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEditOrder(os)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2.5 py-1.5 text-[11px] font-semibold"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar / Laudo
                      </button>
                      <button
                        type="button"
                        onClick={() => generateServiceOrderPdf(os)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-2.5 py-1.5 text-[11px] font-semibold"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        PDF OS & Laudo
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma Ordem de Serviço encontrada.
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
