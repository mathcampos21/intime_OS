import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { dataUrlToBuffer, saveOptimizedWebpPhoto } from "@/lib/storage";

const EquipmentCreateSchema = z.object({
  customerId: z.number().int().positive("Selecione o cliente proprietário."),
  unitId: z.number().int().optional().nullable(),
  name: z.string().min(2, "Nome/Descrição do equipamento é obrigatório."),
  category: z.string().default("Geral"),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  assetTag: z.string().optional().nullable(),
  physicalLocation: z.string().optional().nullable(),
  technicalSpecs: z.string().optional().nullable(),
  accessories: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z
    .enum(["OPERACIONAL", "EM_MANUTENCAO", "COM_RESTRICAO", "DESATIVADO"])
    .default("OPERACIONAL"),
  photoBase64: z.string().optional().nullable(),
  photoCaption: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const qrToken = searchParams.get("qrToken")?.trim();
  const q = searchParams.get("q")?.trim();

  // Busca instantânea pelo Scanner de QR Code / Código de Barras do App Android
  if (qrToken) {
    const equipment = await prisma.equipment.findFirst({
      where: {
        OR: [
          { qrCodeToken: qrToken },
          { assetTag: qrToken },
          { serialNumber: qrToken },
        ],
      },
      include: {
        customer: true,
        unit: true,
        photos: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { takenAt: "desc" },
        },
        serviceOrderLinks: {
          include: {
            serviceOrder: {
              include: {
                technician: { select: { id: true, name: true } },
                photos: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: `Nenhum equipamento localizado com a etiqueta/QR '${qrToken}'.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: equipment });
  }

  const equipments = await prisma.equipment.findMany({
    where: {
      ...(customerId ? { customerId: Number(customerId) } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { serialNumber: { contains: q, mode: "insensitive" } },
              { assetTag: { contains: q, mode: "insensitive" } },
              { qrCodeToken: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      customer: {
        select: { id: true, name: true, tradeName: true, document: true },
      },
      photos: {
        orderBy: { takenAt: "desc" },
      },
      serviceOrderLinks: {
        include: {
          serviceOrder: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              reportedDefect: true,
              technicalDiagnosis: true,
              technicalReport: true,
              technician: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 150,
  });

  return NextResponse.json({ data: equipments });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const parsed = EquipmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados do equipamento inválidos." },
      { status: 400 }
    );
  }

  const randomTag = Math.floor(100000 + Math.random() * 900000);
  const qrCodeToken = `INTIME-EQ-${parsed.data.customerId}-${randomTag}`;

  const created = await prisma.equipment.create({
    data: {
      qrCodeToken,
      customerId: parsed.data.customerId,
      unitId: parsed.data.unitId || null,
      name: parsed.data.name.trim(),
      category: parsed.data.category.trim(),
      brand: parsed.data.brand?.trim() || null,
      model: parsed.data.model?.trim() || null,
      serialNumber: parsed.data.serialNumber?.trim() || null,
      assetTag: parsed.data.assetTag?.trim() || null,
      physicalLocation: parsed.data.physicalLocation?.trim() || null,
      technicalSpecs: parsed.data.technicalSpecs?.trim() || null,
      accessories: parsed.data.accessories?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      status: parsed.data.status,
      lastInspectedAt: new Date(),
    },
  });

  // Se o técnico tirou uma foto do equipamento (câmera app ou upload), converte para WebP + alt acessível
  if (parsed.data.photoBase64) {
    const imgBuffer = dataUrlToBuffer(parsed.data.photoBase64);
    const savedPhoto = await saveOptimizedWebpPhoto({
      buffer: imgBuffer,
      subfolder: "equipments",
      prefix: `eq-${created.id}`,
      caption: parsed.data.photoCaption,
      equipmentName: created.name,
      stageLabel: "Identificação de Patrimônio",
    });

    await prisma.equipmentPhoto.create({
      data: {
        equipmentId: created.id,
        fileUrl: savedPhoto.fileUrl,
        fileName: savedPhoto.fileName,
        mimeType: savedPhoto.mimeType,
        fileSize: savedPhoto.fileSize,
        caption: parsed.data.photoCaption?.trim() || "Registro de Inventário",
        altText: savedPhoto.altText,
        uploadedById: auth.session.userId,
      },
    });
  }

  await recordAuditLog({
    userId: auth.session.userId,
    action: "CREATE_EQUIPMENT",
    entity: "Equipment",
    entityId: created.id,
    details: {
      name: created.name,
      qrCodeToken: created.qrCodeToken,
      customerId: created.customerId,
    },
    req,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
