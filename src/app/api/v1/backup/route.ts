import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getBackupsBaseDir } from "@/lib/storage";
import {
  createSystemBackup,
  restoreSystemBackupFromZipBuffer,
} from "@/modules/backup/backup.service";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN"]);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const downloadFile = searchParams.get("download");

  // Se o ADMIN solicitou o download de um arquivo .zip específico
  if (downloadFile) {
    const safeName = path.basename(downloadFile);
    const fullPath = path.join(getBackupsBaseDir(), safeName);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: "Arquivo de backup não encontrado no volume /app/backups." },
        { status: 404 }
      );
    }

    const fileBuffer = await fsp.readFile(fullPath);
    await recordAuditLog({
      userId: auth.session.userId,
      action: "DOWNLOAD_BACKUP_ZIP",
      entity: "BackupRecord",
      entityId: safeName,
      req,
    });

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  }

  const backups = await prisma.backupRecord.findMany({
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = backups.map((b) => ({
    ...b,
    fileSize: Number(b.fileSize),
  }));

  return NextResponse.json({ data: serialized });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN"]);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // Caso 1: Upload de pacote .zip para Restauração (Restore)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("backupZip") as File | null;
      const expectedSha256 = formData.get("expectedSha256") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "Envie o arquivo .zip de backup para restauração." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Cria um backup preventivo antes de restaurar
      await createSystemBackup({
        type: "PRE_RESTAURACAO",
        userId: auth.session.userId,
        notes: ` Ponto de restauração automático antes de importar ${file.name}`,
      });

      const result = await restoreSystemBackupFromZipBuffer(
        buffer,
        expectedSha256 || undefined
      );

      await recordAuditLog({
        userId: auth.session.userId,
        action: "RESTORE_SYSTEM_BACKUP",
        entity: "BackupRecord",
        entityId: file.name,
        details: { restoredCounts: result.restoredCounts },
        req,
      });

      return NextResponse.json({
        success: true,
        message: "Banco de dados e fotos restaurados com sucesso!",
        ...result,
      });
    }

    // Caso 2: Geração de Novo Backup Manual (1-Clique) ou Restauração Local pelo ID
    const body = (await req.json().catch(() => ({}))) as {
      action?: "create" | "restore_local";
      backupId?: number;
      notes?: string;
    };

    if (body.action === "restore_local" && body.backupId) {
      const record = await prisma.backupRecord.findUnique({
        where: { id: Number(body.backupId) },
      });
      if (!record || !fs.existsSync(record.filePath)) {
        return NextResponse.json(
          { error: "Registro ou arquivo de backup local não encontrado." },
          { status: 404 }
        );
      }

      const zipBuf = await fsp.readFile(record.filePath);
      const result = await restoreSystemBackupFromZipBuffer(
        zipBuf,
        record.sha256Hash
      );

      await recordAuditLog({
        userId: auth.session.userId,
        action: "RESTORE_LOCAL_BACKUP",
        entity: "BackupRecord",
        entityId: record.id,
        details: { fileName: record.fileName, restoredCounts: result.restoredCounts },
        req,
      });

      return NextResponse.json({
        success: true,
        message: `Backup ${record.fileName} validado via SHA-256 e restaurado com sucesso!`,
        ...result,
      });
    }

    // Criação de novo Backup 1-Clique
    const created = await createSystemBackup({
      type: "MANUAL",
      userId: auth.session.userId,
      notes: body.notes || "Backup completo gerado manualmente pelo Painel Admin",
    });

    await recordAuditLog({
      userId: auth.session.userId,
      action: "CREATE_SYSTEM_BACKUP",
      entity: "BackupRecord",
      entityId: created.id,
      details: {
        fileName: created.fileName,
        sha256Hash: created.sha256Hash,
        counts: created.manifest.counts,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erro ao processar operação de Backup/Restauração.",
      },
      { status: 500 }
    );
  }
}
