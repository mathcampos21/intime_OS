import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getClientIp } from "@/lib/cloudflare-ip";
import { recordAuditLog } from "@/lib/audit";
import { dataUrlToBuffer, saveOptimizedWebpPhoto } from "@/lib/storage";

const ServiceOrderCreateOrUpdateSchema = z.object({
  id: z.number().int().optional(),
  customerId: z.number().int().positive("Selecione o cliente da OS."),
  technicianId: z.number().int().positive("Selecione o técnico responsável."),
  status: z
    .enum([
      "ORCAMENTO",
      "ABERTA",
      "EM_ANDAMENTO",
      "AGUARDANDO_PECAS",
      "FINALIZADA",
      "CANCELADA",
    ])
    .default("ABERTA"),
  priority: z.enum(["BAIXA", "NORMAL", "ALTA", "CRITICA"]).default("NORMAL"),
  warrantyDays: z.number().int().min(0).default(90),
  reportedDefect: z
    .string()
    .min(3, "Informe o defeito ou solicitação relatada pelo cliente."),
  technicalDiagnosis: z.string().optional().nullable(),
  technicalReport: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  equipmentIds: z.array(z.number().int()).default([]),
  services: z
    .array(
      z.object({
        description: z.string().min(2),
        quantity: z.number().positive().default(1),
        unitPrice: z.number().min(0).default(0),
      })
    )
    .default([]),
  products: z
    .array(
      z.object({
        description: z.string().min(2),
        quantity: z.number().positive().default(1),
        unitPrice: z.number().min(0).default(0),
      })
    )
    .default([]),
  discountAmount: z.number().min(0).default(0),
  photos: z
    .array(
      z.object({
        base64: z.string(),
        stage: z
          .enum(["IDENTIFICACAO", "ANTES", "DURANTE", "DEPOIS"])
          .default("DURANTE"),
        caption: z.string().optional().nullable(),
      })
    )
    .default([]),
  technicianSignatureBase64: z.string().optional().nullable(),
  customerSignatureBase64: z.string().optional().nullable(),
  customerSignerName: z.string().optional().nullable(),
  customerSignerDoc: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const orders = await prisma.serviceOrder.findMany({
    where: {
      ...(status && status !== "TODOS" ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              ...(Number.isInteger(Number(q)) ? [{ id: Number(q) }] : []),
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { reportedDefect: { contains: q, mode: "insensitive" } },
              { technicalReport: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      technician: {
        select: {
          id: true,
          name: true,
          jobTitle: true,
          professionalRegistry: true,
          email: true,
        },
      },
      equipments: {
        include: {
          equipment: true,
        },
      },
      serviceItems: true,
      productItems: true,
      photos: {
        orderBy: { takenAt: "asc" },
      },
      attachments: true,
    },
    orderBy: { id: "desc" },
    take: 150,
  });

  return NextResponse.json({ data: orders });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const parsed = ServiceOrderCreateOrUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados da OS inválidos." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const servicesTotal = data.services.reduce(
    (acc, s) => acc + s.quantity * s.unitPrice,
    0
  );
  const productsTotal = data.products.reduce(
    (acc, p) => acc + p.quantity * p.unitPrice,
    0
  );
  const totalAmount = Math.max(
    0,
    servicesTotal + productsTotal - data.discountAmount
  );

  // Processa Assinatura Digital do Técnico (se enviada)
  let technicianSignatureUrl: string | undefined;
  if (data.technicianSignatureBase64) {
    const sigBuf = dataUrlToBuffer(data.technicianSignatureBase64);
    const savedSig = await saveOptimizedWebpPhoto({
      buffer: sigBuf,
      subfolder: "signatures",
      prefix: `sig-tech-u${data.technicianId}`,
      caption: `Assinatura digital do técnico responsável`,
    });
    technicianSignatureUrl = savedSig.fileUrl;
  }

  // Processa Assinatura Digital do Cliente (Touch Canvas)
  let customerSignatureUrl: string | undefined;
  const clientIp = getClientIp(req);
  if (data.customerSignatureBase64) {
    const sigBuf = dataUrlToBuffer(data.customerSignatureBase64);
    const savedSig = await saveOptimizedWebpPhoto({
      buffer: sigBuf,
      subfolder: "signatures",
      prefix: `sig-cust-c${data.customerId}`,
      caption: `Assinatura digital do cliente ${data.customerSignerName || ""}`,
    });
    customerSignatureUrl = savedSig.fileUrl;
  }

  const now = new Date();
  const isFinished = data.status === "FINALIZADA";

  const order = data.id
    ? await prisma.serviceOrder.update({
        where: { id: data.id },
        data: {
          customerId: data.customerId,
          technicianId: data.technicianId,
          status: data.status,
          priority: data.priority,
          warrantyDays: data.warrantyDays,
          endDate: isFinished ? now : null,
          reportedDefect: data.reportedDefect.trim(),
          technicalDiagnosis: data.technicalDiagnosis?.trim() || null,
          technicalReport: data.technicalReport?.trim() || null,
          recommendations: data.recommendations?.trim() || null,
          observations: data.observations?.trim() || null,
          servicesTotal,
          productsTotal,
          discountAmount: data.discountAmount,
          totalAmount,
          ...(technicianSignatureUrl
            ? { technicianSignatureUrl, technicianSignedAt: now }
            : {}),
          ...(customerSignatureUrl
            ? {
                customerSignatureUrl,
                customerSignerName: data.customerSignerName?.trim() || null,
                customerSignerDoc: data.customerSignerDoc?.trim() || null,
                customerSignedAt: now,
                customerSignedIp: clientIp,
              }
            : {}),
        },
      })
    : await prisma.serviceOrder.create({
        data: {
          customerId: data.customerId,
          technicianId: data.technicianId,
          createdById: auth.session.userId,
          status: data.status,
          priority: data.priority,
          warrantyDays: data.warrantyDays,
          endDate: isFinished ? now : null,
          reportedDefect: data.reportedDefect.trim(),
          technicalDiagnosis: data.technicalDiagnosis?.trim() || null,
          technicalReport: data.technicalReport?.trim() || null,
          recommendations: data.recommendations?.trim() || null,
          observations: data.observations?.trim() || null,
          servicesTotal,
          productsTotal,
          discountAmount: data.discountAmount,
          totalAmount,
          technicianSignatureUrl: technicianSignatureUrl || null,
          technicianSignedAt: technicianSignatureUrl ? now : null,
          customerSignatureUrl: customerSignatureUrl || null,
          customerSignerName: data.customerSignerName?.trim() || null,
          customerSignerDoc: data.customerSignerDoc?.trim() || null,
          customerSignedAt: customerSignatureUrl ? now : null,
          customerSignedIp: customerSignatureUrl ? clientIp : null,
        },
      });

  // Atualiza Equipamentos vinculados à OS
  if (data.equipmentIds.length > 0) {
    await prisma.serviceOrderEquipment.deleteMany({
      where: { serviceOrderId: order.id },
    });
    for (const eqId of data.equipmentIds) {
      await prisma.serviceOrderEquipment.create({
        data: {
          serviceOrderId: order.id,
          equipmentId: eqId,
          specificDefect: data.reportedDefect,
          specificDiagnosis: data.technicalDiagnosis || null,
          specificProcedures: data.technicalReport || null,
          statusAfterService: isFinished ? "OPERACIONAL" : "EM_MANUTENCAO",
        },
      });
      await prisma.equipment.update({
        where: { id: eqId },
        data: {
          status: isFinished ? "OPERACIONAL" : "EM_MANUTENCAO",
          lastInspectedAt: now,
        },
      });
    }
  }

  // Atualiza Serviços e Produtos da OS
  if (data.services.length > 0) {
    await prisma.serviceOrderServiceItem.deleteMany({
      where: { serviceOrderId: order.id },
    });
    for (const srv of data.services) {
      await prisma.serviceOrderServiceItem.create({
        data: {
          serviceOrderId: order.id,
          description: srv.description.trim(),
          quantity: srv.quantity,
          unitPrice: srv.unitPrice,
          subtotal: srv.quantity * srv.unitPrice,
        },
      });
    }
  }

  if (data.products.length > 0) {
    await prisma.serviceOrderProductItem.deleteMany({
      where: { serviceOrderId: order.id },
    });
    for (const prd of data.products) {
      await prisma.serviceOrderProductItem.create({
        data: {
          serviceOrderId: order.id,
          description: prd.description.trim(),
          quantity: prd.quantity,
          unitPrice: prd.unitPrice,
          subtotal: prd.quantity * prd.unitPrice,
        },
      });
    }
  }

  // Processa Fotos do Atendimento (Antes / Durante / Depois) com compressão WebP e alt acessível
  for (const photo of data.photos) {
    const imgBuf = dataUrlToBuffer(photo.base64);
    const saved = await saveOptimizedWebpPhoto({
      buffer: imgBuf,
      subfolder: "os",
      prefix: `os-${order.id}-${photo.stage.toLowerCase()}`,
      caption: photo.caption,
      serviceOrderId: order.id,
      stageLabel: photo.stage,
    });

    await prisma.serviceOrderPhoto.create({
      data: {
        serviceOrderId: order.id,
        stage: photo.stage,
        fileUrl: saved.fileUrl,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        caption: photo.caption?.trim() || `Registro Fotográfico (${photo.stage})`,
        altText: saved.altText,
        uploadedById: auth.session.userId,
      },
    });
  }

  await recordAuditLog({
    userId: auth.session.userId,
    action: data.id ? "UPDATE_SERVICE_ORDER" : "CREATE_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: order.id,
    details: {
      idOs: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      photosAdded: data.photos.length,
    },
    req,
  });

  return NextResponse.json({ data: order }, { status: data.id ? 200 : 201 });
}
