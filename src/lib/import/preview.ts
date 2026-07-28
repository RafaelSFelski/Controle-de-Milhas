import { calcularDataExpiracao } from "@/lib/calculations";
import { resolverValidadeMeses } from "@/lib/validade";
import type {
  OrigemCredito,
  Programa,
  ProgramaRegraValidade,
  TipoMovimentacao,
} from "@/types/database";
import {
  TIPOS_NEGATIVOS,
  mapearOrigem,
  mapearTipo,
  parseDateFlexible,
  type CsvRawRow,
} from "./csv";

export type PreviewStatus = "ok" | "erro";

export interface ContaLookup {
  id: string;
  titular_id: string;
  programa_id: string;
  titularNome?: string | null;
  programaNome?: string | null;
  validadeMeses?: number | null;
}

export interface PreviewRow {
  lineNumber: number;
  programaLabel: string;
  tipoRaw: string;
  tipo: TipoMovimentacao;
  origem: OrigemCredito | null;
  quantidade: number;
  quantidadeAssinada: number;
  valorPago: number;
  data: string | null;
  dataExpiracao: string | null;
  descricao: string;
  contaId: string | null;
  titularNome: string | null;
  programaId: string | null;
  status: PreviewStatus;
  erro?: string;
}

function matchPrograma(
  nomeNormalizado: string,
  programas: Pick<Programa, "id" | "nome" | "validade_meses">[]
): Pick<Programa, "id" | "nome" | "validade_meses"> | null {
  const needle = nomeNormalizado.toLowerCase();
  return (
    programas.find((p) => p.nome.toLowerCase() === needle) ??
    programas.find(
      (p) =>
        p.nome.toLowerCase().includes(needle) || needle.includes(p.nome.toLowerCase())
    ) ??
    null
  );
}

export function buildPreviewRows(input: {
  rawRows: CsvRawRow[];
  programas: Pick<Programa, "id" | "nome" | "validade_meses">[];
  contas: ContaLookup[];
  regras: Pick<ProgramaRegraValidade, "programa_id" | "origem" | "validade_meses">[];
  titularId?: string | null;
}): PreviewRow[] {
  const { rawRows, programas, contas, regras, titularId } = input;

  return rawRows.map((row) => {
    const tipo = mapearTipo(row.tipoRaw || "credito");
    const origem = mapearOrigem(row.tipoRaw, row.origemRaw, tipo);
    const data = parseDateFlexible(row.dataRaw);
    const quantidadeAssinada = TIPOS_NEGATIVOS.includes(tipo)
      ? -Math.abs(row.quantidade)
      : Math.abs(row.quantidade);

    const descricaoParts = [
      row.descricao,
      row.valorPago > 0 ? `Valor pago R$ ${row.valorPago.toFixed(2)}` : null,
      `Importação: ${row.tipoRaw || tipo}`,
    ].filter(Boolean);
    const descricao = [...new Set(descricaoParts)].join(" · ");

    const base: Omit<PreviewRow, "status" | "erro"> = {
      lineNumber: row.lineNumber,
      programaLabel: row.programa,
      tipoRaw: row.tipoRaw,
      tipo,
      origem,
      quantidade: row.quantidade,
      quantidadeAssinada,
      valorPago: row.valorPago,
      data,
      dataExpiracao: null,
      descricao,
      contaId: null,
      titularNome: null,
      programaId: null,
    };

    if (!row.programa) {
      return { ...base, status: "erro", erro: "Programa em branco" };
    }
    if (!row.tipoRaw) {
      return { ...base, status: "erro", erro: "Tipo em branco" };
    }
    if (!data) {
      return { ...base, status: "erro", erro: `Data inválida "${row.dataRaw}"` };
    }
    if (!row.quantidade || row.quantidade <= 0) {
      return { ...base, status: "erro", erro: "Quantidade deve ser maior que zero" };
    }

    const programa = matchPrograma(row.programa, programas);
    if (!programa) {
      return {
        ...base,
        status: "erro",
        erro: `Programa "${row.programa}" não encontrado no catálogo`,
      };
    }

    let candidatas = contas.filter((c) => c.programa_id === programa.id);
    if (titularId) {
      candidatas = candidatas.filter((c) => c.titular_id === titularId);
    }

    if (candidatas.length === 0) {
      return {
        ...base,
        programaId: programa.id,
        status: "erro",
        erro: titularId
          ? `Sem conta de "${programa.nome}" para o titular selecionado`
          : `Nenhuma conta cadastrada para "${programa.nome}"`,
      };
    }

    if (candidatas.length > 1 && !titularId) {
      return {
        ...base,
        programaId: programa.id,
        status: "erro",
        erro: `Há ${candidatas.length} contas em "${programa.nome}" — selecione um titular`,
      };
    }

    const conta = candidatas[0];
    const regrasProg = regras.filter((r) => r.programa_id === programa.id);
    const validade = resolverValidadeMeses(
      regrasProg,
      origem,
      programa.validade_meses ?? 24
    );

    let dataExpiracao: string | null = null;
    if (quantidadeAssinada > 0) {
      dataExpiracao = calcularDataExpiracao(data, validade).toISOString().slice(0, 10);
    }

    return {
      ...base,
      programaId: programa.id,
      contaId: conta.id,
      titularNome: conta.titularNome ?? null,
      dataExpiracao,
      status: "ok",
    };
  });
}
