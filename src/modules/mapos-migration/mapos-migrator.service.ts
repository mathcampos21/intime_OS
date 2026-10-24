import fsp from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import type { ServiceOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ensureStorageDirectories, getUploadsBaseDir } from "@/lib/storage";
import { syncPostgresSequences } from "@/modules/backup/backup.service";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - MOTOR DE MIGRAÇÃO AUTOMÁTICA DO MAPOS LEGADO
 * ============================================================================
 * Analisa dumps `.sql` (MySQL/MariaDB) exportados pelo MapOS original
 * (`https://github.com/ramonsilva20/mapos`), suportando:
 * 1. Dry-Run (Pré-visualização segura sem gravar no banco)
 * 2. Mapeamento fiel de `clientes`, `usuarios`, `os`, `servicos`, `servicos_os`,
 *    `produtos`, `produtos_os`, `garantias`, `anexos` e `anotacoes_os`
 * 3. Preservação estrita do número original da OS (`idOs`) + atualização da
 *    SEQUENCE do PostgreSQL (`setval`) para continuar em `MAX(idOs) + 1`
 * 4. Criação e vínculo automático de Equipamentos no novo Módulo de Inventário
 *    a partir do campo `descricaoProduto` das OS antigas do MapOS
 * 5. Operações Idempotentes (`UPSERT`) para evitar duplicidade
 */

export interface MaposParsedRow {
  [column: string]: string | number | null;
}

export interface MaposDryRunSummary {
  tablesFound: string[];
  counts: {
    clientes: number;
    usuarios: number;
    os: number;
    equipamentosAutoGerados: number;
    servicos: number;
    servicos_os: number;
    produtos: number;
    produtos_os: number;
    garantias: number;
    anexos: number;
    anotacoes_os: number;
  };
  osIdRange: {
    minIdOs: number | null;
    maxIdOs: number | null;
    nextSequenceIdOs: number;
  };
  sampleCustomers: Array<{ id: number; name: string; document: string }>;
  sampleServiceOrders: Array<{
    idOs: number;
    customerId: number;
    status: string;
    equipmentExtracted: string;
    startDate: string;
  }>;
}

export interface MaposMigrationExecutionResult extends MaposDryRunSummary {
  executedAt: string;
  attachmentsExtractedCount: number;
}

/**
 * Colunas padrão da estrutura `banco.sql` do MapOS caso o comando `INSERT INTO tabela VALUES`
 * do mysqldump tenha sido exportado sem a lista explícita de colunas `INSERT INTO tabela (col1, col2) VALUES`.
 */
const MAPOS_DEFAULT_TABLE_COLUMNS: Record<string, string[]> = {
  clientes: [
    "idClientes",
    "nomeCliente",
    "sexo",
    "pessoa_fisica",
    "documento",
    "telefone",
    "celular",
    "email",
    "senha",
    "dataCadastro",
    "rua",
    "numero",
    "bairro",
    "cidade",
    "estado",
    "cep",
    "contato",
    "complemento",
    "fornecedor",
  ],
  usuarios: [
    "idUsuarios",
    "nome",
    "rg",
    "cpf",
    "cep",
    "rua",
    "numero",
    "bairro",
    "cidade",
    "estado",
    "email",
    "senha",
    "telefone",
    "celular",
    "situacao",
    "dataCadastro",
    "permissoes_id",
    "dataExpiracao",
    "url_image_user",
    "cargo",
  ],
  os: [
    "idOs",
    "dataInicial",
    "dataFinal",
    "garantia",
    "descricaoProduto",
    "defeito",
    "status",
    "observacoes",
    "laudoTecnico",
    "valorTotal",
    "desconto",
    "valor_desconto",
    "tipo_desconto",
    "clientes_id",
    "usuarios_id",
    "lancamento",
    "faturado",
    "garantias_id",
  ],
  servicos: ["idServicos", "nome", "descricao", "preco"],
  servicos_os: [
    "idServicos_os",
    "servico",
    "quantidade",
    "preco",
    "os_id",
    "servicos_id",
    "subTotal",
  ],
  produtos: [
    "idProdutos",
    "codDeBarra",
    "descricao",
    "unidade",
    "precoCompra",
    "precoVenda",
    "estoque",
    "estoqueMinimo",
    "saida",
    "entrada",
  ],
  produtos_os: [
    "idProdutos_os",
    "quantidade",
    "descricao",
    "preco",
    "os_id",
    "produtos_id",
    "subTotal",
  ],
  garantias: [
    "idGarantias",
    "dataGarantia",
    "refGarantia",
    "textoGarantia",
    "usuarios_id",
  ],
  anexos: ["idAnexos", "anexo", "thumb", "url", "path", "os_id"],
  anotacoes_os: ["idAnotacoes", "anotacao", "data_hora", "os_id"],
};

/**
 * Extrai também a ordem real das colunas a partir dos blocos `CREATE TABLE` presentes no próprio `.sql`,
 * garantindo compatibilidade com qualquer versão histórica do MapOS (v3.x, v4.x).
 */
function extractCreateTableColumns(sqlContent: string): Record<string, string[]> {
  const result: Record<string, string[]> = { ...MAPOS_DEFAULT_TABLE_COLUMNS };
  const createTableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\)\s*ENGINE=/gi;

  let match: RegExpExecArray | null;
  while ((match = createTableRegex.exec(sqlContent)) !== null) {
    const tableName = (match[1] || "").toLowerCase();
    const body = match[2] || "";
    const cols: string[] = [];

    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (
        !line ||
        line.toUpperCase().startsWith("PRIMARY KEY") ||
        line.toUpperCase().startsWith("KEY ") ||
        line.toUpperCase().startsWith("UNIQUE KEY") ||
        line.toUpperCase().startsWith("INDEX ") ||
        line.toUpperCase().startsWith("CONSTRAINT ")
      ) {
        continue;
      }
      const colMatch = line.match(/^`?([a-zA-Z0-9_]+)`?\s+/);
      if (colMatch && colMatch[1]) {
        cols.push(colMatch[1]);
      }
    }

    if (cols.length > 0) {
      result[tableName] = cols;
    }
  }

  return result;
}

/**
 * Parser léxico de tuplas SQL `VALUES (val1, 'val2', NULL), (val3, ...)`
 * Trata corretamente strings com vírgulas, quebras de linha, HTML do CKEditor/Trumbowyg e escapes `\'` ou `''`.
 */
function parseSqlValuesTuples(valuesChunk: string): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [];
  let currentRow: Array<string | number | null> = [];
  let currentToken = "";
  let inTuple = false;
  let inString = false;
  let stringWasQuoted = false;

  for (let i = 0; i < valuesChunk.length; i++) {
    const ch = valuesChunk[i];

    if (inString) {
      if (ch === "\\") {
        const next = valuesChunk[i + 1];
        if (next === "n") {
          currentToken += "\n";
          i++;
        } else if (next === "r") {
          currentToken += "\r";
          i++;
        } else if (next === "t") {
          currentToken += "\t";
          i++;
        } else if (next !== undefined) {
          currentToken += next;
          i++;
        }
      } else if (ch === "'") {
        // Verifica escape estilo SQL padrão ''
        if (valuesChunk[i + 1] === "'") {
          currentToken += "'";
          i++;
        } else {
          inString = false;
        }
      } else {
        currentToken += ch;
      }
      continue;
    }

    if (!inTuple) {
      if (ch === "(") {
        inTuple = true;
        currentRow = [];
        currentToken = "";
        stringWasQuoted = false;
      }
      continue;
    }

    if (ch === "'") {
      inString = true;
      stringWasQuoted = true;
      continue;
    }

    if (ch === "," || ch === ")") {
      const trimmed = currentToken.trim();
      if (stringWasQuoted) {
        currentRow.push(currentToken);
      } else if (trimmed.toUpperCase() === "NULL" || trimmed === "") {
        currentRow.push(null);
      } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        currentRow.push(Number(trimmed));
      } else {
        currentRow.push(trimmed);
      }

      currentToken = "";
      stringWasQuoted = false;

      if (ch === ")") {
        rows.push(currentRow);
        inTuple = false;
      }
      continue;
    }

    currentToken += ch;
  }

  return rows;
}

/**
 * Faz o parse completo do arquivo `.sql` do MapOS e retorna os registros estruturados por tabela
 */
export function parseMaposSqlDump(
  sqlContent: string
): Record<string, MaposParsedRow[]> {
  const schemaCols = extractCreateTableColumns(sqlContent);
  const parsedTables: Record<string, MaposParsedRow[]> = {
    clientes: [],
    usuarios: [],
    os: [],
    servicos: [],
    servicos_os: [],
    produtos: [],
    produtos_os: [],
    garantias: [],
    anexos: [],
    anotacoes_os: [],
  };

  const insertRegex =
    /INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*(\([^)]+\))?\s*VALUES\s*([\s\S]*?);\s*(?:\r?\n|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const tableName = (match[1] || "").toLowerCase();
    if (!(tableName in parsedTables)) continue;

    const explicitColsRaw = match[2];
    const valuesBlock = match[3] || "";

    let columns: string[] = [];
    if (explicitColsRaw) {
      columns = explicitColsRaw
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((c) => c.trim().replace(/`/g, ""));
    } else {
      columns = schemaCols[tableName] || [];
    }

    const tuples = parseSqlValuesTuples(valuesBlock);
    for (const tuple of tuples) {
      const rowObj: MaposParsedRow = {};
      for (let idx = 0; idx < columns.length; idx++) {
        const colName = columns[idx];
        if (colName) {
          rowObj[colName] = tuple[idx] ?? null;
        }
      }
      parsedTables[tableName]?.push(rowObj);
    }
  }

  return parsedTables;
}

/**
 * Converte os status em texto do MapOS legado para o Enum padronizado `ServiceOrderStatus`
 */
function mapLegacyOsStatus(rawStatus: string | number | null | undefined): ServiceOrderStatus {
  const normalized = String(rawStatus || "Aberta")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("ORCAMENTO")) return "ORCAMENTO";
  if (normalized.includes("ANDAMENTO") || normalized.includes("ANALISE")) {
    return "EM_ANDAMENTO";
  }
  if (normalized.includes("AGUARDANDO") || normalized.includes("PECA") || normalized.includes("APROVACAO")) {
    return "AGUARDANDO_PECAS";
  }
  if (normalized.includes("FINALIZAD") || normalized.includes("CONCLUID") || normalized.includes("FATURAD")) {
    return "FINALIZADA";
  }
  if (normalized.includes("CANCELAD") || normalized.includes("REPROVAD")) {
    return "CANCELADA";
  }
  return "ABERTA";
}

/**
 * Remove tags HTML sujas do editor antigo do MapOS preservando quebras de linha legíveis
 */
function cleanLegacyHtml(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function parseSafeDate(val: string | number | null | undefined): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (str.startsWith("0000-00-00")) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Extrai Marca, Categoria e Nome limpo a partir do campo `descricaoProduto` da OS antiga do MapOS
 */
function inferEquipmentDetailsFromDescription(rawDesc: string): {
  name: string;
  category: string;
  brand: string | null;
} {
  const clean = cleanLegacyHtml(rawDesc) || "Equipamento Migrado MapOS";
  const firstLine = (clean.split("\n")[0] || clean).slice(0, 140).trim();
  const upper = firstLine.toUpperCase();

  let category = "Geral";
  if (upper.includes("NOTEBOOK") || upper.includes("LAPTOP") || upper.includes("MACBOOK")) {
    category = "Notebook";
  } else if (upper.includes("SERVIDOR") || upper.includes("POWEREDGE") || upper.includes("PROLIANT")) {
    category = "Servidor";
  } else if (upper.includes("DESKTOP") || upper.includes("COMPUTADOR") || upper.includes("PC ") || upper.includes("ALL IN ONE")) {
    category = "Desktop / Workstation";
  } else if (upper.includes("NOBREAK") || upper.includes("UPS")) {
    category = "Nobreak / Energia";
  } else if (upper.includes("IMPRESSORA") || upper.includes("MULTIFUNCIONAL") || upper.includes("LASERJET") || upper.includes("ECOTANK")) {
    category = "Impressora";
  } else if (upper.includes("SWITCH") || upper.includes("ROTEADOR") || upper.includes("FIREWALL") || upper.includes("MIKROTIK") || upper.includes("UBIQUITI")) {
    category = "Rede & Conectividade";
  } else if (upper.includes("MONITOR") || upper.includes("TV")) {
    category = "Monitor / Display";
  }

  const knownBrands = [
    "Dell",
    "HP",
    "Lenovo",
    "Acer",
    "Asus",
    "Apple",
    "Samsung",
    "LG",
    "APC",
    "SMS",
    "NHS",
    "Intelbras",
    "Cisco",
    "MikroTik",
    "Ubiquiti",
    "Epson",
    "Brother",
    "Positivo",
  ];
  let detectedBrand: string | null = null;
  for (const b of knownBrands) {
    if (new RegExp(`\\b${b}\\b`, "i").test(firstLine)) {
      detectedBrand = b;
      break;
    }
  }

  return {
    name: firstLine || "Equipamento Geral",
    category,
    brand: detectedBrand,
  };
}

/**
 * 1. MODO DRY-RUN (Pré-Visualização Segura antes de importar)
 */
export function analyzeMaposSqlDryRun(sqlContent: string): MaposDryRunSummary {
  const parsed = parseMaposSqlDump(sqlContent);

  const osIds = (parsed.os || [])
    .map((r) => Number(r.idOs))
    .filter((n) => !isNaN(n) && n > 0);

  const minIdOs = osIds.length > 0 ? Math.min(...osIds) : null;
  const maxIdOs = osIds.length > 0 ? Math.max(...osIds) : null;

  // Calcula quantos equipamentos únicos por cliente serão gerados a partir de descricaoProduto
  const uniqueEquipmentKeys = new Set<string>();
  for (const osRow of parsed.os || []) {
    const cid = Number(osRow.clientes_id || 0);
    const desc = cleanLegacyHtml(osRow.descricaoProduto) || `Equipamento OS #${osRow.idOs}`;
    uniqueEquipmentKeys.add(`${cid}::${desc.toLowerCase().slice(0, 100)}`);
  }

  const tablesFound = Object.entries(parsed)
    .filter(([, rows]) => rows.length > 0)
    .map(([name]) => name);

  return {
    tablesFound,
    counts: {
      clientes: parsed.clientes?.length || 0,
      usuarios: parsed.usuarios?.length || 0,
      os: parsed.os?.length || 0,
      equipamentosAutoGerados: uniqueEquipmentKeys.size,
      servicos: parsed.servicos?.length || 0,
      servicos_os: parsed.servicos_os?.length || 0,
      produtos: parsed.produtos?.length || 0,
      produtos_os: parsed.produtos_os?.length || 0,
      garantias: parsed.garantias?.length || 0,
      anexos: parsed.anexos?.length || 0,
      anotacoes_os: parsed.anotacoes_os?.length || 0,
    },
    osIdRange: {
      minIdOs,
      maxIdOs,
      nextSequenceIdOs: maxIdOs ? maxIdOs + 1 : 1,
    },
    sampleCustomers: (parsed.clientes || []).slice(0, 6).map((c) => ({
      id: Number(c.idClientes),
      name: String(c.nomeCliente || ""),
      document: String(c.documento || "Não informado"),
    })),
    sampleServiceOrders: (parsed.os || []).slice(0, 8).map((o) => ({
      idOs: Number(o.idOs),
      customerId: Number(o.clientes_id),
      status: mapLegacyOsStatus(o.status),
      equipmentExtracted:
        inferEquipmentDetailsFromDescription(String(o.descricaoProduto || "")).name,
      startDate: String(o.dataInicial || ""),
    })),
  };
}

/**
 * 2. EXECUÇÃO COMPLETA E IDEMPOTENTE (UPSERT) DA MIGRAÇÃO DO MAPOS LEGADO
 */
export async function executeMaposMigration(options: {
  sqlContent: string;
  attachmentsZipBuffer?: Buffer | null;
}): Promise<MaposMigrationExecutionResult> {
  await ensureStorageDirectories();
  const dryRun = analyzeMaposSqlDryRun(options.sqlContent);
  const parsed = parseMaposSqlDump(options.sqlContent);

  const defaultImportedPasswordHash = await hashPassword("InTime@MudarSenha2026");

  // --------------------------------------------------------------------------
  // PASSO A: Funcionários (`usuarios` -> `User`) com UPSERT por ID original
  // --------------------------------------------------------------------------
  for (const u of parsed.usuarios || []) {
    const idUsuarios = Number(u.idUsuarios);
    if (!idUsuarios || isNaN(idUsuarios)) continue;

    const rawCpf = String(u.cpf || "").trim();
    const safeCpf =
      rawCpf.length >= 11 ? rawCpf : `LEGACY-CPF-${idUsuarios}`;
    const rawEmail = String(u.email || "").trim().toLowerCase();
    const safeEmail =
      rawEmail.includes("@") ? rawEmail : `tecnico${idUsuarios}@intimetechnology.com.br`;

    const isAdmin = Number(u.permissoes_id) === 1;

    await prisma.user.upsert({
      where: { id: idUsuarios },
      update: {
        legacyMaposId: idUsuarios,
        name: String(u.nome || `Colaborador #${idUsuarios}`).trim(),
        rg: u.rg ? String(u.rg).trim() : null,
        jobTitle: String(u.cargo || (isAdmin ? "Administrador" : "Técnico")).trim(),
        phone: u.telefone ? String(u.telefone).trim() : null,
        mobile: u.celular ? String(u.celular).trim() : null,
        zipCode: u.cep ? String(u.cep).trim() : null,
        street: u.rua ? String(u.rua).trim() : null,
        number: u.numero ? String(u.numero).trim() : null,
        neighborhood: u.bairro ? String(u.bairro).trim() : null,
        city: u.cidade ? String(u.cidade).trim() : null,
        state: u.estado ? String(u.estado).trim() : null,
        isActive: Number(u.situacao ?? 1) === 1,
      },
      create: {
        id: idUsuarios,
        legacyMaposId: idUsuarios,
        name: String(u.nome || `Colaborador #${idUsuarios}`).trim(),
        cpf: safeCpf,
        rg: u.rg ? String(u.rg).trim() : null,
        jobTitle: String(u.cargo || (isAdmin ? "Administrador" : "Técnico")).trim(),
        email: safeEmail,
        passwordHash: defaultImportedPasswordHash,
        phone: u.telefone ? String(u.telefone).trim() : null,
        mobile: u.celular ? String(u.celular).trim() : null,
        zipCode: u.cep ? String(u.cep).trim() : null,
        street: u.rua ? String(u.rua).trim() : null,
        number: u.numero ? String(u.numero).trim() : null,
        neighborhood: u.bairro ? String(u.bairro).trim() : null,
        city: u.cidade ? String(u.cidade).trim() : null,
        state: u.estado ? String(u.estado).trim() : null,
        role: isAdmin ? "ADMIN" : "TECNICO_CAMPO",
        isActive: Number(u.situacao ?? 1) === 1,
        createdAt: parseSafeDate(u.dataCadastro) ?? new Date(),
      },
    });
  }

  // Garante pelo menos 1 técnico fallback caso uma OS antiga aponte para um `usuarios_id` excluído no MapOS
  let fallbackTech = await prisma.user.findFirst({ orderBy: { id: "asc" } });
  if (!fallbackTech) {
    fallbackTech = await prisma.user.create({
      data: {
        name: "Equipe Técnica InTime Technology",
        cpf: "000.000.000-00",
        email: "suporte@intimetechnology.com.br",
        passwordHash: defaultImportedPasswordHash,
        role: "ADMIN",
      },
    });
  }

  // --------------------------------------------------------------------------
  // PASSO B: Clientes (`clientes` -> `Customer`) com UPSERT por ID original
  // --------------------------------------------------------------------------
  for (const c of parsed.clientes || []) {
    const idClientes = Number(c.idClientes);
    if (!idClientes || isNaN(idClientes)) continue;

    // No MapOS: pessoa_fisica = 1 significa PF, 0 significa PJ
    const isPf = Number(c.pessoa_fisica) === 1;
    const customerData = {
      legacyMaposId: idClientes,
      isLegalEntity: !isPf,
      name: String(c.nomeCliente || `Cliente #${idClientes}`).trim(),
      document: String(c.documento || "NÃO INFORMADO").trim(),
      isSupplier: Number(c.fornecedor) === 1,
      email: c.email ? String(c.email).trim() : null,
      phone: c.telefone ? String(c.telefone).trim() : null,
      mobile: c.celular ? String(c.celular).trim() : null,
      contactPerson: c.contato ? String(c.contato).trim() : null,
      zipCode: c.cep ? String(c.cep).trim() : null,
      street: c.rua ? String(c.rua).trim() : null,
      number: c.numero ? String(c.numero).trim() : null,
      complement: c.complemento ? String(c.complemento).trim() : null,
      neighborhood: c.bairro ? String(c.bairro).trim() : null,
      city: c.cidade ? String(c.cidade).trim() : null,
      state: c.estado ? String(c.estado).trim() : null,
    };

    await prisma.customer.upsert({
      where: { id: idClientes },
      update: customerData,
      create: {
        id: idClientes,
        ...customerData,
        createdAt: parseSafeDate(c.dataCadastro) ?? new Date(),
      },
    });
  }

  // Garante cliente fallback caso alguma OS antiga aponte para `clientes_id` órfão
  let fallbackCustomer = await prisma.customer.findFirst({ orderBy: { id: "asc" } });
  if (!fallbackCustomer) {
    fallbackCustomer = await prisma.customer.create({
      data: {
        name: "Cliente Histórico MapOS",
        document: "00.000.000/0000-00",
        isLegalEntity: true,
      },
    });
  }

  // --------------------------------------------------------------------------
  // PASSO C: Catálogo de Serviços, Produtos e Garantias (`servicos`, `produtos`, `garantias`)
  // --------------------------------------------------------------------------
  for (const s of parsed.servicos || []) {
    const idServicos = Number(s.idServicos);
    if (!idServicos) continue;
    await prisma.serviceCatalog.upsert({
      where: { id: idServicos },
      update: {
        legacyMaposId: idServicos,
        name: String(s.nome || `Serviço #${idServicos}`).trim(),
        description: s.descricao ? String(s.descricao).trim() : null,
        standardPrice: Number(s.preco || 0),
      },
      create: {
        id: idServicos,
        legacyMaposId: idServicos,
        name: String(s.nome || `Serviço #${idServicos}`).trim(),
        description: s.descricao ? String(s.descricao).trim() : null,
        standardPrice: Number(s.preco || 0),
      },
    });
  }

  for (const p of parsed.produtos || []) {
    const idProdutos = Number(p.idProdutos);
    if (!idProdutos) continue;
    await prisma.productCatalog.upsert({
      where: { id: idProdutos },
      update: {
        legacyMaposId: idProdutos,
        code: p.codDeBarra ? String(p.codDeBarra).trim() : null,
        description: String(p.descricao || `Produto #${idProdutos}`).trim(),
        unit: String(p.unidade || "UN").trim(),
        purchasePrice: Number(p.precoCompra || 0),
        salePrice: Number(p.precoVenda || 0),
        stockQuantity: Number(p.estoque || 0),
        minStock: Number(p.estoqueMinimo || 0),
      },
      create: {
        id: idProdutos,
        legacyMaposId: idProdutos,
        code: p.codDeBarra ? String(p.codDeBarra).trim() : null,
        description: String(p.descricao || `Produto #${idProdutos}`).trim(),
        unit: String(p.unidade || "UN").trim(),
        purchasePrice: Number(p.precoCompra || 0),
        salePrice: Number(p.precoVenda || 0),
        stockQuantity: Number(p.estoque || 0),
        minStock: Number(p.estoqueMinimo || 0),
      },
    });
  }

  for (const g of parsed.garantias || []) {
    const idGarantias = Number(g.idGarantias);
    if (!idGarantias) continue;
    await prisma.warrantyTemplate.upsert({
      where: { id: idGarantias },
      update: {
        legacyMaposId: idGarantias,
        reference: String(g.refGarantia || `Termo #${idGarantias}`).trim(),
        text: cleanLegacyHtml(g.textoGarantia),
      },
      create: {
        id: idGarantias,
        legacyMaposId: idGarantias,
        reference: String(g.refGarantia || `Termo #${idGarantias}`).trim(),
        text: cleanLegacyHtml(g.textoGarantia),
        createdAt: parseSafeDate(g.dataGarantia) ?? new Date(),
      },
    });
  }

  // --------------------------------------------------------------------------
  // PASSO D: Ordens de Serviço (`os` -> `ServiceOrder` + Criação Automática de `Equipment`)
  // CRÍTICO: Preserva exatamente o `idOs` original!
  // --------------------------------------------------------------------------
  const existingCustomerIds = new Set(
    (await prisma.customer.findMany({ select: { id: true } })).map((x) => x.id)
  );
  const existingUserIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((x) => x.id)
  );
  const existingWarrantyIds = new Set(
    (await prisma.warrantyTemplate.findMany({ select: { id: true } })).map((x) => x.id)
  );

  for (const osRow of parsed.os || []) {
    const idOs = Number(osRow.idOs);
    if (!idOs || isNaN(idOs)) continue;

    const rawCustomerId = Number(osRow.clientes_id);
    const customerId = existingCustomerIds.has(rawCustomerId)
      ? rawCustomerId
      : fallbackCustomer.id;

    const rawTechId = Number(osRow.usuarios_id);
    const technicianId = existingUserIds.has(rawTechId)
      ? rawTechId
      : fallbackTech.id;

    const rawWarrantyId = Number(osRow.garantias_id);
    const warrantyTemplateId = existingWarrantyIds.has(rawWarrantyId)
      ? rawWarrantyId
      : null;

    const warrantyNumber = parseInt(String(osRow.garantia || "90").replace(/\D/g, ""), 10);
    const warrantyDays = isNaN(warrantyNumber) ? 90 : warrantyNumber;

    const legacyProductDesc = cleanLegacyHtml(osRow.descricaoProduto);
    const reportedDefect =
      cleanLegacyHtml(osRow.defeito) || "Manutenção / Inspeção Técnica";
    const technicalReport = cleanLegacyHtml(osRow.laudoTecnico);
    const observations = cleanLegacyHtml(osRow.observacoes);

    const status = mapLegacyOsStatus(osRow.status);
    const startDate = parseSafeDate(osRow.dataInicial) ?? new Date();
    const endDate = parseSafeDate(osRow.dataFinal);

    // 1. Cria ou atualiza a Ordem de Serviço com o exato `idOs` original
    const osData = {
      legacyMaposId: idOs,
      customerId,
      technicianId,
      status,
      startDate,
      endDate,
      warrantyDays,
      warrantyTextLegacy: osRow.garantia ? String(osRow.garantia).trim() : null,
      warrantyTemplateId,
      legacyProductDesc: legacyProductDesc || null,
      reportedDefect,
      technicalReport: technicalReport || null,
      observations: observations || null,
      discountAmount: Number(osRow.valor_desconto || osRow.desconto || 0),
      totalAmount: Number(osRow.valorTotal || 0),
      isBilled: Number(osRow.faturado) === 1,
    };

    await prisma.serviceOrder.upsert({
      where: { id: idOs },
      update: osData,
      create: {
        id: idOs,
        ...osData,
        createdAt: startDate,
      },
    });

    // 2. Criação Automática e Idempotente de Equipamento a partir de `descricaoProduto`
    const eqInfo = inferEquipmentDetailsFromDescription(
      legacyProductDesc || `Equipamento Atendimento OS #${idOs}`
    );

    let equipment = await prisma.equipment.findFirst({
      where: {
        customerId,
        name: eqInfo.name,
      },
    });

    if (!equipment) {
      equipment = await prisma.equipment.create({
        data: {
          qrCodeToken: `INTIME-EQ-C${customerId}-OS${idOs}`,
          customerId,
          name: eqInfo.name,
          category: eqInfo.category,
          brand: eqInfo.brand,
          technicalSpecs:
            legacyProductDesc && legacyProductDesc !== eqInfo.name
              ? legacyProductDesc
              : null,
          notes: observations || null,
          status: status === "EM_ANDAMENTO" ? "EM_MANUTENCAO" : "OPERACIONAL",
          lastInspectedAt: endDate ?? startDate,
          migratedFromMaposOsId: idOs,
        },
      });
    }

    // 3. Vincula o Equipamento à OS correspondente na Linha do Tempo
    await prisma.serviceOrderEquipment.upsert({
      where: {
        serviceOrderId_equipmentId: {
          serviceOrderId: idOs,
          equipmentId: equipment.id,
        },
      },
      update: {
        specificDefect: reportedDefect,
        specificProcedures: technicalReport || null,
      },
      create: {
        serviceOrderId: idOs,
        equipmentId: equipment.id,
        specificDefect: reportedDefect,
        specificProcedures: technicalReport || null,
        statusAfterService: "OPERACIONAL",
      },
    });
  }

  // --------------------------------------------------------------------------
  // PASSO E: Vínculos de Serviços (`servicos_os`), Produtos (`produtos_os`) e Anotações
  // --------------------------------------------------------------------------
  const validOsIds = new Set(
    (await prisma.serviceOrder.findMany({ select: { id: true } })).map((x) => x.id)
  );

  for (const so of parsed.servicos_os || []) {
    const idItem = Number(so.idServicos_os);
    const osId = Number(so.os_id);
    if (!idItem || !validOsIds.has(osId)) continue;

    const qty = Number(so.quantidade || 1);
    const price = Number(so.preco || 0);
    const sub = Number(so.subTotal || qty * price);

    await prisma.serviceOrderServiceItem.upsert({
      where: { id: idItem },
      update: {
        legacyMaposId: idItem,
        serviceOrderId: osId,
        description: String(so.servico || "Serviço Técnico").trim(),
        quantity: qty,
        unitPrice: price,
        subtotal: sub,
      },
      create: {
        id: idItem,
        legacyMaposId: idItem,
        serviceOrderId: osId,
        description: String(so.servico || "Serviço Técnico").trim(),
        quantity: qty,
        unitPrice: price,
        subtotal: sub,
      },
    });
  }

  for (const po of parsed.produtos_os || []) {
    const idItem = Number(po.idProdutos_os);
    const osId = Number(po.os_id);
    if (!idItem || !validOsIds.has(osId)) continue;

    const qty = Number(po.quantidade || 1);
    const price = Number(po.preco || 0);
    const sub = Number(po.subTotal || qty * price);

    await prisma.serviceOrderProductItem.upsert({
      where: { id: idItem },
      update: {
        legacyMaposId: idItem,
        serviceOrderId: osId,
        description: String(po.descricao || "Peça / Componente").trim(),
        quantity: qty,
        unitPrice: price,
        subtotal: sub,
      },
      create: {
        id: idItem,
        legacyMaposId: idItem,
        serviceOrderId: osId,
        description: String(po.descricao || "Peça / Componente").trim(),
        quantity: qty,
        unitPrice: price,
        subtotal: sub,
      },
    });
  }

  for (const note of parsed.anotacoes_os || []) {
    const idNote = Number(note.idAnotacoes);
    const osId = Number(note.os_id);
    if (!idNote || !validOsIds.has(osId)) continue;

    await prisma.serviceOrderComment.upsert({
      where: { id: idNote },
      update: {
        legacyMaposId: idNote,
        serviceOrderId: osId,
        note: cleanLegacyHtml(note.anotacao),
      },
      create: {
        id: idNote,
        legacyMaposId: idNote,
        serviceOrderId: osId,
        note: cleanLegacyHtml(note.anotacao),
        createdAt: parseSafeDate(note.data_hora) ?? new Date(),
      },
    });
  }

  // --------------------------------------------------------------------------
  // PASSO F: Anexos (`anexos`) e Extração do `.zip` da pasta `assets/anexos`
  // --------------------------------------------------------------------------
  let attachmentsExtractedCount = 0;
  const attachmentsDestDir = path.join(getUploadsBaseDir(), "attachments");

  if (options.attachmentsZipBuffer) {
    const zip = new AdmZip(options.attachmentsZipBuffer);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const baseFileName = path.basename(entry.entryName);
      if (!baseFileName) continue;
      const destFile = path.join(attachmentsDestDir, baseFileName);
      await fsp.writeFile(destFile, entry.getData());
      attachmentsExtractedCount++;
    }
  }

  for (const ax of parsed.anexos || []) {
    const idAnexo = Number(ax.idAnexos);
    const osId = Number(ax.os_id);
    if (!idAnexo || !validOsIds.has(osId)) continue;

    const fileName = path.basename(String(ax.anexo || ax.path || `anexo-${idAnexo}`));
    const fileUrl = `/api/v1/uploads/attachments/${fileName}`;

    await prisma.serviceOrderAttachment.upsert({
      where: { id: idAnexo },
      update: {
        legacyMaposId: idAnexo,
        serviceOrderId: osId,
        attachmentName: fileName,
        fileUrl,
      },
      create: {
        id: idAnexo,
        legacyMaposId: idAnexo,
        serviceOrderId: osId,
        attachmentName: fileName,
        fileUrl,
      },
    });
  }

  // --------------------------------------------------------------------------
  // PASSO G: CRÍTICO — Atualiza a SEQUENCE do PostgreSQL (`setval`) em todas as tabelas
  // Garante que a próxima OS nova continue exatamente a partir de `MAX(idOs) + 1`
  // --------------------------------------------------------------------------
  await syncPostgresSequences();

  return {
    ...dryRun,
    executedAt: new Date().toISOString(),
    attachmentsExtractedCount,
  };
}
