"use client";

import { useMemo } from "react";
import { Calculator } from "lucide-react";
import { useAssinaturas } from "@/lib/queries/assinaturas";
import { useTransferencias } from "@/lib/queries/transferencias";
import { useCotacoesAtuais } from "@/lib/queries/cotacoes";
import { useContas } from "@/lib/queries/contas";
import { useProgramas } from "@/lib/queries/programas";
import { useMovimentacoes } from "@/lib/queries/movimentacoes";
import { formatBRL, formatNumber } from "@/lib/utils";

interface ProgramaCusto {
  programaId: string;
  programaNome: string;
  cor: string;
  totalPago: number;
  totalMilhas: number;
  custoMilheiro: number;
  cotacaoAtual: number | null;
  ganhoPerda: number | null;
  // detalhamento por fonte
  custoAssinaturas: number;
  milhasAssinaturas: number;
  custoTransferencias: number;
  milhasTransferencias: number;
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
  const { data: transferencias } = useTransferencias();
  const { data: cotacoes } = useCotacoesAtuais();
  const { data: contas } = useContas();
  const { data: programas } = useProgramas();
  const { data: todasMovimentacoes } = useMovimentacoes();

  const custosPorPrograma = useMemo((): ProgramaCusto[] => {
    if (!programas || !contas) return [];

    const hoje = new Date().toISOString().slice(0, 10);

    // mapa programaId → acumuladores
    const map = new Map<string, {
      custoAss: number; milhasAss: number;
      custoTransf: number; milhasTransf: number;
      milhasMovs: number; // milhas de contas sem assinatura nem transferência com custo
    }>();

    const getAcc = (id: string) =>
      map.get(id) ?? { custoAss: 0, milhasAss: 0, custoTransf: 0, milhasTransf: 0, milhasMovs: 0 };

    // Conjunto de programas que têm assinatura (para não duplicar milhas via movimentações)
    const programasComAssinatura = new Set<string>();

    // --- 1. Assinaturas ---
    for (const ass of assinaturas ?? []) {
      const programaId = ass.conta?.programa?.id;
      if (!programaId) continue;

      programasComAssinatura.add(programaId);

      const fim = ass.data_fim ?? hoje;
      const meses = mesesEntre(ass.data_inicio, fim);
      const pago = Number(ass.valor_mensal) * meses;
      const milhas =
        (Number(ass.milhas_mensais) + Number(ass.bonus_fixo)) * meses +
        (ass.bonus_adesao_creditado ? Number(ass.bonus_adesao) : 0);

      const acc = getAcc(programaId);
      map.set(programaId, { ...acc, custoAss: acc.custoAss + pago, milhasAss: acc.milhasAss + milhas });
    }

    // --- 2. Transferências com custo ---
    const transferenciasComCusto = new Set<string>(); // conta_destino_id das transferências com custo
    for (const t of transferencias ?? []) {
      const custo = Number(t.custo_reais ?? 0);
      const milhas = Number(t.quantidade_destino ?? 0);
      if (custo <= 0 || milhas <= 0) continue;

      const contaDest = contas.find((c) => c.id === t.conta_destino_id);
      const programaId = contaDest?.programa_id;
      if (!programaId) continue;

      transferenciasComCusto.add(t.conta_destino_id);
      const acc = getAcc(programaId);
      map.set(programaId, { ...acc, custoTransf: acc.custoTransf + custo, milhasTransf: acc.milhasTransf + milhas });
    }

    // --- 3. Movimentações diretas (contas sem assinatura nem custo de transferência registrado) ---
    // Isso garante que programas como All Accor apareçam com seu saldo de milhas
    for (const mov of todasMovimentacoes ?? []) {
      const qtd = Number(mov.quantidade ?? 0);
      if (qtd <= 0) continue; // ignorar débitos

      const conta = contas.find((c) => c.id === mov.conta_id);
      const programaId = conta?.programa_id;
      if (!programaId) continue;

      // Só usar movimentações para programas sem assinatura
      if (programasComAssinatura.has(programaId)) continue;

      const acc = getAcc(programaId);
      map.set(programaId, { ...acc, milhasMovs: acc.milhasMovs + qtd });
    }

    const cotacaoMap = new Map<string, number>();
    cotacoes?.forEach((c) => cotacaoMap.set(c.programa_id, Number(c.valor_milheiro)));

    return Array.from(map.entries())
      .map(([programaId, acc]): ProgramaCusto => {
        const prog = programas.find((p) => p.id === programaId);
        const totalPago = acc.custoAss + acc.custoTransf;
        const totalMilhas = acc.milhasAss + acc.milhasTransf + acc.milhasMovs;
        // Se não há custo registrado, não calcular custo médio (mostrar como sem dados)
        const custoMilheiro = totalPago > 0 && totalMilhas > 0 ? (totalPago / totalMilhas) * 1000 : 0;
        const cotacaoAtual = cotacaoMap.get(programaId) ?? null;
        const ganhoPerda = cotacaoAtual !== null && custoMilheiro > 0 ? cotacaoAtual - custoMilheiro : null;

        return {
          programaId,
          programaNome: prog?.nome ?? programaId,
          cor: prog?.cor ?? "#888",
          totalPago,
          totalMilhas,
          custoMilheiro,
          cotacaoAtual,
          ganhoPerda,
          custoAssinaturas: acc.custoAss,
          milhasAssinaturas: acc.milhasAss,
          custoTransferencias: acc.custoTransf,
          milhasTransferencias: acc.milhasTransf,
        };
      })
      .filter((p) => p.totalMilhas > 0)
      .sort((a, b) => {
        // Programas sem custo vão ao final
        if (a.custoMilheiro === 0 && b.custoMilheiro > 0) return 1;
        if (b.custoMilheiro === 0 && a.custoMilheiro > 0) return -1;
        return a.custoMilheiro - b.custoMilheiro;
      });
  }, [assinaturas, transferencias, cotacoes, contas, programas, todasMovimentacoes]);

  if (!custosPorPrograma.length) return null;

  return (
    <div className="rounded-lg border bg-card mb-6">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Custo médio do milheiro por programa</h2>
        <span className="text-xs text-muted-foreground ml-1">
          (assinaturas + transferências com custo)
        </span>
      </div>

      {/* Cabeçalho da tabela */}
      <div className="hidden sm:grid grid-cols-6 gap-x-4 px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground font-medium">
        <span className="col-span-1">Programa</span>
        <span className="text-right">Total pago</span>
        <span className="text-right">Total milhas</span>
        <span className="text-right">Custo/milheiro</span>
        <span className="text-right">Cotação mercado</span>
        <span className="text-right">Diferença</span>
      </div>

      <div className="divide-y">
        {custosPorPrograma.map((p) => (
          <div key={p.programaId} className="grid grid-cols-2 sm:grid-cols-6 gap-x-4 gap-y-2 px-4 py-3">

            {/* Nome */}
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.cor }}
              />
              <span className="text-sm font-medium">{p.programaNome}</span>
            </div>

            {/* Total pago */}
            <div className="sm:text-right">
              <p className="text-xs text-muted-foreground sm:hidden">Total pago</p>
              <p className="font-mono text-sm">{formatBRL(p.totalPago)}</p>
              {p.custoTransferencias > 0 && (
                <p className="text-xs text-muted-foreground font-mono">
                  ass. {formatBRL(p.custoAssinaturas)} + transf. {formatBRL(p.custoTransferencias)}
                </p>
              )}
            </div>

            {/* Total milhas */}
            <div className="sm:text-right">
              <p className="text-xs text-muted-foreground sm:hidden">Total milhas</p>
              <p className="font-mono text-sm">{formatNumber(p.totalMilhas)}</p>
              {p.milhasTransferencias > 0 && (
                <p className="text-xs text-muted-foreground font-mono">
                  ass. {formatNumber(p.milhasAssinaturas)} + transf. {formatNumber(p.milhasTransferencias)}
                </p>
              )}
            </div>

            {/* Custo médio */}
            <div className="sm:text-right">
              <p className="text-xs text-muted-foreground sm:hidden">Custo/milheiro</p>
              {p.custoMilheiro > 0 ? (
                <p className="font-mono text-sm font-semibold">{formatBRL(p.custoMilheiro)}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Sem custo registrado</p>
              )}
            </div>

            {/* Cotação mercado */}
            <div className="sm:text-right">
              <p className="text-xs text-muted-foreground sm:hidden">Cotação mercado</p>
              <p className="font-mono text-sm">
                {p.cotacaoAtual !== null ? formatBRL(p.cotacaoAtual) : "—"}
              </p>
            </div>

            {/* Diferença */}
            <div className="sm:text-right">
              <p className="text-xs text-muted-foreground sm:hidden">Diferença</p>
              {p.ganhoPerda !== null ? (
                <p className={`font-mono text-sm font-medium ${p.ganhoPerda >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {p.ganhoPerda >= 0 ? "+" : ""}{formatBRL(p.ganhoPerda)}
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
          Diferença positiva indica que o mercado paga mais do que o seu custo médio por milha.
        </p>
      </div>
    </div>
  );
}
