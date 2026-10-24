import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getUploadsBaseDir } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  context: { params: { path: string[] } }
) {
  const segments = context.params.path || [];
  if (segments.length === 0) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  }

  // Sanitiza contra Path Traversal
  const safeRelative = path
    .normalize(segments.join("/"))
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.join(getUploadsBaseDir(), safeRelative);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const stat = await fsp.stat(fullPath);
  if (stat.isDirectory()) {
    return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
  };
  const contentType = mimeMap[ext] || "application/octet-stream";
  const fileBuffer = await fsp.readFile(fullPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
