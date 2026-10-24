"use client";

import React, { useRef, useState, useEffect } from "react";
import { Eraser, Check, PenTool } from "lucide-react";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - QUADRO DE ASSINATURA DIGITAL NA TELA (TOUCH CANVAS)
 * ============================================================================
 * Suporta desenho suave com o dedo em telas Android (Touch Events) e mouse
 * no Desktop, exportando a assinatura limpa em DataURL PNG/WebP.
 */

interface SignatureTouchCanvasProps {
  label: string;
  signerSubtitle?: string;
  onSignatureConfirm: (dataUrl: string | null) => void;
}

export function SignatureTouchCanvas({
  label,
  signerSubtitle,
  onSignatureConfirm,
}: SignatureTouchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [confirmedUrl, setConfirmedUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    const mouseEvent = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: mouseEvent.clientX - rect.left,
      y: mouseEvent.clientY - rect.top,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStroke(true);
    setConfirmedUrl(null);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    setConfirmedUrl(null);
    onSignatureConfirm(null);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    const dataUrl = canvas.toDataURL("image/png");
    setConfirmedUrl(dataUrl);
    onSignatureConfirm(dataUrl);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <PenTool className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#38BDF8]" />
            {label}
          </span>
          {signerSubtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {signerSubtitle}
            </p>
          )}
        </div>
        {confirmedUrl && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Assinatura Capturada
          </span>
        )}
      </div>

      <div className="relative rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={520}
          height={150}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[140px] touch-none cursor-crosshair"
          aria-label={`Quadro de assinatura digital: ${label}`}
        />
        <div className="pointer-events-none absolute bottom-2 left-6 right-6 border-b border-slate-300 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">
            Assine com o dedo ou caneta acima desta linha
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Eraser className="h-3.5 w-3.5" />
          Limpar Quadro
        </button>
        <button
          type="button"
          disabled={!hasStroke}
          onClick={confirmSignature}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 text-white px-3.5 py-1.5 text-xs font-semibold"
        >
          <Check className="h-3.5 w-3.5" />
          Confirmar Assinatura
        </button>
      </div>
    </div>
  );
}
