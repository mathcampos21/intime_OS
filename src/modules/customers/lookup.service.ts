import { z } from "zod";

/**
 * ============================================================================
 * INTIME TECHNOLOGY - AUTOMAÇÃO CUSTO ZERO (BRASILAPI CNPJ + VIACEP)
 * ============================================================================
 * Integrações 100% gratuitas e sem chave de API paga para preenchimento
 * instantâneo de Clientes PJ (CNPJ) e Endereços de Atendimento (CEP).
 */

export const CnpjParamSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val.length === 14, "O CNPJ deve conter exatamente 14 dígitos numéricos.");

export const CepParamSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val.length === 8, "O CEP deve conter exatamente 8 dígitos numéricos.");

export interface NormalizedCnpjData {
  cnpj: string;
  legalName: string;
  tradeName: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  status: string;
  mainActivity: string;
}

export interface NormalizedCepData {
  zipCode: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge?: string;
}

export function formatCnpj(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length !== 14) return digits;
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function formatCep(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length !== 8) return digits;
  return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

/**
 * Consulta gratuita de CNPJ via BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`)
 */
export async function lookupCnpjBrasilApi(
  rawCnpj: string
): Promise<NormalizedCnpjData> {
  const cleanCnpj = CnpjParamSchema.parse(rawCnpj);

  const response = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "InTime-OS-Platform/1.0 (https://intimetechnology.com.br)",
      },
      next: { revalidate: 86400 }, // Cache de 24h para evitar rate-limit
    }
  );

  if (!response.ok) {
    throw new Error(
      `Não foi possível localizar o CNPJ ${formatCnpj(cleanCnpj)} na BrasilAPI (HTTP ${response.status}).`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  const rawPhone = String(data.ddd_telefone_1 || "").trim();
  const formattedPhone =
    rawPhone.length >= 10
      ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2)}`
      : rawPhone;

  const logradouro = [data.descricao_tipo_de_logradouro, data.logradouro]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    cnpj: formatCnpj(cleanCnpj),
    legalName: String(data.razao_social || "").trim(),
    tradeName: String(data.nome_fantasia || data.razao_social || "").trim(),
    email: String(data.email || "").toLowerCase().trim(),
    phone: formattedPhone,
    zipCode: formatCep(String(data.cep || "")),
    street: logradouro,
    number: String(data.numero || "").trim(),
    complement: String(data.complemento || "").trim(),
    neighborhood: String(data.bairro || "").trim(),
    city: String(data.municipio || "").trim(),
    state: String(data.uf || "").trim().toUpperCase(),
    status: String(data.descricao_situacao_cadastral || "ATIVA"),
    mainActivity: String(data.cnae_fiscal_descricao || ""),
  };
}

/**
 * Consulta gratuita de CEP via ViaCEP (`https://viacep.com.br/ws/{cep}/json/`)
 * com fallback automático para BrasilAPI CEP v2 caso o ViaCEP oscile.
 */
export async function lookupCepViaCep(
  rawCep: string
): Promise<NormalizedCepData> {
  const cleanCep = CepParamSchema.parse(rawCep);

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${cleanCep}/json/`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
      }
    );

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      if (!data.erro) {
        return {
          zipCode: formatCep(cleanCep),
          street: String(data.logradouro || "").trim(),
          complement: String(data.complemento || "").trim(),
          neighborhood: String(data.bairro || "").trim(),
          city: String(data.localidade || "").trim(),
          state: String(data.uf || "").trim().toUpperCase(),
          ibge: String(data.ibge || ""),
        };
      }
    }
  } catch {
    // Segue para o fallback da BrasilAPI CEP v2
  }

  // Fallback Custo Zero: BrasilAPI CEP v2
  const fallbackRes = await fetch(
    `https://brasilapi.com.br/api/cep/v2/${cleanCep}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!fallbackRes.ok) {
    throw new Error(`CEP ${formatCep(cleanCep)} não encontrado no ViaCEP nem na BrasilAPI.`);
  }

  const fbData = (await fallbackRes.json()) as Record<string, unknown>;
  return {
    zipCode: formatCep(cleanCep),
    street: String(fbData.street || "").trim(),
    complement: "",
    neighborhood: String(fbData.neighborhood || "").trim(),
    city: String(fbData.city || "").trim(),
    state: String(fbData.state || "").trim().toUpperCase(),
  };
}
