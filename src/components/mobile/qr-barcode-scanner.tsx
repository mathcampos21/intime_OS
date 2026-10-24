"use client";

import React, { useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  BarcodeScanner,
  BarcodeFormat,
} from "@capacitor-mlkit/barcode-scanning";
import { QrCode, Search, X } from "lucide-react";
import { toast } from "sonner";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - SCANNER NATIVO DE QR CODE / CÓDIGO DE BARRAS (ANDROID)
 * ============================================================================
 * Lê a etiqueta de patrimônio colada no equipamento do cliente para abrir
 * instantaneamente a ficha técnica e a linha do tempo de OS e Laudos.
 */

interface QrBarcodeScannerModalProps {
  onCodeScanned: (code: string) => void;
}

export function QrBarcodeScannerButton({
  onCodeScanned,
}: QrBarcodeScannerModalProps) {
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);

  const handleStartScan = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        setScanning(true);
        const perm = await BarcodeScanner.requestPermissions();
        if (perm.camera !== "granted") {
          toast.error("Permissão de câmera negada para leitura do QR Code.");
          setManualModalOpen(true);
          return;
        }

        const { barcodes } = await BarcodeScanner.scan({
          formats: [
            BarcodeFormat.QrCode,
            BarcodeFormat.Code128,
            BarcodeFormat.Ean13,
          ],
        });

        const rawValue = barcodes[0]?.rawValue?.trim();
        if (rawValue) {
          // Extrai o token caso o QR contenha URL completa ex: https://.../equipamentos?qr=INTIME-EQ-1
          const extracted = rawValue.includes("qr=")
            ? new URL(rawValue).searchParams.get("qr") || rawValue
            : rawValue;
          toast.success(`Etiqueta lida: ${extracted}`);
          onCodeScanned(extracted);
        }
      } else {
        setManualModalOpen(true);
      }
    } catch {
      setManualModalOpen(true);
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleStartScan}
        disabled={scanning}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] dark:bg-[#0284C7] hover:bg-[#0369A1] text-white px-4 py-2.5 text-sm font-semibold shadow-sm border border-[#38BDF8]/30 transition"
      >
        <QrCode className="h-4 w-4 text-[#38BDF8] dark:text-white" aria-hidden="true" />
        {scanning ? "Lendo QR Code..." : "Ler QR Code / Patrimônio"}
      </button>

      {manualModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0F172A] text-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="qr-modal-title" className="text-lg font-bold flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#38BDF8]" />
                Localizar Equipamento por QR / Tag
              </h3>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
                aria-label="Fechar leitor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              No App Android da <strong>InTime Technology</strong>, este botão abre o leitor óptico MLKit da câmera. No computador, você pode usar um leitor USB de código de barras ou digitar o código da etiqueta abaixo:
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  onCodeScanned(manualCode.trim());
                  setManualModalOpen(false);
                  setManualCode("");
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: INTIME-EQ-1-482910 ou S/N ou PAT-001"
                className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Search className="h-3.5 w-3.5" />
                  Abrir Ficha do Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
