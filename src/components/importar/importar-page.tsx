"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ConfigWarning } from "@/components/shared/config-warning";
import { FieldError } from "@/components/shared/field-error";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CSV_TEMPLATE, rowsFromCsv } from "@/lib/import/csv";
import {
  buildPreviewRows,
  type ContaLookup,
  type PreviewRow,
} from "@/lib/import/preview";
import { useContasComSaldo } from "@/lib/queries/contas";
import { useCreateMovimentacoesBatch } from "@/lib/queries/movimentacoes";
import { useProgramas } from "@/lib/queries/programas";
import { useRegrasValidade } from "@/lib/queries/regras-validade";
import { useTitulares } from "@/lib/queries/titulares";
import { formatBRL, formatDate, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-milhas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportarPage() {
  const { data: contas } = useContasComSaldo();
  const { data: programas } = useProgramas();
  const { data: titulares } = useTitulares();
  const { data: regras } = useRegrasValidade();
  const batchMut = useCreateMovimentacoesBatch();

  const [titularId, setTitularId] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{
    ok: number;
    erros: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const contasLookup: ContaLookup[] = useMemo(
    () =>
      (contas ?? []).map((c) => ({
        id: c.id,
        titular_id: c.titular_id,
        programa_id: c.programa_id,
        titularNome: c.titular?.nome ?? null,
        programaNome: c.programa?.nome ?? null,
        validadeMeses: c.programa?.validade_meses ?? null,
      })),
    [contas]
  );

  const rebuildPreview = useCallback(
    (rawText: string, selectedTitular: string) => {
      const { rows, warnings } = rowsFromCsv(rawText);
      setParseWarnings(warnings);
      const built = buildPreviewRows({
        rawRows: rows,
        programas: programas ?? [],
        contas: contasLookup,
        regras: regras ?? [],
        titularId: selectedTitular || null,
      });
      setPreview(built);
      setImportDone(null);
      return built;
    },
    [programas, contasLookup, regras]
  );

  const [rawCsv, setRawCsv] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        toast.error("Selecione um arquivo .csv");
        return;
      }
      try {
        const text = await file.text();
        setRawCsv(text);
        setFileName(file.name);
        const built = rebuildPreview(text, titularId);
        if (built.length === 0) {
          toast.error("Nenhuma linha válida encontrada no arquivo");
          return;
        }
        toast.success(`${built.length} linha(s) lida(s)`);
      } catch (e) {
        toast.error("Erro ao ler o arquivo CSV");
        console.error(e);
      }
    },
    [rebuildPreview, titularId]
  );

  const onTitularChange = (value: string) => {
    setTitularId(value);
    if (rawCsv) rebuildPreview(rawCsv, value);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };

  const okRows = useMemo(() => preview.filter((r) => r.status === "ok"), [preview]);
  const erroRows = useMemo(() => preview.filter((r) => r.status === "erro"), [preview]);

  const resumo = useMemo(() => {
    const milhasCredito = okRows
      .filter((r) => r.quantidadeAssinada > 0)
      .reduce((s, r) => s + r.quantidadeAssinada, 0);
    const milhasDebito = okRows
      .filter((r) => r.quantidadeAssinada < 0)
      .reduce((s, r) => s + Math.abs(r.quantidadeAssinada), 0);
    const custo = okRows.reduce((s, r) => s + r.valorPago, 0);
    return { milhasCredito, milhasDebito, custo };
  }, [okRows]);

  const handleImport = async () => {
    if (okRows.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }
    if (
      !confirm(
        `Importar ${okRows.length} movimentação(ões)?` +
          (erroRows.length ? `\n${erroRows.length} linha(s) com erro serão ignoradas.` : "")
      )
    ) {
      return;
    }

    setImporting(true);
    setImportDone(null);
    try {
      const payload = okRows.map((r) => ({
        conta_id: r.contaId!,
        tipo: r.tipo,
        quantidade: r.quantidadeAssinada,
        data: r.data!,
        data_expiracao: r.dataExpiracao,
        origem: r.origem,
        descricao: r.descricao,
      }));
      const result = await batchMut.mutateAsync(payload);
      setImportDone({ ok: result.inserted, erros: [] });
      toast.success(`${result.inserted} movimentação(ões) importada(s)`);
      setPreview([]);
      setRawCsv(null);
      setFileName(null);
      setParseWarnings([]);
    } catch (e) {
      const msg = (e as Error).message;
      setImportDone({ ok: 0, erros: [msg] });
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const limpar = () => {
    setPreview([]);
    setRawCsv(null);
    setFileName(null);
    setParseWarnings([]);
    setImportDone(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ConfigWarning />
      <PageHeader
        title="Importar CSV"
        description="Importe extratos ou planilhas de movimentações com preview e validação"
        action={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Baixar modelo
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" />
            Formato esperado
          </CardTitle>
          <CardDescription>
            Colunas: <strong>Programa</strong>, <strong>Tipo</strong>,{" "}
            <strong>Valor Pago</strong> (opcional), <strong>Quantidade</strong>,{" "}
            <strong>Data</strong> (DD/MM/AAAA ou AAAA-MM-DD). Opcionais: Origem, Descricao.
            Aceita vírgula ou ponto-e-vírgula; campos entre aspas.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Conta destino</CardTitle>
          <CardDescription>
            Se houver mais de um titular com o mesmo programa, escolha o titular para
            resolver a conta correta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-w-md">
          <Label htmlFor="titular-import">Titular (opcional)</Label>
          <Select
            id="titular-import"
            value={titularId}
            onChange={(e) => onTitularChange(e.target.value)}
          >
            <option value="">Todos / automático</option>
            {titulares?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
          {!contas?.length && (
            <FieldError error="Cadastre ao menos uma conta antes de importar." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragOver ? "border-primary bg-muted/50" : "border-muted-foreground/25"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void processFile(file);
            }}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInput}
              className="hidden"
              id="csv-input"
            />
            <label
              htmlFor="csv-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {fileName ? fileName : "Clique ou arraste um arquivo CSV"}
              </span>
              <span className="text-xs text-muted-foreground">
                UTF-8 · vírgula ou ponto-e-vírgula
              </span>
            </label>
          </div>

          {parseWarnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-400">
              {parseWarnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Preview</CardTitle>
            <CardDescription>
              Revise as linhas antes de gravar. Créditos recebem data de expiração
              automática pelas regras do programa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-muted-foreground">Válidas</div>
                <div className="text-xl font-bold text-emerald-600">{okRows.length}</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-muted-foreground">Com erro</div>
                <div className="text-xl font-bold text-destructive">{erroRows.length}</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-muted-foreground">Créditos</div>
                <div className="text-xl font-bold">{formatNumber(resumo.milhasCredito)}</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-muted-foreground">Custo (R$)</div>
                <div className="text-xl font-bold">{formatBRL(resumo.custo)}</div>
              </div>
            </div>

            <div className="border rounded-lg overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Programa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => (
                    <TableRow key={r.lineNumber}>
                      <TableCell className="text-muted-foreground">{r.lineNumber}</TableCell>
                      <TableCell>
                        {r.status === "ok" ? (
                          <Badge variant="default">OK</Badge>
                        ) : (
                          <Badge variant="warning">Erro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.programaLabel}</TableCell>
                      <TableCell className="text-xs">{r.tipo}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          r.quantidadeAssinada < 0 ? "text-red-600" : "text-emerald-600"
                        )}
                      >
                        {r.quantidadeAssinada > 0 ? "+" : ""}
                        {formatNumber(r.quantidadeAssinada || r.quantidade)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.data ? formatDate(r.data) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.dataExpiracao ? formatDate(r.dataExpiracao) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.titularNome ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[24ch] truncate">
                        {r.erro ?? r.descricao}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => void handleImport()}
                disabled={importing || okRows.length === 0}
                className="flex-1"
                size="lg"
              >
                {importing
                  ? "Importando..."
                  : `Importar ${okRows.length} movimentação(ões)`}
              </Button>
              <Button variant="outline" onClick={limpar} disabled={importing}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {importDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {importDone.ok > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {importDone.ok > 0 && (
              <p>
                <strong>{importDone.ok}</strong> movimentação(ões) gravada(s) com sucesso.
                O consumo FIFO e os alertas de expiração já consideram os novos créditos.
              </p>
            )}
            {importDone.erros.map((e) => (
              <p key={e} className="text-destructive flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {e}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
