"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMovimentacoes } from "@/lib/queries/movimentacoes";
import { useTransferencias } from "@/lib/queries/transferencias";
import { formatBRL, formatDate, formatNumber } from "@/lib/utils";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RelatoriosPageClient() {
  const { data: movs } = useMovimentacoes();
  const { data: transferencias } = useTransferencias();

  // Acúmulo vs gasto por mês (12 meses)
  const acumuloVsGasto = useMemo(() => {
    if (!movs) return [];
    const hoje = new Date();
    const meses: Record<string, { mes: string; entrada: number; saida: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const ref = startOfMonth(addMonths(hoje, -i));
      const key = format(ref, "yyyy-MM");
      meses[key] = { mes: format(ref, "MMM/yy", { locale: ptBR }), entrada: 0, saida: 0 };
    }
    for (const m of movs) {
      const key = format(startOfMonth(parseISO(m.data)), "yyyy-MM");
      if (!meses[key]) continue;
      const q = Number(m.quantidade);
      if (q > 0) meses[key].entrada += q;
      else meses[key].saida += -q;
    }
    return Object.values(meses);
  }, [movs]);

  const totalTransf = (transferencias ?? []).reduce(
    (acc, t) => {
      acc.origem += Number(t.quantidade_origem);
      acc.destino += Number(t.quantidade_destino);
      acc.custo += Number(t.custo_reais);
      return acc;
    },
    { origem: 0, destino: 0, custo: 0 }
  );

  const exportTransfCSV = () => {
    if (!transferencias?.length) return;
    const header = [
      "Data",
      "Origem (Titular)",
      "Origem (Programa)",
      "Destino (Titular)",
      "Destino (Programa)",
      "Qtd Origem",
      "Bonus%",
      "Taxa",
      "Qtd Destino",
      "Custo R$",
      "Observação",
    ];
    const rows = transferencias.map((t) => [
      t.data,
      t.conta_origem?.titular?.nome ?? "",
      t.conta_origem?.programa?.nome ?? "",
      t.conta_destino?.titular?.nome ?? "",
      t.conta_destino?.programa?.nome ?? "",
      String(t.quantidade_origem),
      String(t.bonus_percentual),
      String(t.taxa_conversao),
      String(t.quantidade_destino),
      String(t.custo_reais),
      (t.observacao ?? "").replaceAll("\n", " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transferencias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Relatórios"
        description="Análises e exportações"
        action={
          <Button variant="outline" onClick={exportTransfCSV}>
            <Download className="h-4 w-4" /> Exportar transferências (CSV)
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Acúmulo vs Gasto (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {acumuloVsGasto.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}
                <BarChart data={acumuloVsGasto}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(v) => formatNumber(Number(v) || 0)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entrada" name="Acúmulo" fill="#10b981" />
                  <Bar dataKey="saida" name="Gasto" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo de transferências</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total origem</p>
              <p className="font-mono text-lg">{formatNumber(totalTransf.origem)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total destino</p>
              <p className="font-mono text-lg">{formatNumber(totalTransf.destino)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Custo total</p>
              <p className="font-mono text-lg">{formatBRL(totalTransf.custo)}</p>
            </div>
          </div>
          {transferencias && transferencias.length > 0 ? (
            <div className="border rounded-md max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Origem</TableHead>
                    <TableHead className="text-right">Destino</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferencias.slice(0, 50).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.data)}</TableCell>
                      <TableCell className="text-xs">{t.conta_origem?.programa?.nome}</TableCell>
                      <TableCell className="text-xs">{t.conta_destino?.programa?.nome}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(Number(t.quantidade_origem))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(Number(t.quantidade_destino))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem transferências para exibir.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
