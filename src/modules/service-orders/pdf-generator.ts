"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - GERADOR DE PDF PROFISSIONAL (OS + LAUDO TÉCNICO + ETIQUETA QR)
 * ============================================================================
 * - Cabeçalho Institucional InTime Technology (CNPJ 10.742.889/0001-36)
 * - Dados do Cliente, Técnico Responsável e Equipamentos Inspecionados
 * - Laudo Técnico Completo (Defeito, Diagnóstico, Procedimentos e Recomendações)
 * - Grade Otimizada de Fotos (Antes / Durante / Depois) com Legendas
 * - Quadro de Assinaturas Digitais (Técnico e Cliente + IP/Timestamp)
 * - Rodapé Automático com Cláusulas de Garantia e Conformidade LGPD (Lei nº 13.709/2018)
 */

export interface PrintableServiceOrderData {
  id: number;
  status: string;
  priority: string;
  startDate: string;
  endDate?: string | null;
  warrantyDays?: number | null;
  reportedDefect: string;
  technicalDiagnosis?: string | null;
  technicalReport?: string | null;
  recommendations?: string | null;
  observations?: string | null;
  totalAmount: number;
  discountAmount?: number;
  customer: {
    name: string;
    document: string;
    phone?: string | null;
    email?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
  };
  technician: {
    name: string;
    jobTitle?: string | null;
    professionalRegistry?: string | null;
    email?: string | null;
  };
  equipments: Array<{
    equipment: {
      name: string;
      brand?: string | null;
      model?: string | null;
      serialNumber?: string | null;
      assetTag?: string | null;
      qrCodeToken: string;
    };
  }>;
  serviceItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  productItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  photos?: Array<{
    fileUrl: string;
    stage: string;
    caption?: string | null;
    altText: string;
  }>;
  technicianSignatureUrl?: string | null;
  customerSignatureUrl?: string | null;
  customerSignerName?: string | null;
  customerSignerDoc?: string | null;
  customerSignedIp?: string | null;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:image/")) return url;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateServiceOrderPdf(
  os: PrintableServiceOrderData
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const company = DEFAULT_COMPANY_CONFIG;

  // 1. Cabeçalho Corporativo Deep Tech Navy (#0F172A) & InTime Royal Blue (#0284C7)
  doc.setFillColor(15, 23, 42);
  doc.rect(10, 10, 190, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company.tradeName.toUpperCase(), 16, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${company.legalName} — CNPJ: ${company.cnpj}`, 16, 26);
  doc.text(
    `E-mail: ${company.email} | Tel: ${company.phone} | ${company.website}`,
    16,
    31
  );

  // Badge Número da OS (Direita)
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(148, 14, 48, 20, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`OS #${String(os.id).padStart(5, "0")}`, 172, 22, {
    align: "center",
  });
  doc.setFontSize(8);
  doc.text(`STATUS: ${os.status}`, 172, 29, { align: "center" });

  let cursorY = 44;

  // 2. Quadro de Dados do Cliente & Técnico Responsável
  autoTable(doc, {
    startY: cursorY,
    margin: { left: 10, right: 10 },
    theme: "grid",
    headStyles: {
      fillColor: [2, 132, 199],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    head: [["DADOS DO CLIENTE", "ATENDIMENTO & RESPONSÁVEL TÉCNICO"]],
    body: [
      [
        `Cliente: ${os.customer.name}\nCPF/CNPJ: ${os.customer.document}\nTelefone: ${
          os.customer.phone || "Não informado"
        } | E-mail: ${os.customer.email || "-"}\nEndereço: ${[
          os.customer.street,
          os.customer.number,
          os.customer.neighborhood,
          os.customer.city,
          os.customer.state,
        ]
          .filter(Boolean)
          .join(", ")}`,
        `Técnico: ${os.technician.name} (${
          os.technician.jobTitle || "Técnico"
        })\nRegistro Profissional: ${
          os.technician.professionalRegistry || "N/A"
        }\nData de Abertura: ${new Date(os.startDate).toLocaleString(
          "pt-BR"
        )}\nConclusão: ${
          os.endDate
            ? new Date(os.endDate).toLocaleString("pt-BR")
            : "Em Atendimento"
        } | Garantia: ${os.warrantyDays ?? 90} dias`,
      ],
    ],
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY + 5;

  // 3. Equipamentos Vinculados à OS
  if (os.equipments.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 10, right: 10 },
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      head: [
        [
          "Equipamento Inspecionado",
          "Marca / Modelo",
          "Nº de Série (S/N)",
          "Patrimônio / QR Tag",
        ],
      ],
      body: os.equipments.map((item) => [
        item.equipment.name,
        [item.equipment.brand, item.equipment.model].filter(Boolean).join(" / ") ||
          "-",
        item.equipment.serialNumber || "-",
        item.equipment.assetTag || item.equipment.qrCodeToken,
      ]),
    });
    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5;
  }

  // 4. Laudo Técnico Completo (Defeito, Diagnóstico, Procedimentos e Recomendações)
  const reportRows: Array<[string, string]> = [
    ["1. Defeito / Solicitação Relatada", os.reportedDefect || "-"],
  ];
  if (os.technicalDiagnosis) {
    reportRows.push([
      "2. Diagnóstico / Inspeção Técnica",
      os.technicalDiagnosis,
    ]);
  }
  if (os.technicalReport) {
    reportRows.push([
      "3. Serviços e Procedimentos Executados (Laudo Técnico)",
      os.technicalReport,
    ]);
  }
  if (os.recommendations) {
    reportRows.push([
      "4. Recomendações Técnicas ao Cliente",
      os.recommendations,
    ]);
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: 10, right: 10 },
    theme: "grid",
    headStyles: { fillColor: [2, 132, 199], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", fillColor: [241, 245, 249] },
      1: { cellWidth: 138 },
    },
    head: [["SEÇÃO DO LAUDO TÉCNICO", "DESCRIÇÃO DETALHADA"]],
    body: reportRows,
  });

  cursorY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 5;

  // 5. Tabela de Serviços e Peças/Produtos + Totalizador
  const financialRows: Array<[string, string, string, string, string]> = [];
  for (const s of os.serviceItems) {
    financialRows.push([
      "SERVIÇO",
      s.description,
      String(s.quantity),
      `R$ ${Number(s.unitPrice).toFixed(2)}`,
      `R$ ${Number(s.subtotal).toFixed(2)}`,
    ]);
  }
  for (const p of os.productItems) {
    financialRows.push([
      "PEÇA/PROD.",
      p.description,
      String(p.quantity),
      `R$ ${Number(p.unitPrice).toFixed(2)}`,
      `R$ ${Number(p.subtotal).toFixed(2)}`,
    ]);
  }

  if (financialRows.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: 10, right: 10 },
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      head: [["Tipo", "Descrição", "Qtd", "Vlr. Unit.", "Subtotal"]],
      body: financialRows,
      foot: [
        [
          "",
          "",
          "",
          "VALOR TOTAL DA OS:",
          `R$ ${Number(os.totalAmount).toFixed(2)}`,
        ],
      ],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        fontSize: 8.5,
      },
    });
    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;
  }

  // 6. Grade de Fotos do Atendimento (Antes / Durante / Depois)
  if (os.photos && os.photos.length > 0) {
    if (cursorY > 210) {
      doc.addPage();
      cursorY = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(2, 132, 199);
    doc.text(
      "REGISTRO FOTOGRÁFICO DO ATENDIMENTO (ANTES / DURANTE / DEPOIS)",
      10,
      cursorY
    );
    cursorY += 4;

    let colIndex = 0;
    for (const photo of os.photos.slice(0, 6)) {
      const imgData = await fetchImageAsDataUrl(photo.fileUrl);
      if (!imgData) continue;

      const xPos = 10 + colIndex * 64;
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(xPos, cursorY, 60, 46, 1.5, 1.5, "S");
      try {
        doc.addImage(imgData, "WEBP", xPos + 2, cursorY + 2, 56, 34);
      } catch {
        // fallback caso o navegador converta para JPEG/PNG
        try {
          doc.addImage(imgData, "JPEG", xPos + 2, cursorY + 2, 56, 34);
        } catch {
          // ignora imagem se formato não suportado
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`[${photo.stage}]`, xPos + 3, cursorY + 39);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      const shortCaption = (photo.caption || photo.altText).slice(0, 38);
      doc.text(shortCaption, xPos + 3, cursorY + 43);

      colIndex++;
      if (colIndex >= 3) {
        colIndex = 0;
        cursorY += 50;
      }
    }
    if (colIndex > 0) {
      cursorY += 50;
    }
  }

  // 7. Assinaturas Digitais e Cláusulas de Garantia / LGPD
  if (cursorY > 225) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setDrawColor(148, 163, 184);
  doc.rect(10, cursorY, 92, 28);
  doc.rect(108, cursorY, 92, 28);

  if (os.technicianSignatureUrl) {
    const techSig = await fetchImageAsDataUrl(os.technicianSignatureUrl);
    if (techSig) {
      try {
        doc.addImage(techSig, "PNG", 24, cursorY + 2, 60, 16);
      } catch {
        // ignore
      }
    }
  }

  if (os.customerSignatureUrl) {
    const custSig = await fetchImageAsDataUrl(os.customerSignatureUrl);
    if (custSig) {
      try {
        doc.addImage(custSig, "PNG", 122, cursorY + 2, 60, 16);
      } catch {
        // ignore
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `TÉCNICO: ${os.technician.name}`,
    56,
    cursorY + 22,
    { align: "center" }
  );
  doc.text(
    `CLIENTE: ${os.customerSignerName || os.customer.name}`,
    154,
    cursorY + 22,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("InTime Technology — Responsável Técnico", 56, cursorY + 26, {
    align: "center",
  });
  doc.text(
    `Doc: ${os.customerSignerDoc || os.customer.document}${
      os.customerSignedIp ? ` | IP: ${os.customerSignedIp}` : ""
    }`,
    154,
    cursorY + 26,
    { align: "center" }
  );

  cursorY += 33;

  // Rodapé Legal Obrigatório: Termo de Garantia + Cláusula LGPD (Lei nº 13.709/2018)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text("TERMOS DE GARANTIA E PROTEÇÃO DE DADOS (LGPD - LEI Nº 13.709/2018):", 10, cursorY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  const legalLines = doc.splitTextToSize(
    `${company.legal.defaultWarrantyTerms}\n${company.legal.lgpdClauseText}`,
    190
  );
  doc.text(legalLines, 10, cursorY + 3.5);

  doc.save(`InTime-OS-${String(os.id).padStart(5, "0")}-Laudo.pdf`);
}

/**
 * Gera um PDF de Etiqueta Patrimonial com Logo InTime Technology + QR Code Único do Equipamento
 */
export async function generateEquipmentQrLabelPdf(equipment: {
  id: number;
  name: string;
  qrCodeToken: string;
  serialNumber?: string | null;
  assetTag?: string | null;
  customerName: string;
}): Promise<void> {
  // Etiqueta padrão térmica/adesiva 80mm x 50mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [80, 50],
  });

  const qrDataUrl = await QRCode.toDataURL(equipment.qrCodeToken, {
    margin: 1,
    width: 240,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });

  // Faixa Superior InTime Technology
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 80, 11, "F");
  doc.setTextColor(56, 189, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("InTime Technology", 4, 5.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(`CNPJ: ${DEFAULT_COMPANY_CONFIG.cnpj} | ${DEFAULT_COMPANY_CONFIG.phone}`, 4, 9);

  // QR Code à esquerda
  doc.addImage(qrDataUrl, "PNG", 3, 13, 28, 28);

  // Dados técnicos à direita
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const eqTitle = doc.splitTextToSize(equipment.name, 44);
  doc.text(eqTitle.slice(0, 2), 33, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`Cliente: ${equipment.customerName.slice(0, 26)}`, 33, 25);
  doc.text(`S/N: ${equipment.serialNumber || "N/A"}`, 33, 29.5);
  doc.text(`Patrimônio: ${equipment.assetTag || `#${equipment.id}`}`, 33, 34);

  doc.setFillColor(2, 132, 199);
  doc.roundedRect(33, 36.5, 44, 5.5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(equipment.qrCodeToken, 55, 40.2, { align: "center" });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(5.2);
  doc.text(
    "Aponte a câmera do App InTime OS para abrir o histórico e laudos",
    40,
    47,
    { align: "center" }
  );

  doc.save(`Etiqueta-QR-${equipment.qrCodeToken}.pdf`);
}
