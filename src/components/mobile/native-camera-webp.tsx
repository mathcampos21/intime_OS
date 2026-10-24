"use client";

import React, { useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Camera as CameraIcon, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - COMPONENTE DE CÂMERA NATIVA ANDROID + COMPRESSÃO WEBP
 * ============================================================================
 * - No App Android (Capacitor), aciona a câmera nativa do celular em tela cheia.
 * - Na Web, permite usar a webcam/câmera mobile HTML5 ou selecionar arquivo.
 * - Comprime a imagem no próprio dispositivo (formato `image/webp`, máx 1600px,
 *   qualidade 82%) ANTES do upload para economizar franquia 4G/5G do técnico.
 * - Exige ou gera texto alternativo `alt` (WCAG 2.1 AA).
 */

export interface CapturedPhotoItem {
  base64: string;
  stage: "IDENTIFICACAO" | "ANTES" | "DURANTE" | "DEPOIS";
  caption: string;
  altText: string;
}

interface NativeCameraWebpProps {
  equipmentName?: string;
  serviceOrderId?: number;
  defaultStage?: "IDENTIFICACAO" | "ANTES" | "DURANTE" | "DEPOIS";
  showStageSelector?: boolean;
  onPhotoCaptured: (photo: CapturedPhotoItem) => void;
}

/**
 * Converte e comprime um DataURL ou File no cliente para WebP via HTML5 Canvas
 */
async function compressImageClientSideToWebp(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const webpDataUrl = canvas.toDataURL("image/webp", 0.82);
      resolve(webpDataUrl);
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

export function NativeCameraWebp({
  equipmentName = "Equipamento",
  serviceOrderId,
  defaultStage = "DURANTE",
  showStageSelector = true,
  onPhotoCaptured,
}: NativeCameraWebpProps) {
  const [stage, setStage] = useState<
    "IDENTIFICACAO" | "ANTES" | "DURANTE" | "DEPOIS"
  >(defaultStage);
  const [caption, setCaption] = useState("");
  const [previewWebp, setPreviewWebp] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buildAltPreview = () => {
    if (caption.trim().length >= 4) {
      return `${caption.trim()} — ${equipmentName}${
        serviceOrderId ? ` (OS #${serviceOrderId})` : ""
      }`;
    }
    return `Foto do equipamento ${equipmentName}${
      serviceOrderId ? ` na OS #${serviceOrderId}` : ""
    } [Etapa: ${stage}]`;
  };

  const handleNativeAndroidCamera = async () => {
    try {
      setIsProcessing(true);
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt,
          promptLabelHeader: "Foto Técnica InTime OS",
          promptLabelPhoto: "Escolher da Galeria",
          promptLabelPicture: "Tirar Foto com a Câmera",
        });

        if (photo.dataUrl) {
          const compressed = await compressImageClientSideToWebp(photo.dataUrl);
          setPreviewWebp(compressed);
          toast.success("Foto capturada e otimizada em formato WebP!");
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes("cancelled")) {
        toast.error(`Erro ao acessar câmera: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawDataUrl = String(reader.result);
        const compressed = await compressImageClientSideToWebp(rawDataUrl);
        setPreviewWebp(compressed);
        toast.success("Imagem comprimida para WebP no dispositivo!");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Não foi possível comprimir a imagem selecionada.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (!previewWebp) return;
    const altText = buildAltPreview();
    onPhotoCaptured({
      base64: previewWebp,
      stage,
      caption: caption.trim() || `Foto técnica (${stage})`,
      altText,
    });
    setPreviewWebp(null);
    setCaption("");
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-[#0F172A]/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#0284C7] dark:text-[#38BDF8]">
          Câmera Técnica Integrada (Compressão Automática WebP)
        </span>
        {showStageSelector && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Etapa da Foto">
            {(["IDENTIFICACAO", "ANTES", "DURANTE", "DEPOIS"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  stage === s
                    ? "bg-[#0284C7] text-white shadow-sm"
                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {s === "IDENTIFICACAO" ? "Placa/ID" : s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input oculto para fallback Web / Mobile Browser */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Capturar foto do equipamento"
      />

      {!previewWebp ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleNativeAndroidCamera}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition"
          >
            <CameraIcon className="h-4 w-4" aria-hidden="true" />
            {isProcessing ? "Processando WebP..." : "Tirar Foto / Abrir Câmera"}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2.5 text-sm font-medium transition"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Anexar da Galeria
          </button>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <img
              src={previewWebp}
              alt={buildAltPreview()}
              className="h-32 w-44 object-cover rounded-lg border border-[#38BDF8]/40 shadow"
            />
            <div className="flex-1 w-full space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Legenda Técnica / Descrição da Foto (Acessibilidade WCAG 2.1 AA):
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={`Ex: Estado da placa principal (${stage})`}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <strong>Atributo alt automático:</strong> &ldquo;{buildAltPreview()}&rdquo;
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Adicionar Foto ao Laudo
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewWebp(null)}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
