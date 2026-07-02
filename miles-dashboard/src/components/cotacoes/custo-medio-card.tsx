"use client";

import { useMemo } from "react";
import { Calculator } from "lucide-react";
import { useAssinaturas } from "@/lib/queries/assinaturas";
import { useCotacoesAtuais } from "@/lib/queries/cotacoes";
import { useProgramas } from "@/lib/queries/programas";
import { formatBRL } from "@/lib/utils";

interface ProgramaCusto {
  programaId: string;
  programaNome: string;
  cor: string;
  totalPago: number;
  totalMilhas: number;
  custoMilheiro: number;
  cotacaoAtual: number | null;
  ganhoPerda: number | null; // diferença entre cotação mercado e custo médio
}

function mesesEntre(inicio: string, fim: string): number {
  const d1 = new Date(inicio);
  const d2 = new Date(fim);
  return Math.max(
    1,
    (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1
  );
}

export function CustoMedioCard() {
  const { data: assinaturas } = useAssinaturas();
  const { data: cotacoes } = useCotacoesAtuais();
  const { data: programas } = useProgramas();

  const custosPorPrograma = useMemo((): ProgramaCusto[] => {
    if (!assinaturas || !programas) return [];

    const hoje = new Date().toISOString().slice(0, 10);

    // Agrupa por programa
    const map = new Map<string, { totalPago: number; totalMilhas: number }>();

    for (const ass of assinaturas) {
      const programaId = ass.conta.programa.id;
      const fim = ass.data_fim ?? hoje;
      const meses = mesesEntre(ass.data_inicio, fim);

      const pago = ass.valor_mensal * meses;
      // Milhas mensais + bônus fixo por mês + bônus de adesão (one-time)
      const milhas =
        (ass.milhas_mensais + ass.bonus_fixo) * meses +
        (ass.bonus_adesao_creditado ? ass.bonus_adesao : 0);

      const atual = map.get(programaId) ?? { totalPago: 0, totalMilhas: 0 };
      map.set(programaId, {
        totalPago: atual.totalPago + pago,
        totalMilhas: atual.totalMilhas + milhas,
      });
    }

    const cotacaoMap = new Map<string, number>();
    cotacoes?.forEach((c) => cotacaoMap.set(c.programa_id, Number(c.valor_milheiro)));

    return Array.from(map.entries())
      .map(([programaId, { totalPago, totalMilhas }]): ProgramaCusto => {
        const prog = programas.find((p) => p.id === programaId);
        const custoMilheiro = totalMilhas > 0 ? (totalPago / totalMilhas) * 1000 : 0;
        const cotacaoAtual = cotacaoMap.get(programaId) ?? null;
        const ganhoPerda =
          cotacaoAtual !== null ? cotacaoAtual - custoMilheiro : null;

        return {
          programaId,
          programaNome: prog?.nome ?? programaId,
          cor: prog?.cor ?? "#888",
          totalPago,
          totalMilhas,
          custoMilheiro,
          cotacaoAtual,
          ganhoPerda,
        };
      })
      .filter((p) => p.totalMilhas > 0)
      .sort((a, b) => a.custoMilheiro - b.custoMilheiro);
  }, [assinaturas, cotacoes, programas]);

  if (!custosPorPrograma.length) return null;

  return (
    <div className="rounded-lg border bg-card mb-6">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Custo médio do milheiro por programa</h2>
        <span className="text-xs text-muted-foreground ml-1">(baseado nas assinaturas)</span>
      </div>
      <div className="divide-y">
        {custosPorPrograma.map((p) => (
          <div key={p.programaId} className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 px-4 py-3">
            {/* Nome */}
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.cor }}
              />
              <span className="text-sm font-medium">{p.programaNome}</span>
            </div>

            {/* Custo médio */}
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Custo médio/milheiro</p>
              <p className="font-mono text-sm font-semibold">
                {formatBRL(p.custoMilheiro)}
              </p>
            </div>

            {/* Cotação de mercado */}
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Cotação mercado</p>
              <p className="font-mono text-sm">
                {p.cotacaoAtual !== null ? formatBRL(p.cotacaoAtual) : "—"}
              </p>
            </div>

            {/* Ganho/perda */}
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Diferença</p>
              {p.ganhoPerda !== null ? (
                <p
                  className={`font-mono text-sm font-medium ${
                    p.ganhoPerda >= 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {p.ganhoPerda >= 0 ? "+" : ""}
                  {formatBRL(p.ganhoPerda)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t bg-muted/30 rounded-b-lg">
        <p className="text-xs text-muted-foreground">
          Diferença positiva significa que o mercado paga mais do que você pagou pela milha.
        </p>
      </div>
    </div>
  );
}
