"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateTransferencia,
  useDeleteTransferencia,
  useTransferencias,
} from "@/lib/queries/transferencias";
import { useContasComSaldo } from "@/lib/queries/contas";
import { useProgramas } from "@/lib/queries/programas";
import { calcularTransferencia } from "@/lib/calculations";
import { formatBRL, formatDate, formatNumber } from "@/lib/utils";

// Programas que permitem compra de pontos para transferência
const PROGRAMAS_COMPRA_PONTOS = ["esfera", "livelo"];

interface FormValues {
  conta_origem_id: string;
  conta_destino_id: string;
  quantidade_origem: number;
  taxa_conversao: number;
  bonus_percentual: number;
  custo_reais: number;
  data: string;
  observacao?: string;
  // Compra de pontos (Esfera / Livelo)
  comprar_pontos: boolean;
  pontos_comprados: number;
  valor_total_compra: number;
}

export function TransferenciasPageClient() {
  const { data: transferencias, isLoading } = useTransferencias();
  const { data: contas } = useContasComSaldo();
  const { data: programas } = useProgramas();
  const createMut = useCreateTransferencia();
  const deleteMut = useDeleteTransferencia();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      taxa_conversao: 1,
      bonus_percentual: 0,
      custo_reais: 0,
      data: new Date().toISOString().slice(0, 10),
      comprar_pontos: false,
      pontos_comprados: 0,
      valor_total_compra: 0,
    },
  });
  const { register, handleSubmit, control, reset, formState } = form;

  const watched = useWatch({ control });
  const qtdDestino = calcularTransferencia(
    Number(watched.quantidade_origem) || 0,
    Number(watched.taxa_conversao) || 1,
    Number(watched.bonus_percentual) || 0
  );

  const programaOrigem = useMemo(() => {
    const conta = contas?.find((c) => c.id === watched.conta_origem_id);
    return programas?.find((p) => p.id === conta?.programa_id);
  }, [contas, programas, watched.conta_origem_id]);

  const programaDestino = useMemo(() => {
    const conta = contas?.find((c) => c.id === watched.conta_destino_id);
    return programas?.find((p) => p.id === conta?.programa_id);
  }, [contas, programas, watched.conta_destino_id]);

  // Verifica se o programa de origem suporta compra de pontos
  const permiteCompraPontos = useMemo(() => {
    if (!programaOrigem) return false;
    return PROGRAMAS_COMPRA_PONTOS.some((p) =>
      programaOrigem.nome.toLowerCase().includes(p)
    );
  }, [programaOrigem]);

  // Custo da compra de pontos
  const custoPontosComprados = useMemo(() => {
    if (!watched.comprar_pontos) return 0;
    return Number(watched.valor_total_compra) || 0;
  }, [watched.comprar_pontos, watched.valor_total_compra]);

  // Quantidade total de pontos na origem (transferidos + comprados)
  const totalPontosOrigem = useMemo(() => {
    const base = Number(watched.quantidade_origem) || 0;
    if (!watched.comprar_pontos) return base;
    return base + (Number(watched.pontos_comprados) || 0);
  }, [watched.comprar_pontos, watched.quantidade_origem, watched.pontos_comprados]);

  // Quantidade de milhas no destino considerando pontos comprados
  const qtdDestinoTotal = calcularTransferencia(
    totalPontosOrigem,
    Number(watched.taxa_conversao) || 1,
    Number(watched.bonus_percentual) || 0
  );

  // Custo total = custo manual + custo dos pontos comprados
  const custoTotal = (Number(watched.custo_reais) || 0) + custoPontosComprados;

  const onSubmit = async (values: FormValues) => {
    if (values.conta_origem_id === values.conta_destino_id) {
      toast.error("Conta de origem e destino não podem ser iguais");
      return;
    }
    const pontosComprados = values.comprar_pontos ? (Number(values.pontos_comprados) || 0) : 0;
    const qtdOrigem = Number(values.quantidade_origem) + pontosComprados;
    const custoPontos = values.comprar_pontos ? (Number(values.valor_total_compra) || 0) : 0;
    const custoTotal = Number(values.custo_reais ?? 0) + custoPontos;
    const dest = calcularTransferencia(
      qtdOrigem,
      Number(values.taxa_conversao),
      Number(values.bonus_percentual)
    );
    const obs = [
      values.observacao,
      pontosComprados > 0
        ? `Compra de ${formatNumber(pontosComprados)} pontos (${formatBRL(custoPontos)})`
        : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;
    try {
      await createMut.mutateAsync({
        conta_origem_id: values.conta_origem_id,
        conta_destino_id: values.conta_destino_id,
        quantidade_origem: qtdOrigem,
        quantidade_destino: dest,
        bonus_percentual: Number(values.bonus_percentual),
        taxa_conversao: Number(values.taxa_conversao),
        custo_reais: custoTotal,
        data: values.data,
        observacao: obs,
        validade_meses_destino: programaDestino?.validade_meses,
      });
      toast.success(`Transferência registrada: ${formatNumber(dest)} milhas creditadas`);
      reset({
        taxa_conversao: 1,
        bonus_percentual: 0,
        custo_reais: 0,
        data: new Date().toISOString().slice(0, 10),
        comprar_pontos: false,
        pontos_comprados: 0,
        valor_total_compra: 0,
      });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir transferência? As movimentações relacionadas serão removidas."))
      return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Transferência removida");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const semContas = !contas || contas.length < 2;

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Transferências"
        description="Movimentações entre programas com cálculo automático de bônus"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={semContas}>
                <Plus className="h-4 w-4" /> Nova transferência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Nova transferência</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Conta origem *</Label>
                    <Select {...register("conta_origem_id", { required: true })}>
                      <option value="">Selecione...</option>
                      {contas?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titular?.nome} · {c.programa?.nome} ({formatNumber(c.saldo_atual ?? 0)})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta destino *</Label>
                    <Select {...register("conta_destino_id", { required: true })}>
                      <option value="">Selecione...</option>
                      {contas?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titular?.nome} · {c.programa?.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label>Qtd origem *</Label>
                    <Input
                      type="number"
                      step="any"
                      {...register("quantidade_origem", { required: true, valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Taxa conv.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("taxa_conversao", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bônus %</Label>
                    <Input
                      type="number"
                      step="any"
                      {...register("bonus_percentual", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo R$</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("custo_reais", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Data *</Label>
                  <Input type="date" {...register("data", { required: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Observação</Label>
                  <Textarea {...register("observacao")} rows={2} />
                </div>

                {/* Seção de compra de pontos — Esfera / Livelo */}
                {permiteCompraPontos && (
                  <div className="rounded-md border p-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded"
                        {...register("comprar_pontos")}
                      />
                      <ShoppingCart className="h-4 w-4 text-emerald-600" />
                      Comprar pontos {programaOrigem?.nome} para transferir
                    </label>
                    {watched.comprar_pontos && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Pontos a comprar</Label>
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="0"
                            {...register("pontos_comprados", { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Valor total pago (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0,00"
                            {...register("valor_total_compra", { valueAsNumber: true })}
                          />
                        </div>
                        <div className="col-span-2 rounded bg-muted/50 px-3 py-2 text-xs space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preço unitário:</span>
                            <span className="font-mono">
                              {(Number(watched.pontos_comprados) || 0) > 0
                                ? formatBRL((Number(watched.valor_total_compra) || 0) / (Number(watched.pontos_comprados) || 1))
                                : "—"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total de pontos na origem:</span>
                            <span className="font-mono">{formatNumber(totalPontosOrigem)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Milhas no destino:</span>
                    <span className="font-mono font-semibold">{formatNumber(qtdDestinoTotal)}</span>
                  </div>
                  {programaDestino && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Validade no destino:</span>
                      <span>{programaDestino.validade_meses} meses</span>
                    </div>
                  )}
                  {custoTotal > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Custo total:</span>
                      <span className="font-mono">{formatBRL(custoTotal)}</span>
                    </div>
                  )}
                  {watched.comprar_pontos && custoTotal > 0 && qtdDestinoTotal > 0 && (
                    <div className="flex justify-between text-xs border-t pt-1 mt-1">
                      <span className="text-muted-foreground">R$/milheiro efetivo:</span>
                      <span className="font-mono">
                        {formatBRL((custoTotal / qtdDestinoTotal) * 1000)}
                      </span>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={formState.isSubmitting}>
                    Registrar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !transferencias || transferencias.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma transferência registrada"
          description="Registre transferências entre programas para acompanhar bônus e cálculos automáticos."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Qtd Origem</TableHead>
                <TableHead className="text-right">Bônus</TableHead>
                <TableHead className="text-right">Qtd Destino</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferencias.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.data)}</TableCell>
                  <TableCell className="text-sm">
                    {t.conta_origem?.programa?.nome}
                    <div className="text-xs text-muted-foreground">
                      {t.conta_origem?.titular?.nome}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.conta_destino?.programa?.nome}
                    <div className="text-xs text-muted-foreground">
                      {t.conta_destino?.titular?.nome}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(t.quantidade_origem)}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(t.bonus_percentual) > 0 ? `+${t.bonus_percentual}%` : "���"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatNumber(t.quantidade_destino)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {Number(t.custo_reais) > 0 ? formatBRL(Number(t.custo_reais)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
