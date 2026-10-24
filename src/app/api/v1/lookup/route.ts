import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  lookupCepViaCep,
  lookupCnpjBrasilApi,
} from "@/modules/customers/lookup.service";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const cnpj = searchParams.get("cnpj");
  const cep = searchParams.get("cep");

  try {
    if (cnpj) {
      const data = await lookupCnpjBrasilApi(cnpj);
      return NextResponse.json({ type: "cnpj", data });
    }

    if (cep) {
      const data = await lookupCepViaCep(cep);
      return NextResponse.json({ type: "cep", data });
    }

    return NextResponse.json(
      { error: "Informe o parâmetro ?cnpj= ou ?cep= para consulta automática." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Falha ao consultar serviço público gratuito.",
      },
      { status: 422 }
    );
  }
}
