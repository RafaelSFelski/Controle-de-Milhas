"use client";

import { useCallback, useMemo, useState } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useContas } from "@/lib/queries/contas";
import { useProgramas } from "@/lib/queries/programas";
import { useCreateMovimentacao } from "@/lib/queries/movimentacoes";

interface RowData {
  programa: string;
  tipo: string;
  valor_pago: number;
  quantidade: number;
  data: string;
}

export function ImportarPage() {
  const { data: contas } = useContas();
  const { data: programas } = useProgramas();
  const createMovMut = useCreateMovimentacao();

  const [rows, setRows] = useState<RowData[]>([]);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);

  // Mapear tipo de movimentação para o tipo esperado no BD
  const mapearTipo = (tipo: string): string => {
    const tipoBaixo = tipo.toLowerCase().trim();
    if (tipoBaixo.includes("assinatura")) return "assinatura";
    if (tipoBaixo.includes("transferencia")) return "transferencia";
    if (tipoBaixo.includes("compra")) return "compra";
    if (tipoBaixo.includes("resgate")) return "resgate";
    if (tipoBaixo.includes("bonus")) return "bonus";
    if (tipoBaixo.includes("reativação") || tipoBaixo.includes("reativacao")) return "reativacao";
    return tipo;
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

        // Pular header (primeira linha)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Parse CSV simples
          const parts = line.split(",").map((p) => p.trim());
          if (parts.length < 5) continue;

          const [programa, tipo, valor, qtd, data] = parts;
          if (!programa || !tipo) continue;

          const valorNum = parseFloat(valor.replace("R$", "").replace(".", "").replace(",", ".")) || 0;
          const qtdNum = parseFloat(qtd.replace(".", "").replace(",", ".")) || 0;

          newRows.push({
            programa: programa.trim(),
            tipo: tipo.trim(),
            valor_pago: valorNum,
            quantidade: qtdNum,
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
        // Encontrar a conta do programa
        const programa = programas?.find(
          (p) => p.nome.toLowerCase() === row.programa.toLowerCase()
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

        // Validar data
        const dataParts = row.data.split("/");
        if (dataParts.length !== 3) {
          log.push(`❌ Linha ${i + 2}: Data inválida "${row.data}"`);
          continue;
        }
        const [dia, mes, ano] = dataParts;
        const dataFormatada = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;

        // Criar movimentação
        await createMovMut.mutateAsync({
          conta_id: conta.id,
          tipo: mapearTipo(row.tipo),
          quantidade: row.quantidade,
          data: dataFormatada,
          data_expiracao: null,
          descricao: `Importação: ${row.tipo}`,
        });

        // Registrar custo se houver
        if (row.valor_pago > 0) {
          await createMovMut.mutateAsync({
            conta_id: conta.id,
            tipo: "debito",
            quantidade: -row.valor_pago,
            data: dataFormatada,
            data_expiracao: null,
            descricao: `Custo de ${row.tipo}`,
          });
        }

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

  const formatNumber = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
