"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Coins,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { ConfigWarning } from "@/components/shared/config-warning";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "./stat-card";
import { DistribuicaoChart } from "./distribuicao-chart";
import { EvolucaoChart } from "./evolucao-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContasComSaldo } from "@/lib/queries/contas";
import {
  useMovimentacoes,
  useExpiracoes,
  useMilhasExpirando,
} from "@/lib/queries/movimentacoes";
import { useTransferencias } from "@/lib/queries/transferencias";
import { useCotacoesAtuais } from "@/lib/queries/cotacoes";
import { useAssinaturas } from "@/lib/queries/assinaturas";
import { valorEstimadoCarteira } from "@/lib/calculations";
import { formatBRL, formatDate, formatNumber } from "@/lib/utils";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DashboardClient() {
  const { data: contas } = useContasComSaldo();
  const { data: movs } = useMovimentacoes();
  const { data: expiracoes } = useExpiracoes(5);
  const { data: expirandoProx90 = 0 } = useMilhasExpirando(90);
  const { data: transferencias } = useTransferencias();
  const { data: cotacoes } = useCotacoesAtuais();
  const { data: assinaturas } = useAssinaturas();

  const totalMilhas = (contas ?? []).reduce((s, c) => s + (c.saldo_atual ?? 0), 0);

  const valorCarteira = useMemo(() => {
    if (!contas || !cotacoes) return 0;
    const cotMap: Record<string, number> = {};
    cotacoes.forEach((c) => {
      cotMap[c.programa_id] = Number(c.valor_milheiro);
    });
    return valorEstimadoCarteira(
      contas.map((c) => ({ programa_id: c.programa_id, saldo: c.saldo_atual ?? 0 })),
      cotMap
    );
  }, [contas, cotacoes]);

  const transfMes = useMemo(() => {
    if (!transferencias) return 0;
    const inicio = startOfMonth(new Date());
    return transferencias.filter((t) => parseISO(t.data) >= inicio).length;
  }, [transferencias]);

  // Agrupar por programa para gráfico de pizza
  const distribuicao = useMemo(() => {
    if (!contas) return [];
    const map = new Map<string, { name: string; value: number; color: string }>();
    for (const c of contas) {
      if (!c.programa) continue;
      const cur = map.get(c.programa.id) ?? {
        name: c.programa.nome,
        value: 0,
        color: c.programa.cor,
      };
      cur.value += c.saldo_atual ?? 0;
      map.set(c.programa.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [contas]);

  // Evolução: saldo acumulado por mês nos últimos 12 meses
  const evolucao = useMemo(() => {
    if (!movs) return [];
    const hoje = new Date();
    const result: Array<{ mes: string; saldo: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const ref = startOfMonth(addMonths(hoje, -i));
      const fimMes = startOfMonth(addMonths(ref, 1));
      const acum = movs
        .filter((m) => parseISO(m.data) < fimMes)
        .reduce((s, m) => s + Number(m.quantidade), 0);
      result.push({
        mes: format(ref, "MMM/yy", { locale: ptBR }),
        saldo: Math.round(acum),
      });
    }
    return result;
  }, [movs]);

  const proximasExpiracoes = expiracoes ?? [];

  const proximasCobrancas = useMemo(() => {
    if (!assinaturas) return [];
    const hoje = new Date();
    const dia = hoje.getDate();
    return assinaturas
      .filter((a) => a.status === "ativa")
      .map((a) => {
        const proxima = new Date(hoje.getFullYear(), hoje.getMonth(), a.dia_cobranca);
        if (a.dia_cobranca < dia) proxima.setMonth(proxima.getMonth() + 1);
        return { ...a, proxima };
      })
      .sort((a, b) => a.proxima.getTime() - b.proxima.getTime())
      .slice(0, 5);
  }, [assinaturas]);

  return (
    <div>
      <ConfigWarning />
      <PageHeader title="Dashboard" description="Visão geral da sua carteira de milhas" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total de milhas"
          value={formatNumber(totalMilhas)}
          icon={Wallet}
          iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
        />
        <StatCard
          title="Valor estimado"
          value={formatBRL(valorCarteira)}
          description={cotacoes?.length ? undefined : "Sem cotações cadastradas"}
          icon={Coins}
          iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <StatCard
          title="Expirando em 90 dias"
          value={formatNumber(expirandoProx90)}
          icon={AlertTriangle}
          iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        />
        <StatCard
          title="Transferências este mês"
          value={String(transfMes)}
          icon={ArrowLeftRight}
          iconClassName="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DistribuicaoChart data={distribuicao} />
        <EvolucaoChart data={evolucao} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Próximas expirações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximasExpiracoes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sem milhas com data de expiração próxima.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {proximasExpiracoes.map((e) => {
                  const conta = contas?.find((c) => c.id === e.conta_id);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{conta?.programa?.nome ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conta?.titular?.nome}
                          {e.descricao ? ` · ${e.descricao}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono">
                          {formatNumber(Number(e.quantidade_restante ?? e.quantidade))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.data_expiracao ? formatDate(e.data_expiracao) : "—"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-500" />
              Próximas cobranças (assinaturas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximasCobrancas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma assinatura ativa.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {proximasCobrancas.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.nome_plano}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.conta?.programa?.nome} · {a.conta?.titular?.nome}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono">{formatBRL(Number(a.valor_mensal))}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(a.proxima, "dd/MM")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
