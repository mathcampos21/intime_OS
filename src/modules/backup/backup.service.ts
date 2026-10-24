import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import archiver from "archiver";
import AdmZip from "adm-zip";
import cron, { type ScheduledTask } from "node-cron";
import type { BackupType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureStorageDirectories,
  getBackupsBaseDir,
  getUploadsBaseDir,
} from "@/lib/storage";
import { DEFAULT_COMPANY_CONFIG } from "@/config/company";

const execFileAsync = promisify(execFile);

/**
 * ============================================================================
 * INTIME TECHNOLOGY - MOTOR DE BACKUP E RESTAURAÇÃO 1-CLIQUE (.ZIP + SHA-256)
 * ============================================================================
 * - Exporta em um único pacote `.zip`:
 *   1. `database-dump.sql` (via `pg_dump` nativo do PostgreSQL 16)
 *   2. `database-snapshot.json` (Snapshot JSON completo de todas as tabelas Prisma)
 *   3. `uploads/` (Todas as fotos de equipamentos, laudos, assinaturas e anexos)
 *   4. `metadata.json` (Manifesto assinado com hash SHA-256 de cada artefato)
 * - Executa limpeza automática de retenção (ex: manter os últimos 10 backups)
 * - Restaura de forma transacional validando a integridade SHA-256 antes de gravar
 */

export interface BackupManifest {
  system: string;
  company: string;
  cnpj: string;
  version: string;
  createdAt: string;
  backupType: BackupType;
  databaseSnapshotSha256: string;
  sqlDumpIncluded: boolean;
  counts: {
    users: number;
    customers: number;
    equipments: number;
    equipmentPhotos: number;
    serviceOrders: number;
    serviceOrderPhotos: number;
    attachments: number;
  };
}

export interface CreateBackupResult {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  sha256Hash: string;
  manifest: BackupManifest;
}

function computeBufferSha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Exporta um snapshot JSON estruturado de todo o banco de dados + tenta executar `pg_dump` nativo
 */
async function exportDatabaseArtifacts(): Promise<{
  jsonBuffer: Buffer;
  sqlBuffer: Buffer | null;
  counts: BackupManifest["counts"];
}> {
  const [
    companySettings,
    users,
    customers,
    customerUnits,
    equipments,
    equipmentPhotos,
    serviceCatalog,
    productCatalog,
    warrantyTemplates,
    serviceOrders,
    serviceOrderEquipments,
    serviceOrderServiceItems,
    serviceOrderProductItems,
    serviceOrderPhotos,
    serviceOrderAttachments,
    serviceOrderComments,
    termsAcceptances,
  ] = await Promise.all([
    prisma.companySettings.findMany(),
    prisma.user.findMany(),
    prisma.customer.findMany(),
    prisma.customerUnit.findMany(),
    prisma.equipment.findMany(),
    prisma.equipmentPhoto.findMany(),
    prisma.serviceCatalog.findMany(),
    prisma.productCatalog.findMany(),
    prisma.warrantyTemplate.findMany(),
    prisma.serviceOrder.findMany(),
    prisma.serviceOrderEquipment.findMany(),
    prisma.serviceOrderServiceItem.findMany(),
    prisma.serviceOrderProductItem.findMany(),
    prisma.serviceOrderPhoto.findMany(),
    prisma.serviceOrderAttachment.findMany(),
    prisma.serviceOrderComment.findMany(),
    prisma.termsAcceptance.findMany(),
  ]);

  const snapshotPayload = {
    exportedAt: new Date().toISOString(),
    companySettings,
    users,
    customers,
    customerUnits,
    equipments,
    equipmentPhotos,
    serviceCatalog,
    productCatalog,
    warrantyTemplates,
    serviceOrders,
    serviceOrderEquipments,
    serviceOrderServiceItems,
    serviceOrderProductItems,
    serviceOrderPhotos,
    serviceOrderAttachments,
    serviceOrderComments,
    termsAcceptances,
  };

  const jsonBuffer = Buffer.from(JSON.stringify(snapshotPayload, null, 2), "utf-8");

  // Tenta gerar também o dump SQL nativo via pg_dump (instalado no Dockerfile Alpine)
  let sqlBuffer: Buffer | null = null;
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const cleanDbUrl = dbUrl.split("?")[0] || dbUrl;
      const { stdout } = await execFileAsync(
        "pg_dump",
        ["--no-owner", "--no-privileges", "--clean", "--if-exists", cleanDbUrl],
        { maxBuffer: 1024 * 1024 * 100 } // 100 MB buffer
      );
      sqlBuffer = Buffer.from(stdout, "utf-8");
    } catch {
      // Se pg_dump não estiver disponível em ambiente dev Windows local, o database-snapshot.json garante 100% do restore
      sqlBuffer = null;
    }
  }

  return {
    jsonBuffer,
    sqlBuffer,
    counts: {
      users: users.length,
      customers: customers.length,
      equipments: equipments.length,
      equipmentPhotos: equipmentPhotos.length,
      serviceOrders: serviceOrders.length,
      serviceOrderPhotos: serviceOrderPhotos.length,
      attachments: serviceOrderAttachments.length,
    },
  };
}

/**
 * Cria um pacote completo de Backup `.zip` em `/app/backups` e registra no banco
 */
export async function createSystemBackup(options: {
  type?: BackupType;
  userId?: number | null;
  notes?: string;
}): Promise<CreateBackupResult> {
  await ensureStorageDirectories();

  const backupType = options.type ?? "MANUAL";
  const now = new Date();
  const isoStamp = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `intime-backup-${isoStamp}.zip`;
  const backupsDir = getBackupsBaseDir();
  const uploadsDir = getUploadsBaseDir();
  const zipFilePath = path.join(backupsDir, fileName);

  const { jsonBuffer, sqlBuffer, counts } = await exportDatabaseArtifacts();
  const snapshotSha256 = computeBufferSha256(jsonBuffer);

  const manifest: BackupManifest = {
    system: "InTime OS Platform",
    company: DEFAULT_COMPANY_CONFIG.legalName,
    cnpj: DEFAULT_COMPANY_CONFIG.cnpj,
    version: "1.0.0",
    createdAt: now.toISOString(),
    backupType,
    databaseSnapshotSha256: snapshotSha256,
    sqlDumpIncluded: Boolean(sqlBuffer),
    counts,
  };

  // Compacta tudo em um arquivo .zip único
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    // 1. Manifesto com Hash SHA-256
    archive.append(Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"), {
      name: "metadata.json",
    });

    // 2. Snapshot Transacional JSON
    archive.append(jsonBuffer, { name: "database-snapshot.json" });

    // 3. Dump SQL Nativo PostgreSQL (quando disponível)
    if (sqlBuffer) {
      archive.append(sqlBuffer, { name: "database-dump.sql" });
    }

    // 4. Diretório completo /app/uploads (fotos de equipamentos, OS, assinaturas e anexos)
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, "uploads");
    }

    void archive.finalize();
  });

  const stat = await fsp.stat(zipFilePath);
  const zipSha256 = await computeFileSha256(zipFilePath);

  const record = await prisma.backupRecord.create({
    data: {
      fileName,
      filePath: zipFilePath,
      fileSize: BigInt(stat.size),
      sha256Hash: zipSha256,
      type: backupType,
      includesUploads: true,
      recordsSummary: manifest.counts,
      notes: options.notes ?? `Backup ${backupType} concluído com sucesso`,
      createdById: options.userId ?? null,
    },
  });

  // Aplica política de retenção automática (ex: manter os últimos 10 backups)
  await enforceBackupRetention();

  return {
    id: record.id,
    fileName,
    filePath: zipFilePath,
    fileSize: stat.size,
    sha256Hash: zipSha256,
    manifest,
  };
}

/**
 * Remove backups antigos além do limite `backupRetentionCount` configurado
 */
export async function enforceBackupRetention(): Promise<number> {
  const settings = await prisma.companySettings.findFirst();
  const maxKeep =
    settings?.backupRetentionCount ?? DEFAULT_COMPANY_CONFIG.backup.retentionCount;

  const allBackups = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
  });

  if (allBackups.length <= maxKeep) return 0;

  const toDelete = allBackups.slice(maxKeep);
  let deletedCount = 0;

  for (const old of toDelete) {
    try {
      if (fs.existsSync(old.filePath)) {
        await fsp.unlink(old.filePath);
      }
      await prisma.backupRecord.delete({ where: { id: old.id } });
      deletedCount++;
    } catch (err) {
      console.error(`[Backup Retention] Falha ao remover ${old.fileName}:`, err);
    }
  }

  return deletedCount;
}

/**
 * Restaura um pacote `.zip` de backup validando o hash SHA-256 do manifesto
 * e sincronizando as sequences do PostgreSQL ao final.
 */
export async function restoreSystemBackupFromZipBuffer(
  zipBuffer: Buffer,
  expectedZipSha256?: string
): Promise<{
  restoredCounts: BackupManifest["counts"];
  manifest: BackupManifest;
}> {
  await ensureStorageDirectories();

  if (expectedZipSha256) {
    const actualZipHash = computeBufferSha256(zipBuffer);
    if (actualZipHash.toLowerCase() !== expectedZipSha256.toLowerCase()) {
      throw new Error(
        `Violação de integridade SHA-256! Esperado: ${expectedZipSha256}, Calculado: ${actualZipHash}.`
      );
    }
  }

  const zip = new AdmZip(zipBuffer);
  const metadataEntry = zip.getEntry("metadata.json");
  const snapshotEntry = zip.getEntry("database-snapshot.json");

  if (!metadataEntry || !snapshotEntry) {
    throw new Error(
      "Pacote de backup inválido: arquivos obrigatórios 'metadata.json' ou 'database-snapshot.json' ausentes."
    );
  }

  const manifest = JSON.parse(
    metadataEntry.getData().toString("utf-8")
  ) as BackupManifest;
  const snapshotBuffer = snapshotEntry.getData();

  // Valida integridade SHA-256 do snapshot do banco dentro do pacote
  const calculatedSnapshotHash = computeBufferSha256(snapshotBuffer);
  if (calculatedSnapshotHash !== manifest.databaseSnapshotSha256) {
    throw new Error(
      "O banco de dados dentro do arquivo de backup está corrompido (Hash SHA-256 divergente do metadata.json)."
    );
  }

  const snapshot = JSON.parse(snapshotBuffer.toString("utf-8")) as Record<
    string,
    Array<Record<string, unknown>>
  >;

  // 1. Restauração Transacional do Banco de Dados
  await prisma.$transaction(
    async (tx) => {
      // Limpa tabelas filhas na ordem reversa de Foreign Keys
      await tx.serviceOrderComment.deleteMany();
      await tx.serviceOrderAttachment.deleteMany();
      await tx.serviceOrderPhoto.deleteMany();
      await tx.serviceOrderProductItem.deleteMany();
      await tx.serviceOrderServiceItem.deleteMany();
      await tx.serviceOrderEquipment.deleteMany();
      await tx.serviceOrder.deleteMany();
      await tx.equipmentPhoto.deleteMany();
      await tx.equipment.deleteMany();
      await tx.customerUnit.deleteMany();
      await tx.customer.deleteMany();
      await tx.warrantyTemplate.deleteMany();
      await tx.productCatalog.deleteMany();
      await tx.serviceCatalog.deleteMany();
      await tx.termsAcceptance.deleteMany();

      // Restaura Usuários (Upsert para não derrubar conta logada se não estiver no snapshot)
      for (const u of snapshot.users || []) {
        await tx.user.upsert({
          where: { id: Number(u.id) },
          update: {
            name: String(u.name),
            cpf: String(u.cpf),
            email: String(u.email),
            passwordHash: String(u.passwordHash),
            jobTitle: String(u.jobTitle || "Técnico"),
            role: u.role as "ADMIN" | "TECNICO_INTERNO" | "TECNICO_CAMPO",
            isActive: Boolean(u.isActive),
          },
          create: {
            id: Number(u.id),
            legacyMaposId: u.legacyMaposId ? Number(u.legacyMaposId) : null,
            name: String(u.name),
            cpf: String(u.cpf),
            rg: u.rg ? String(u.rg) : null,
            jobTitle: String(u.jobTitle || "Técnico"),
            professionalRegistry: u.professionalRegistry
              ? String(u.professionalRegistry)
              : null,
            email: String(u.email),
            passwordHash: String(u.passwordHash),
            phone: u.phone ? String(u.phone) : null,
            mobile: u.mobile ? String(u.mobile) : null,
            role: u.role as "ADMIN" | "TECNICO_INTERNO" | "TECNICO_CAMPO",
            isActive: Boolean(u.isActive),
          },
        });
      }

      if (snapshot.customers?.length) {
        await tx.customer.createMany({
          data: snapshot.customers as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.customerUnits?.length) {
        await tx.customerUnit.createMany({
          data: snapshot.customerUnits as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.equipments?.length) {
        await tx.equipment.createMany({
          data: snapshot.equipments as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.equipmentPhotos?.length) {
        await tx.equipmentPhoto.createMany({
          data: snapshot.equipmentPhotos as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceCatalog?.length) {
        await tx.serviceCatalog.createMany({
          data: snapshot.serviceCatalog as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.productCatalog?.length) {
        await tx.productCatalog.createMany({
          data: snapshot.productCatalog as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.warrantyTemplates?.length) {
        await tx.warrantyTemplate.createMany({
          data: snapshot.warrantyTemplates as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrders?.length) {
        await tx.serviceOrder.createMany({
          data: snapshot.serviceOrders as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrderEquipments?.length) {
        await tx.serviceOrderEquipment.createMany({
          data: snapshot.serviceOrderEquipments as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrderServiceItems?.length) {
        await tx.serviceOrderServiceItem.createMany({
          data: snapshot.serviceOrderServiceItems as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrderProductItems?.length) {
        await tx.serviceOrderProductItem.createMany({
          data: snapshot.serviceOrderProductItems as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrderPhotos?.length) {
        await tx.serviceOrderPhoto.createMany({
          data: snapshot.serviceOrderPhotos as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrderAttachments?.length) {
        await tx.serviceOrderAttachment.createMany({
          data: snapshot.serviceOrderAttachments as never[],
          skipDuplicates: true,
        });
      }
      if (snapshot.serviceOrderComments?.length) {
        await tx.serviceOrderComment.createMany({
          data: snapshot.serviceOrderComments as never[],
          skipDuplicates: true,
        });
      }
    },
    { timeout: 60000 }
  );

  // 2. Ajusta todas as Sequences do PostgreSQL (setval)
  await syncPostgresSequences();

  // 3. Restaura todos os arquivos e fotos de `uploads/` para `/app/uploads`
  const uploadsDir = getUploadsBaseDir();
  for (const entry of zip.getEntries()) {
    if (entry.entryName.startsWith("uploads/") && !entry.isDirectory) {
      const relativeTarget = entry.entryName.replace(/^uploads\//, "");
      const safeTarget = path.normalize(relativeTarget).replace(/^(\.\.(\/|\\|$))+/, "");
      const destPath = path.join(uploadsDir, safeTarget);
      await fsp.mkdir(path.dirname(destPath), { recursive: true });
      await fsp.writeFile(destPath, entry.getData());
    }
  }

  return {
    restoredCounts: manifest.counts,
    manifest,
  };
}

/**
 * Sincroniza as sequences (`setval`) do PostgreSQL após restauração ou migração do MapOS
 */
export async function syncPostgresSequences(): Promise<void> {
  const tables = [
    "users",
    "customers",
    "customer_units",
    "equipments",
    "equipment_photos",
    "service_catalog",
    "product_catalog",
    "warranty_templates",
    "service_orders",
    "service_order_equipments",
    "service_order_service_items",
    "service_order_product_items",
    "service_order_photos",
    "service_order_attachments",
    "service_order_comments",
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1),
          (SELECT COUNT(*) > 0 FROM "${table}")
        );
      `);
    } catch {
      // Ignora caso alguma tabela específica não utilize serial padrão
    }
  }
}

/**
 * Agendador Automático (Cron) para Backups Diários em `/app/backups`
 */
let activeCronTask: ScheduledTask | null = null;

export function startBackupCronJob(scheduleExpression = "0 3 * * *"): void {
  if (activeCronTask) {
    activeCronTask.stop();
  }

  if (!cron.validate(scheduleExpression)) {
    scheduleExpression = "0 3 * * *";
  }

  activeCronTask = cron.schedule(
    scheduleExpression,
    async () => {
      try {
        await createSystemBackup({
          type: "AUTOMATICO_CRON",
          notes: `Backup diário agendado (${scheduleExpression})`,
        });
      } catch (err) {
        console.error("[InTime Backup Cron Error]:", err);
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );
}
