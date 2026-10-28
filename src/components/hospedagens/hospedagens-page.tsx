"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertCircle, BedDouble, CalendarDays, Moon, Wallet } from "lucide-react";
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
  pontosDaHospedagem,
  useHospedagens,
  useResgatesEstadia,
  valorDaHospedagem,
} from "@/lib/queries/hospedagens";
import { formatBRL, formatDate, formatNumber } from "@/lib/utils";

/** `São José dos Pinhais` + `PR` + `Brasil` → `São José dos Pinhais · PR` */
function local(h: { cidade: string | null; estado: string | null; pais: string | null }) {
  const cidade = h.cidade?.trim();
  const uf = h.estado?.trim();
  const pais = h.pais?.trim();
  if (!cidade) return pais ?? "—";
  if (uf) return `${cidade} · ${uf}`;
  return pais ? `${cidade} · ${pais}` : cidade;
}

const STATUS_LABEL: Record<string, string> = {
  reservada: "Reservada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function HospedagensPageClient() {
  const { data: hospedagens, isLoading } = useHospedagens();
  const { data: resgates } = useResgatesEstadia();

  const resumo = useMemo(() => {
    const lista = hospedagens ?? [];
    return {
      estadias: lista.length,
      noites: lista.reduce((acc, h) => acc + Number(h.noites ?? 0), 0),
      pontos: lista.reduce((acc, h) => acc + pontosDaHospedagem(h), 0),
      valor: lista.reduce((acc, h) => acc + valorDaHospedagem(h), 0),
    };
  }, [hospedagens]);

  /** Débitos de estadia no extrato que ainda não têm hotel/datas cadastrados. */
  const semDetalhe = useMemo(() => {
    if (!resgates) return [];
    const vinculados = new Set(
      (hospedagens ?? [])
        .map((h) => h.movimentacao?.id)
        .filter((id): id is string => Boolean(id))
    );
    return resgates.filter((r) => !vinculados.has(r.id));
  }, [resgates, hospedagens]);

  const comObservacao = useMemo(
    () => (hospedagens ?? []).filter((h) => h.observacao),
    [hospedagens]
  );

  return (
    <div>
      <ConfigWarning />

      <PageHeader
        title="Minhas Hospedagens"
        description="Estadias registradas: hotel, cidade, noites e pontos usados"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !hospedagens || hospedagens.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="Nenhuma hospedagem registrada"
          description="As estadias aparecem aqui depois de vinculadas ao resgate em Movimentações."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            <StatCard
              title="Hospedagens"
              value={String(resumo.estadias)}
              description="estadias registradas"
              icon={BedDouble}
            />
            <StatCard
              title="Noites"
              value={formatNumber(resumo.noites)}
              description="somatório das estadias"
              icon={Moon}
            />
            <StatCard
              title="Pontos usados"
              value={formatNumber(resumo.pontos)}
              description="resgates vinculados"
              icon={CalendarDays}
            />
            <StatCard
              title="Custo"
              value={formatBRL(resumo.valor)}
              description="valor das estadias em R$"
              icon={Wallet}
            />
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Entrada</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Noites</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Pontos</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Custo</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Localizador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hospedagens.map((h) => {
                  const programa = h.conta?.programa;
                  const pontos = pontosDaHospedagem(h);
                  const valor = valorDaHospedagem(h);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(h.check_in)}
                        <div className="text-[10px] text-muted-foreground">
                          saída {formatDate(h.check_out)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{h.hotel}</div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            h.marca,
                            h.categoria ? `${h.categoria}★` : null,
                            programa?.nome,
                            STATUS_LABEL[h.status] ?? h.status,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {local(h)}
                      </TableCell>
                      <TableCell className="font-mono whitespace-nowrap">
                        {h.noites}
                      </TableCell>
                      <TableCell className="font-mono whitespace-nowrap">
                        {pontos > 0 ? formatNumber(pontos) : "—"}
                      </TableCell>
                      <TableCell className="font-mono whitespace-nowrap">
                        {valor > 0 ? formatBRL(valor) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {h.localizador ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <tfoot>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={3} className="text-xs text-muted-foreground">
                    Total · {resumo.estadias}{" "}
                    {resumo.estadias === 1 ? "hospedagem" : "hospedagens"} ·{" "}
                    {formatNumber(resumo.noites)}{" "}
                    {resumo.noites === 1 ? "noite" : "noites"}
                  </TableCell>
                  <TableCell className="font-mono font-semibold whitespace-nowrap">
                    {resumo.noites}
                  </TableCell>
                  <TableCell className="font-mono font-semibold whitespace-nowrap">
                    {formatNumber(resumo.pontos)}
                  </TableCell>
                  <TableCell className="font-mono font-semibold whitespace-nowrap">
                    {formatBRL(resumo.valor)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </tfoot>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Hotel, datas e localizador vêm da reserva; os pontos vêm do débito vinculado em{" "}
            <Link href="/movimentacoes" className="underline underline-offset-2">
              Movimentações
            </Link>
            . O <strong>custo</strong> é o valor da estadia em R$ (tarifa com impostos) — numa
            estadia paga com pontos, é quanto ela custaria em dinheiro, não o que saiu do bolso.
            Estadia sem valor informado aparece com “—”.
          </p>

          {comObservacao.length > 0 && (
            <div className="mt-6 rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-2">Observações</h3>
              <ul className="space-y-1.5">
                {comObservacao.map((h) => (
                  <li key={h.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatDate(h.check_in)} · {h.hotel}
                      {h.localizador ? ` (${h.localizador})` : ""}:
                    </span>{" "}
                    {h.observacao}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {semDetalhe.length > 0 && (
            <div className="mt-6 rounded-lg border border-dashed p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Resgates sem detalhe de hospedagem
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Estes débitos são estadias pagas com pontos, mas ainda não têm hotel e datas
                cadastrados.
              </p>
              <ul className="space-y-1">
                {semDetalhe.map((r) => (
                  <li key={r.id} className="text-xs text-muted-foreground font-mono">
                    {formatDate(r.data)} · {formatNumber(Math.abs(Number(r.quantidade)))} pontos
                    {r.descricao ? ` · ${r.descricao}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
