import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - MOTOR DE MÍDIA WEBP & ACESSIBILIDADE WCAG 2.1 AA
 * ============================================================================
 * - Armazena fotos e assinaturas no volume persistente `/app/uploads`
 * - Converte e comprime automaticamente qualquer imagem (JPEG/PNG/HEIC/WebP)
 *   para formato `WebP` otimizado (máx 1600px, qualidade 82%)
 * - Gera obrigatoriamente o texto alternativo (`altText`) descritivo para
 *   conformidade com a diretriz WCAG 2.1 AA.
 */

export type UploadSubfolder =
  | "equipments"
  | "os"
  | "signatures"
  | "attachments"
  | "avatars"
  | "brand";

export function getUploadsBaseDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

export function getBackupsBaseDir(): string {
  return process.env.BACKUPS_DIR || path.join(process.cwd(), "backups");
}

export async function ensureStorageDirectories(): Promise<void> {
  const base = getUploadsBaseDir();
  const folders: UploadSubfolder[] = [
    "equipments",
    "os",
    "signatures",
    "attachments",
    "avatars",
    "brand",
  ];

  for (const folder of folders) {
    await fs.mkdir(path.join(base, folder), { recursive: true });
  }
  await fs.mkdir(getBackupsBaseDir(), { recursive: true });
}

export interface ProcessedImageResult {
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  altText: string;
}

export interface SaveWebpPhotoOptions {
  buffer: Buffer;
  subfolder: UploadSubfolder;
  prefix?: string;
  caption?: string | null;
  equipmentName?: string | null;
  serviceOrderId?: number | null;
  stageLabel?: string | null;
}

/**
 * Gera um texto alternativo (`alt`) semântico e acessível (WCAG 2.1 AA)
 * caso o técnico não tenha digitado uma legenda manual na foto.
 */
export function buildAccessibleAltText(options: {
  caption?: string | null;
  equipmentName?: string | null;
  serviceOrderId?: number | null;
  stageLabel?: string | null;
}): string {
  const cleanCaption = options.caption?.trim();
  if (cleanCaption && cleanCaption.length >= 4) {
    if (options.serviceOrderId && options.equipmentName) {
      return `${cleanCaption} — Equipamento ${options.equipmentName} (OS #${options.serviceOrderId})`;
    }
    if (options.equipmentName) {
      return `${cleanCaption} — Equipamento ${options.equipmentName}`;
    }
    return cleanCaption;
  }

  const eqName = options.equipmentName?.trim() || "Equipamento Técnico";
  const stage = options.stageLabel ? ` [Etapa: ${options.stageLabel}]` : "";

  if (options.serviceOrderId) {
    return `Foto do equipamento ${eqName} na OS #${options.serviceOrderId}${stage}`;
  }

  return `Foto técnica de inventário do equipamento ${eqName}${stage}`;
}

/**
 * Converte um Buffer ou Base64 DataURL para WebP otimizado e grava em `/app/uploads/<subfolder>`
 */
export async function saveOptimizedWebpPhoto(
  options: SaveWebpPhotoOptions
): Promise<ProcessedImageResult> {
  await ensureStorageDirectories();

  const uniqueId = crypto.randomBytes(6).toString("hex");
  const timestamp = Date.now();
  const safePrefix = (options.prefix || "intime")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-");
  const fileName = `${safePrefix}-${timestamp}-${uniqueId}.webp`;

  const targetDir = path.join(getUploadsBaseDir(), options.subfolder);
  const filePath = path.join(targetDir, fileName);

  // Compressão inteligente via Sharp (orientação EXIF preservada, redimensionamento máx 1600px)
  const webpBuffer = await sharp(options.buffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  await fs.writeFile(filePath, webpBuffer);

  const altText = buildAccessibleAltText({
    caption: options.caption,
    equipmentName: options.equipmentName,
    serviceOrderId: options.serviceOrderId,
    stageLabel: options.stageLabel,
  });

  return {
    fileName,
    fileUrl: `/api/v1/uploads/${options.subfolder}/${fileName}`,
    filePath,
    mimeType: "image/webp",
    fileSize: webpBuffer.byteLength,
    altText,
  };
}

/**
 * Converte uma string DataURL Base64 (vinda da Câmera Capacitor ou do Touch Canvas de Assinatura) em Buffer
 */
export function dataUrlToBuffer(dataUrlOrBase64: string): Buffer {
  const base64Data = dataUrlOrBase64.includes(";base64,")
    ? dataUrlOrBase64.split(";base64,")[1] || ""
    : dataUrlOrBase64;
  return Buffer.from(base64Data, "base64");
}
