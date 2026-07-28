"use client";

import { useCallback, useMemo, useState } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ConfigWarning } from "@/components/shared/config-warning";
import { useContas } from "@/lib/queries/contas";
import { useProgramas } from "@/lib/queries/programas";
import { useCreateMovimentacao } from "@/lib/queries/movimentacoes";
import { formatNumber } from "@/lib/utils";
import type { TipoMovimentacao } from "@/types/database";

// Tipos cuja movimentação reduz o saldo (quantidade deve ser negativa).
const TIPOS_NEGATIVOS: TipoMovimentacao[] = [
  "debito",
  "expiracao",
  "transferencia_saida",
];

interface RowData {
  programa: string;
  tipo: string;
  valor_pago: number;
  quantidade: number;
  data: string;
}

/** Mapeia nomes comuns da planilha para os nomes do seed (`0002_seed_programas.sql`). */
function normalizarPrograma(programa: string): string {
  const prog = programa.toLowerCase().trim();
  if (prog.includes("all accor") || prog.includes("accor")) return "All Accor";
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

function parseDataBr(data: string): string | null {
  const parts = data.split("/");
  if (parts.length !== 3) return null;
  const [dia, mes, anoRaw] = parts;
  if (!/^\d{1,2}$/.test(dia) || !/^\d{1,2}$/.test(mes) || !/^\d{2,4}$/.test(anoRaw)) {
    return null;
  }
  const ano = anoRaw.length === 2 ? `20${anoRaw}` : anoRaw;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export function ImportarPage() {
  const { data: contas } = useContas();
  const { data: programas } = useProgramas();
  const createMovMut = useCreateMovimentacao();

  const [rows, setRows] = useState<RowData[]>([]);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);

  // Mapear tipo de movimentação para TipoMovimentacao válido no BD
  // Tipos válidos: "credito" | "debito" | "transferencia_saida" | "transferencia_entrada" | "expiracao" | "assinatura" | "ajuste"
  const mapearTipo = (tipo: string): TipoMovimentacao => {
    const t = tipo.toLowerCase().trim();
    if (t.includes("assinatura")) return "assinatura";
    if (t.includes("transferencia_entrada") || t === "transferencia entrada") return "transferencia_entrada";
    if (t.includes("transferencia_saida") || t === "transferencia saida") return "transferencia_saida";
    if (t.includes("transferencia") || t.includes("transferência")) return "transferencia_entrada";
    if (t.includes("resgate")) return "debito";
    if (t.includes("ajuste")) return "ajuste";
    if (t.includes("expiracao") || t.includes("expiração")) return "expiracao";
    // compra, bonus, reativação, etc. → crédito
    return "credito";
  };

  // Detectar índices de colunas baseado no header
  const detectarColunas = (header: string[]): { [key: string]: number } => {
    const indices: { [key: string]: number } = {
      programa: -1,
      tipo: -1,
      valor: -1,
      quantidade: -1,
      data: -1,
    };

    for (let i = 0; i < header.length; i++) {
      const col = header[i].toLowerCase().trim();
      if (col.includes("programa") || col.includes("fidelida")) indices.programa = i;
      if (col.includes("tipo") || col.includes("tipo de")) indices.tipo = i;
      if (col.includes("valor") || col.includes("pago") || col.includes("r$")) indices.valor = i;
      if (col.includes("quantidade") || col.includes("milhas") || col.includes("pontos")) indices.quantidade = i;
      if (col.includes("data")) indices.data = i;
    }

    return indices;
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split("\n");
        const newRows: RowData[] = [];

        if (lines.length < 2) {
          toast.error("Arquivo vazio");
          return;
        }

        // Parse header
        const headerParts = lines[0].split(",").map((p) => p.trim());
        const colIndices = detectarColunas(headerParts);

        // Validar se encontrou todas as colunas
        if (Object.values(colIndices).some((idx) => idx === -1)) {
          toast.warning(
            "Não foi possível detectar todas as colunas automaticamente. Verifique a ordem: Programa, Tipo, Valor, Quantidade, Data"
          );
        }

        // Processar linhas
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(",").map((p) => p.trim());
          if (parts.length < 5) continue;

          const programa = colIndices.programa >= 0 ? parts[colIndices.programa] : parts[0];
          const tipo = colIndices.tipo >= 0 ? parts[colIndices.tipo] : parts[1];
          const valor = colIndices.valor >= 0 ? parts[colIndices.valor] : parts[2];
          const qtd = colIndices.quantidade >= 0 ? parts[colIndices.quantidade] : parts[3];
          const data = colIndices.data >= 0 ? parts[colIndices.data] : parts[4];

          if (!programa || !tipo || !data) continue;

          // Limpar e parsear valores
          const valorNum = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".")) || 0;
          const qtdNum = parseFloat(qtd.replace(/\./g, "").replace(",", ".")) || 0;

          if (!parseDataBr(data.trim())) continue;

          newRows.push({
            programa: normalizarPrograma(programa),
            tipo: tipo.trim(),
            valor_pago: Math.abs(valorNum),
            quantidade: Math.abs(qtdNum),
            data: data.trim(),
          });
        }

        setRows(newRows);
        toast.success(`Importado: ${newRows.length} linhas`);
      } catch (err) {
        toast.error("Erro ao ler arquivo CSV");
        console.error(err);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (rows.length === 0) {
      toast.error("Nenhuma linha para importar");
      return;
    }

    setImporting(true);
    setImportLog([]);
    const log: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Encontrar a conta do programa (match exato ou parcial)
        const programa = programas?.find(
          (p) =>
            p.nome.toLowerCase() === row.programa.toLowerCase() ||
            p.nome.toLowerCase().includes(row.programa.toLowerCase()) ||
            row.programa.toLowerCase().includes(p.nome.toLowerCase())
        );
        if (!programa) {
          log.push(`❌ Linha ${i + 2}: Programa "${row.programa}" não encontrado`);
          continue;
        }

        const conta = contas?.find((c) => c.programa_id === programa.id);
        if (!conta) {
          log.push(
            `❌ Linha ${i + 2}: Nenhuma conta para programa "${row.programa}"`
          );
          continue;
        }

        const dataFormatada = parseDataBr(row.data);
        if (!dataFormatada) {
          log.push(`❌ Linha ${i + 2}: Data inválida "${row.data}"`);
          continue;
        }

        // Criar movimentação (aplica o sinal correto conforme o tipo)
        const tipoMov = mapearTipo(row.tipo);
        const quantidade = TIPOS_NEGATIVOS.includes(tipoMov)
          ? -Math.abs(row.quantidade)
          : Math.abs(row.quantidade);
        await createMovMut.mutateAsync({
          conta_id: conta.id,
          tipo: tipoMov,
          quantidade,
          data: dataFormatada,
          data_expiracao: null,
          descricao: `Importação: ${row.tipo}`,
        });

        log.push(
          `✅ Linha ${i + 2}: ${formatNumber(row.quantidade)} milhas em ${row.programa}`
        );
      } catch (err) {
        log.push(
          `❌ Linha ${i + 2}: ${(err as Error).message}`
        );
      }
    }

    setImportLog(log);
    setImporting(false);
    toast.success("Importação finalizada");
  }, [rows, programas, contas, createMovMut]);

  const resumo = useMemo(() => {
    return {
      total: rows.length,
      milhas: rows.reduce((acc, r) => acc + r.quantidade, 0),
      custo: rows.reduce((acc, r) => acc + r.valor_pago, 0),
    };
  }, [rows]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ConfigWarning />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar movimentações
          </CardTitle>
          <CardDescription>
            Carregue um arquivo CSV com os dados da sua planilha de controle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-input"
            />
            <label
              htmlFor="csv-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Clique para selecionar arquivo CSV</span>
              <span className="text-xs text-muted-foreground">ou arraste aqui</span>
            </label>
          </div>

          {rows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-sm text-muted-foreground">Linhas</div>
                  <div className="text-2xl font-bold">{resumo.total}</div>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-sm text-muted-foreground">Milhas</div>
                  <div className="text-2xl font-bold">{formatNumber(resumo.milhas)}</div>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-sm text-muted-foreground">Custo total (R$)</div>
                  <div className="text-2xl font-bold">{formatNumber(resumo.custo)}</div>
                </div>
              </div>

              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full"
                size="lg"
              >
                {importing ? "Importando..." : "Importar movimentações"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {importLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da importação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto text-sm font-mono">
              {importLog.map((msg, i) => (
                <div key={i} className="flex items-start gap-2">
                  {msg.startsWith("✅") ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
