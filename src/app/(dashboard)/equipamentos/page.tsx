"use client";

import React, { useEffect, useState } from "react";
import {
  HardDrive,
  Plus,
  QrCode,
  Search,
  History,
  Printer,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_DESIGN_TOKENS } from "@/config/company";
import {
  NativeCameraWebp,
  type CapturedPhotoItem,
} from "@/components/mobile/native-camera-webp";
import { QrBarcodeScannerButton } from "@/components/mobile/qr-barcode-scanner";
import { generateEquipmentQrLabelPdf } from "@/modules/service-orders/pdf-generator";

interface EquipmentRecord {
  id: number;
  qrCodeToken: string;
  customerId: number;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  physicalLocation?: string | null;
  technicalSpecs?: string | null;
  notes?: string | null;
  status: keyof typeof STATUS_DESIGN_TOKENS.equipment;
  customer: { id: number; name: string; document: string };
  photos: Array<{
    id: number;
    fileUrl: string;
    caption?: string | null;
    altText: string;
    takenAt: string;
  }>;
  serviceOrderLinks: Array<{
    id: number;
    specificDefect?: string | null;
    specificProcedures?: string | null;
    serviceOrder: {
      id: number;
      status: string;
      startDate: string;
      endDate?: string | null;
      reportedDefect: string;
      technicalDiagnosis?: string | null;
      technicalReport?: string | null;
      technician: { name: string };
    };
  }>;
}

export default function EquipmentsInventoryPage() {
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>(
    []
  );
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentRecord | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhotoItem | null>(
    null
  );

  const [form, setForm] = useState({
    customerId: 0,
    name: "",
    category: "Servidor / Computador",
    brand: "",
    model: "",
    serialNumber: "",
    assetTag: "",
    physicalLocation: "",
    technicalSpecs: "",
    notes: "",
    status: "OPERACIONAL" as keyof typeof STATUS_DESIGN_TOKENS.equipment,
  });

  const loadEquipments = async (q = "") => {
    const res = await fetch(
      `/api/v1/equipments${q ? `?q=${encodeURIComponent(q)}` : ""}`
    );
    if (res.ok) {
      const json = await res.json();
      setEquipments(json.data || []);
    }
  };

  useEffect(() => {
    void loadEquipments();
    fetch("/api/v1/customers")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const list = j.data || [];
        setCustomers(list);
        if (list[0]) {
          setForm((f) => ({ ...f, customerId: list[0].id }));
        }
      });

    // Verifica se veio do leitor QR Code via querystring ?qr=
    if (typeof window !== "undefined") {
      const qr = new URLSearchParams(window.location.search).get("qr");
      if (qr) {
        void handleQrLookup(qr);
      }
    }
  }, []);

  const handleQrLookup = async (qrToken: string) => {
    const res = await fetch(
      `/api/v1/equipments?qrToken=${encodeURIComponent(qrToken)}`
    );
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Equipamento não encontrado.");
      return;
    }
    setSelectedEquipment(json.data);
    toast.success(`Ficha aberta: ${json.data.name}`);
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/equipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId: Number(form.customerId),
          photoBase64: capturedPhoto?.base64 || null,
          photoCaption: capturedPhoto?.caption || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(
        `Equipamento cadastrado com etiqueta QR ${json.data.qrCodeToken}!`
      );
      setShowForm(false);
      setCapturedPhoto(null);
      setForm((f) => ({
        ...f,
        name: "",
        brand: "",
        model: "",
        serialNumber: "",
        assetTag: "",
        physicalLocation: "",
        technicalSpecs: "",
        notes: "",
      }));
      void loadEquipments(search);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar equipamento."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-[#0284C7] dark:text-[#38BDF8]" />
            Inventário de Equipamentos dos Clientes (Fotos, QR Code & Linha do Tempo)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Histórico fotográfico em WebP, emissão de etiquetas QR Code com logo da InTime Technology e histórico cronológico de OS/Laudos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QrBarcodeScannerButton onCodeScanned={handleQrLookup} />
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Fechar Cadastro" : "Novo Equipamento"}
          </button>
        </div>
      </div>

      {/* Formulário de Novo Equipamento com Câmera WebP Integrada */}
      {showForm && (
        <form
          onSubmit={handleCreateEquipment}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-6 shadow-md space-y-5"
        >
          <h2 className="text-base font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
            Cadastrar Equipamento no Inventário do Cliente
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Cliente Proprietário *
              </label>
              <select
                required
                value={form.customerId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerId: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              >
                <option value={0}>Selecione um cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Nome / Identificação do Equipamento *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ex: Servidor Dell PowerEdge T340 / Nobreak APC"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Categoria
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="Servidor, Notebook, Desktop, Rede, Nobreak..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Marca</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand: e.target.value }))
                }
                placeholder="Dell, HP, Lenovo, APC, Cisco..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Modelo</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Número de Série (S/N)
              </label>
              <input
                type="text"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serialNumber: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Patrimônio / Tag no Cliente
              </label>
              <input
                type="text"
                value={form.assetTag}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assetTag: e.target.value }))
                }
                placeholder="Ex: PAT-00412"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Localização Física no Cliente
              </label>
              <input
                type="text"
                value={form.physicalLocation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, physicalLocation: e.target.value }))
                }
                placeholder="Ex: CPD / Rack 01 / Recepção"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Status Operacional
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target
                      .value as keyof typeof STATUS_DESIGN_TOKENS.equipment,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              >
                <option value="OPERACIONAL">Operacional</option>
                <option value="EM_MANUTENCAO">Em Manutenção</option>
                <option value="COM_RESTRICAO">Com Restrição</option>
                <option value="DESATIVADO">Desativado</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold mb-1">
                Especificações Técnicas (CPU, RAM, Armazenamento, IP, Tensões, Observações)
              </label>
              <textarea
                rows={2}
                value={form.technicalSpecs}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technicalSpecs: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Câmera Integrada para Foto de Identificação / Placa de Patrimônio */}
          <NativeCameraWebp
            equipmentName={form.name || "Novo Equipamento"}
            defaultStage="IDENTIFICACAO"
            showStageSelector={false}
            onPhotoCaptured={(photo) => setCapturedPhoto(photo)}
          />

          {capturedPhoto && (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs">
              <img
                src={capturedPhoto.base64}
                alt={capturedPhoto.altText}
                className="h-12 w-16 object-cover rounded"
              />
              <div>
                <div className="font-bold text-emerald-500">
                  Foto de Inventário Pronta para Gravação (WebP)
                </div>
                <div className="text-slate-400">alt: {capturedPhoto.altText}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-5 py-2.5 text-xs font-bold shadow"
            >
              Salvar Equipamento & Gerar QR Code
            </button>
          </div>
        </form>
      )}

      {/* Ficha Detalhada + Galeria de Fotos + Linha do Tempo Cronológica */}
      {selectedEquipment && (
        <div className="rounded-2xl border-2 border-[#0284C7] bg-white dark:bg-[#1E293B] p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-[#0284C7] dark:text-[#38BDF8]">
                FICHA TÉCNICA & LINHA DO TEMPO DO EQUIPAMENTO
              </span>
              <h2 className="text-xl font-extrabold">{selectedEquipment.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliente: <strong>{selectedEquipment.customer.name}</strong> • QR
                Tag: <code className="font-mono">{selectedEquipment.qrCodeToken}</code>{" "}
                • S/N: {selectedEquipment.serialNumber || "N/A"} • Local:{" "}
                {selectedEquipment.physicalLocation || "Não informado"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  generateEquipmentQrLabelPdf({
                    id: selectedEquipment.id,
                    name: selectedEquipment.name,
                    qrCodeToken: selectedEquipment.qrCodeToken,
                    serialNumber: selectedEquipment.serialNumber,
                    assetTag: selectedEquipment.assetTag,
                    customerName: selectedEquipment.customer.name,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-3.5 py-2 text-xs font-bold shadow"
              >
                <Printer className="h-4 w-4" />
                Imprimir Etiqueta QR Code
              </button>
              <button
                type="button"
                onClick={() => setSelectedEquipment(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold"
              >
                Fechar Ficha
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Galeria de Fotos do Equipamento */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Camera className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
                Galeria Fotográfica do Equipamento ({selectedEquipment.photos.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedEquipment.photos.map((p) => (
                  <figure
                    key={p.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-[#0F172A]"
                  >
                    <img
                      src={p.fileUrl}
                      alt={p.altText}
                      className="h-28 w-full object-cover"
                    />
                    <figcaption className="p-2 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {p.caption || p.altText}
                    </figcaption>
                  </figure>
                ))}
                {selectedEquipment.photos.length === 0 && (
                  <p className="col-span-3 text-xs text-slate-500 py-4">
                    Nenhuma foto registrada ainda na galeria deste equipamento.
                  </p>
                )}
              </div>
            </div>

            {/* Linha do Tempo Cronológica de OS e Laudos Técnicos */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-[#0284C7] dark:text-[#38BDF8]" />
                Linha do Tempo (Histórico de OS e Laudos Realizados)
              </h3>
              <div className="space-y-3 border-l-2 border-[#0284C7]/40 pl-4">
                {selectedEquipment.serviceOrderLinks.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[#0284C7] dark:text-[#38BDF8]">
                        OS #{link.serviceOrder.id} —{" "}
                        {new Date(
                          link.serviceOrder.startDate
                        ).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Técnico: {link.serviceOrder.technician?.name}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Defeito:</strong>{" "}
                      {link.specificDefect || link.serviceOrder.reportedDefect}
                    </p>
                    {(link.specificProcedures ||
                      link.serviceOrder.technicalReport) && (
                      <p className="text-slate-500 dark:text-slate-400">
                        <strong>Laudo Técnico:</strong>{" "}
                        {link.specificProcedures ||
                          link.serviceOrder.technicalReport}
                      </p>
                    )}
                  </div>
                ))}
                {selectedEquipment.serviceOrderLinks.length === 0 && (
                  <p className="text-xs text-slate-500 py-2">
                    Nenhuma Ordem de Serviço vinculada a este equipamento até o momento.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listagem Geral de Equipamentos */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              void loadEquipments(e.target.value);
            }}
            placeholder="Buscar equipamento por Nome, Marca, Modelo, S/N, Patrimônio, QR Code ou Cliente..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] pl-10 pr-4 py-2 text-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2">Etiqueta QR</th>
                <th className="py-2.5 px-2">Equipamento / Marca</th>
                <th className="py-2.5 px-2">Cliente Proprietário</th>
                <th className="py-2.5 px-2">S/N & Patrimônio</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {equipments.map((eq) => {
                const token =
                  STATUS_DESIGN_TOKENS.equipment[eq.status] ||
                  STATUS_DESIGN_TOKENS.equipment.OPERACIONAL;
                return (
                  <tr
                    key={eq.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-2 font-mono font-bold text-[#0284C7] dark:text-[#38BDF8]">
                      {eq.qrCodeToken}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-semibold">{eq.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {[eq.category, eq.brand, eq.model]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-medium">
                      {eq.customer?.name}
                    </td>
                    <td className="py-2.5 px-2 font-mono">
                      {eq.serialNumber || "-"}{" "}
                      {eq.assetTag ? `(${eq.assetTag})` : ""}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${token.badgeClass}`}
                      >
                        {token.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEquipment(eq)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2.5 py-1.5 text-[11px] font-semibold"
                      >
                        <History className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
                        Linha do Tempo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          generateEquipmentQrLabelPdf({
                            id: eq.id,
                            name: eq.name,
                            qrCodeToken: eq.qrCodeToken,
                            serialNumber: eq.serialNumber,
                            assetTag: eq.assetTag,
                            customerName: eq.customer.name,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-2.5 py-1.5 text-[11px] font-semibold"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Etiqueta QR
                      </button>
                    </td>
                  </tr>
                );
              })}
              {equipments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum equipamento cadastrado ainda.
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
