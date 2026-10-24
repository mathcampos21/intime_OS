import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { createSystemBackup } from "@/modules/backup/backup.service";
import {
  analyzeMaposSqlDryRun,
  executeMaposMigration,
} from "@/modules/mapos-migration/mapos-migrator.service";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN"]);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const sqlFile = formData.get("sqlFile") as File | null;
    const attachmentsZip = formData.get("attachmentsZip") as File | null;
    const mode = String(formData.get("mode") || "dry-run");

    if (!sqlFile) {
      return NextResponse.json(
        { error: "Envie o arquivo de dump .sql exportado do MapOS legado." },
        { status: 400 }
      );
    }

    const sqlContent = await sqlFile.text();

    // 1. Modo Dry-Run (Pré-Visualização Segura)
    if (mode === "dry-run") {
      const summary = analyzeMaposSqlDryRun(sqlContent);
      return NextResponse.json({
        mode: "dry-run",
        summary,
      });
    }

    // 2. Modo Execute (Gravação Transacional com UPSERT + Ajuste de Sequence setval)
    // Antes de importar, gera um Backup Preventivo Automático
    await createSystemBackup({
      type: "PRE_MIGRACAO",
      userId: auth.session.userId,
      notes: `Backup preventivo antes de importar ${sqlFile.name} do MapOS`,
    });

    let zipBuffer: Buffer | null = null;
    if (attachmentsZip && attachmentsZip.size > 0) {
      const ab = await attachmentsZip.arrayBuffer();
      zipBuffer = Buffer.from(ab);
    }

    const result = await executeMaposMigration({
      sqlContent,
      attachmentsZipBuffer: zipBuffer,
    });

    await recordAuditLog({
      userId: auth.session.userId,
      action: "MIGRATE_LEGACY_MAPOS_SQL",
      entity: "Database",
      entityId: sqlFile.name,
      details: {
        counts: result.counts,
        osIdRange: result.osIdRange,
        attachmentsExtractedCount: result.attachmentsExtractedCount,
      },
      req,
    });

    return NextResponse.json({
      mode: "execute",
      success: true,
      result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Falha ao processar arquivo .sql do MapOS.",
      },
      { status: 500 }
    );
  }
}
