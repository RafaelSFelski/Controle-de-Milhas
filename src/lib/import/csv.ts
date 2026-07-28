import type { OrigemCredito, TipoMovimentacao } from "@/types/database";

/** Tipos cuja quantidade deve ser negativa no ledger. */
export const TIPOS_NEGATIVOS: TipoMovimentacao[] = [
  "debito",
  "expiracao",
  "transferencia_saida",
];

export interface CsvRawRow {
  lineNumber: number;
  programa: string;
  tipoRaw: string;
  valorPago: number;
  quantidade: number;
  dataRaw: string;
  descricao?: string;
  origemRaw?: string;
}

/**
 * Divide uma linha CSV respeitando aspas e delimitador `,` ou `;`.
 */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** Detecta delimitador pelo header (prioridade `;` se aparecer mais vezes). */
export function detectDelimiter(headerLine: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") commas++;
    if (ch === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => splitCsvLine(line, delimiter));
  return { headers, rows };
}

export function detectColumnIndices(headers: string[]): Record<
  "programa" | "tipo" | "valor" | "quantidade" | "data" | "descricao" | "origem",
  number
> {
  const indices = {
    programa: -1,
    tipo: -1,
    valor: -1,
    quantidade: -1,
    data: -1,
    descricao: -1,
    origem: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const col = headers[i].toLowerCase().trim();
    if (indices.programa < 0 && (col.includes("programa") || col.includes("fidelida"))) {
      indices.programa = i;
    } else if (
      indices.tipo < 0 &&
      (col === "tipo" || col.includes("tipo de") || col.includes("tipo_mov"))
    ) {
      indices.tipo = i;
    } else if (
      indices.valor < 0 &&
      (col.includes("valor") || col.includes("pago") || col.includes("custo") || col.includes("r$"))
    ) {
      indices.valor = i;
    } else if (
      indices.quantidade < 0 &&
      (col.includes("quantidade") || col.includes("milhas") || col.includes("pontos") || col === "qtd")
    ) {
      indices.quantidade = i;
    } else if (indices.data < 0 && (col === "data" || col.includes("data_"))) {
      indices.data = i;
    } else if (
      indices.descricao < 0 &&
      (col.includes("descricao") || col.includes("descrição") || col.includes("obs"))
    ) {
      indices.descricao = i;
    } else if (indices.origem < 0 && col.includes("origem")) {
      indices.origem = i;
    }
  }

  // Fallback posicional clássico: Programa, Tipo, Valor, Quantidade, Data
  if (indices.programa < 0) indices.programa = 0;
  if (indices.tipo < 0) indices.tipo = 1;
  if (indices.valor < 0) indices.valor = 2;
  if (indices.quantidade < 0) indices.quantidade = 3;
  if (indices.data < 0) indices.data = 4;

  return indices;
}

/** Converte "1.234,56" / "10.000" / "1234.56" / "R$ 10,00" em number. */
export function parseNumberBr(raw: string | undefined | null): number {
  if (!raw) return 0;
  let s = raw.trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!s) return 0;

  if (s.includes(",")) {
    // Formato BR: milhar com ponto e decimal com vírgula (ou só vírgula)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Só pontos em grupos de 3 → milhar BR (ex.: 10.000)
    s = s.replace(/\./g, "");
  }
  // Caso contrário mantém decimal com ponto (ex.: 1234.56)

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Aceita DD/MM/YYYY, DD/MM/YY ou YYYY-MM-DD. */
export function parseDateFlexible(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : value;
  }

  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [dia, mes, anoRaw] = parts;
  if (!/^\d{1,2}$/.test(dia) || !/^\d{1,2}$/.test(mes) || !/^\d{2,4}$/.test(anoRaw)) {
    return null;
  }
  const ano = anoRaw.length === 2 ? `20${anoRaw}` : anoRaw;
  const iso = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : iso;
}

/** Mapeia nomes comuns da planilha para o catálogo seed. */
export function normalizarPrograma(programa: string): string {
  const prog = programa.toLowerCase().trim();
  if (prog.includes("all accor") || prog === "accor") return "All Accor";
  if (prog.includes("tudoazul") || prog.includes("tudo azul") || prog.includes("azul")) {
    return "TudoAzul";
  }
  if (prog.includes("livelo")) return "Livelo";
  if (prog.includes("gol") || prog.includes("smiles")) return "Smiles";
  if (prog.includes("esfera")) return "Esfera";
  if (prog.includes("latam")) return "Latam Pass";
  if (prog.includes("iupp")) return "Iupp";
  if (prog.includes("hilton")) return "Hilton Honors";
  if (prog.includes("marriott") || prog.includes("bonvoy")) return "Marriott Bonvoy";
  if (prog.includes("lifemiles") || prog.includes("life miles")) return "LifeMiles";
  if (prog.includes("membership") || prog.includes("amex")) return "Membership Rewards";
  if (prog.includes("itaú") || prog.includes("itau")) return "Pontos Itaú";
  if (prog.includes("atacadão") || prog.includes("atacadao")) return "Atacadão Pontos";
  return programa.trim();
}

export function mapearTipo(tipo: string): TipoMovimentacao {
  const t = tipo.toLowerCase().trim();
  if (t.includes("assinatura") || t.includes("clube")) return "assinatura";
  if (t.includes("transferencia_saida") || t.includes("transferência saída") || t.includes("transf saida")) {
    return "transferencia_saida";
  }
  if (
    t.includes("transferencia_entrada") ||
    t.includes("transferência entrada") ||
    t.includes("transf entrada")
  ) {
    return "transferencia_entrada";
  }
  if (t.includes("transferencia") || t.includes("transferência") || t.includes("transf")) {
    return "transferencia_entrada";
  }
  if (t.includes("resgate") || t.includes("debito") || t.includes("débito") || t.includes("gasto")) {
    return "debito";
  }
  if (t.includes("expiracao") || t.includes("expiração") || t.includes("expirou")) {
    return "expiracao";
  }
  if (t.includes("ajuste") || t.includes("saldo inicial") || t.includes("abertura")) {
    return "ajuste";
  }
  return "credito";
}

export function mapearOrigem(
  tipoRaw: string,
  origemRaw: string | undefined,
  tipo: TipoMovimentacao
): OrigemCredito | null {
  if (TIPOS_NEGATIVOS.includes(tipo) || tipo === "ajuste") return null;

  const fromCol = origemRaw?.toLowerCase().trim();
  if (fromCol) {
    if (fromCol.includes("cartao") || fromCol.includes("cartão")) return "cartao";
    if (fromCol.includes("compra")) return "compra";
    if (fromCol.includes("transf")) return "transferencia";
    if (fromCol.includes("assinatura") || fromCol.includes("clube")) return "assinatura";
    if (fromCol.includes("promo") || fromCol.includes("bonus") || fromCol.includes("bônus")) {
      return "promocao";
    }
    if (fromCol.includes("parceiro")) return "parceiro";
    if (fromCol.includes("ajuste")) return "ajuste";
    return "outro";
  }

  const t = tipoRaw.toLowerCase();
  if (t.includes("assinatura") || t.includes("clube")) return "assinatura";
  if (t.includes("compra")) return "compra";
  if (t.includes("transf")) return "transferencia";
  if (t.includes("bonus") || t.includes("bônus") || t.includes("promo") || t.includes("reativ")) {
    return "promocao";
  }
  if (t.includes("cartao") || t.includes("cartão")) return "cartao";
  if (t.includes("parceiro")) return "parceiro";
  if (tipo === "assinatura") return "assinatura";
  if (tipo === "transferencia_entrada") return "transferencia";
  return "outro";
}

export function rowsFromCsv(text: string): {
  headers: string[];
  rows: CsvRawRow[];
  warnings: string[];
} {
  const { headers, rows: rawRows } = parseCsv(text);
  const warnings: string[] = [];

  if (headers.length === 0) {
    return { headers, rows: [], warnings: ["Arquivo vazio"] };
  }

  const cols = detectColumnIndices(headers);
  if (!headers.some((h) => /programa|fidelida/i.test(h))) {
    warnings.push(
      "Cabeçalho sem coluna de programa detectada — usando ordem: Programa, Tipo, Valor, Quantidade, Data"
    );
  }

  const rows: CsvRawRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const parts = rawRows[i];
    const lineNumber = i + 2; // 1 = header
    const programa = (parts[cols.programa] ?? "").trim();
    const tipoRaw = (parts[cols.tipo] ?? "").trim();
    const dataRaw = (parts[cols.data] ?? "").trim();
    const qtdRaw = parts[cols.quantidade] ?? "";
    const valorRaw = parts[cols.valor] ?? "";
    const descricao = cols.descricao >= 0 ? (parts[cols.descricao] ?? "").trim() : undefined;
    const origemRaw = cols.origem >= 0 ? (parts[cols.origem] ?? "").trim() : undefined;

    if (!programa && !tipoRaw && !dataRaw) continue;

    rows.push({
      lineNumber,
      programa: normalizarPrograma(programa),
      tipoRaw,
      valorPago: Math.abs(parseNumberBr(valorRaw)),
      quantidade: Math.abs(parseNumberBr(qtdRaw)),
      dataRaw,
      descricao: descricao || undefined,
      origemRaw: origemRaw || undefined,
    });
  }

  return { headers, rows, warnings };
}

export const CSV_TEMPLATE = `Programa,Tipo,Valor Pago,Quantidade,Data,Origem,Descricao
Smiles,compra,150.00,10000,15/01/2026,compra,Compra promoção
Livelo,cartao,0,3500,20/01/2026,cartao,Fatura janeiro
Latam Pass,resgate,0,8000,22/01/2026,,Passagem GRU-GIG
TudoAzul,assinatura,49.90,1000,01/02/2026,assinatura,Clube mensal
`;
