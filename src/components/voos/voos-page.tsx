"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Luggage,
  Plane,
  PlaneTakeoff,
  Wallet,
} from "lucide-react";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  milhasDoVoo,
  useResgatesVoo,
  useVoos,
  useVoosRealizados,
  valorPagoDoVoo,
} from "@/lib/queries/voos";
import { cn, formatBRL, formatDate, formatNumber } from "@/lib/utils";

/** `11:00:00` → `11:00` */
function hora(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

type Aba = "resgates" | "realizados";

export function VoosPageClient() {
  const [aba, setAba] = useState<Aba>("resgates");

  return (
    <div>
      <ConfigWarning />

      <PageHeader
        title="Meus Voos"
        description="Trechos resgatados com milhas e trechos já voados"
      />

      <div className="inline-flex items-center gap-1 rounded-lg border p-1 mb-6">
        <button
          type="button"
          onClick={() => setAba("resgates")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            aba === "resgates"
              ? "bg-secondary text-secondary-foreground font-medium"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          Resgates com milhas
        </button>
        <button
          type="button"
          onClick={() => setAba("realizados")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            aba === "realizados"
              ? "bg-secondary text-secondary-foreground font-medium"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          Voos realizados
        </button>
      </div>

      {aba === "resgates" ? <ResgatesTab /> : <RealizadosTab />}
    </div>
  );
}

function ResgatesTab() {
  const { data: voos, isLoading } = useVoos();
  const { data: resgates } = useResgatesVoo();

  const resumo = useMemo(() => {
    const lista = voos ?? [];
    const milhas = lista.reduce((acc, v) => acc + milhasDoVoo(v), 0);
    const pago = lista.reduce((acc, v) => acc + valorPagoDoVoo(v), 0);
    return {
      bilhetes: lista.length,
      milhas,
      pago,
    };
  }, [voos]);

  /** Resgates que existem no extrato mas ainda não têm trecho detalhado. */
  const semDetalhe = useMemo(() => {
    if (!resgates) return [];
    const vinculados = new Set(
      (voos ?? []).map((v) => v.movimentacao?.id).filter((id): id is string => Boolean(id))
    );
    return resgates.filter((r) => !vinculados.has(r.id));
  }, [resgates, voos]);

  const comObservacao = useMemo(() => {
    const vistos = new Set<string>();
    return (voos ?? []).filter((v) => {
      if (!v.observacao) return false;
      const chave = `${v.movimentacao_id ?? v.id}|${v.observacao}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  }, [voos]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!voos || voos.length === 0) {
    return (
      <EmptyState
        icon={Plane}
        title="Nenhum voo resgatado registrado"
        description="Os trechos resgatados aparecem aqui depois de vinculados ao resgate em Movimentações."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          title="Bilhetes"
          value={String(resumo.bilhetes)}
          description="passageiros × trechos"
          icon={PlaneTakeoff}
        />
        <StatCard
          title="Milhas usadas"
          value={formatNumber(resumo.milhas)}
          description="somatório dos resgates"
          icon={Plane}
        />
        <StatCard
          title="Taxas pagas"
          value={formatBRL(resumo.pago)}
          description="embarque dos resgates"
          icon={Wallet}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead>Passageiro</TableHead>
              <TableHead>Programa</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">Milhas</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">Taxas</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">Localizador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {voos.map((voo) => {
              const programa = voo.conta?.programa;
              const milhas = milhasDoVoo(voo);
              const pago = valorPagoDoVoo(voo);
              const saida = hora(voo.hora_saida);
              const chegada = hora(voo.hora_chegada);
              const horario = saida ? `${saida}${chegada ? `–${chegada}` : ""}` : null;
              const vooLabel = [voo.companhia, voo.numero_voo].filter(Boolean).join(" ");
              return (
                <TableRow key={voo.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(voo.data_voo)}
                    {voo.movimentacao?.data && (
                      <div className="text-[10px] text-muted-foreground">
                        resgate {formatDate(voo.movimentacao.data)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium">
                      {voo.origem} → {voo.destino}
                    </div>
                    {(vooLabel || horario) && (
                      <div className="text-xs text-muted-foreground">
                        {[vooLabel, horario].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[22ch]">{voo.passageiro}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {programa ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: programa.cor }}
                        />
                        {programa.nome}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    {formatNumber(milhas)}
                  </TableCell>
                  <TableCell className="font-mono whitespace-nowrap">
                    {pago > 0 ? formatBRL(pago) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {voo.localizador ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <tfoot>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableCell colSpan={4} className="text-xs text-muted-foreground">
                Total · {resumo.bilhetes} {resumo.bilhetes === 1 ? "bilhete" : "bilhetes"}
              </TableCell>
              <TableCell className="font-mono font-semibold whitespace-nowrap">
                {formatNumber(resumo.milhas)}
              </TableCell>
              <TableCell className="font-mono font-semibold whitespace-nowrap">
                {formatBRL(resumo.pago)}
              </TableCell>
              <TableCell />
            </TableRow>
          </tfoot>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Milhas e taxas vêm do resgate vinculado em{" "}
        <Link href="/movimentacoes" className="underline underline-offset-2">
          Movimentações
        </Link>
        . Quando um pedido tem mais de um passageiro, cada um tem sua linha e os valores
        são rateados — a soma continua igual ao total do resgate. As taxas são o valor pago
        no resgate e não incluem o custo de aquisição das milhas.
      </p>

      {comObservacao.length > 0 && (
        <div className="mt-6 rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-2">Observações</h3>
          <ul className="space-y-1.5">
            {comObservacao.map((voo) => (
              <li key={voo.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatDate(voo.data_voo)} · {voo.origem}→{voo.destino}
                  {voo.localizador ? ` (${voo.localizador})` : ""}:
                </span>{" "}
                {voo.observacao}
              </li>
            ))}
          </ul>
        </div>
      )}

      {semDetalhe.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Resgates sem detalhe de voo
          </h3>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Estes débitos são resgates de voo, mas ainda não têm rota/passageiro cadastrados.
          </p>
          <ul className="space-y-1">
            {semDetalhe.map((r) => (
              <li key={r.id} className="text-xs text-muted-foreground font-mono">
                {formatDate(r.data)} · {formatNumber(Math.abs(Number(r.quantidade)))} milhas
                {r.valor_pago ? ` · ${formatBRL(Number(r.valor_pago))}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function RealizadosTab() {
  const { data: voos, isLoading } = useVoosRealizados();

  const resumo = useMemo(() => {
    const lista = voos ?? [];
    return {
      trechos: lista.length,
      viagens: new Set(lista.map((v) => v.localizador).filter(Boolean)).size,
      pontos: lista.reduce((acc, v) => acc + Number(v.pontos ?? 0), 0),
    };
  }, [voos]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!voos || voos.length === 0) {
    return (
      <EmptyState
        icon={Luggage}
        title="Nenhum voo realizado registrado"
        description="Os trechos voados aparecem aqui quando o extrato do programa os credita."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          title="Trechos"
          value={String(resumo.trechos)}
          description="voados e creditados"
          icon={PlaneTakeoff}
        />
        <StatCard
          title="Viagens"
          value={String(resumo.viagens)}
          description="localizadores distintos"
          icon={Luggage}
        />
        <StatCard
          title="Pontos ganhos"
          value={formatNumber(resumo.pontos)}
          description="resgatáveis no período"
          icon={CalendarDays}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Data</TableHead>
              <TableHead>Trecho</TableHead>
              <TableHead className="whitespace-nowrap">Companhia</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">Pontos</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap">Localizador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {voos.map((voo) => (
              <TableRow key={voo.id}>
                <TableCell className="whitespace-nowrap">{formatDate(voo.data)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="font-medium">
                    {voo.origem} → {voo.destino}
                  </div>
                  {(voo.origem_nome || voo.destino_nome) && (
                    <div className="text-xs text-muted-foreground">
                      {voo.origem_nome} → {voo.destino_nome}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {voo.companhia ?? "—"}
                </TableCell>
                <TableCell className="font-mono whitespace-nowrap">
                  {Number(voo.pontos) > 0 ? formatNumber(Number(voo.pontos)) : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {voo.localizador ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableCell colSpan={2} className="text-xs text-muted-foreground">
                Total · {resumo.trechos} {resumo.trechos === 1 ? "trecho" : "trechos"}
              </TableCell>
              <TableCell />
              <TableCell className="font-mono font-semibold whitespace-nowrap">
                {formatNumber(resumo.pontos)}
              </TableCell>
              <TableCell />
            </TableRow>
          </tfoot>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Trechos que o titular voou, lidos do extrato do programa. Não são resgates com
        milhas: a maioria rendeu só pontos de status, então aparece “—” na coluna de pontos.
        O extrato não traz número do voo nem horário.
      </p>
    </>
  );
}
