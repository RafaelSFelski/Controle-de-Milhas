"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
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

interface FormValues {
  conta_origem_id: string;
  conta_destino_id: string;
  quantidade_origem: number;
  taxa_conversao: number;
  bonus_percentual: number;
  custo_reais: number;
  data: string;
  observacao?: string;
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
    },
  });
  const { register, handleSubmit, control, reset, formState } = form;

  const watched = useWatch({ control });
  const qtdDestino = calcularTransferencia(
    Number(watched.quantidade_origem) || 0,
    Number(watched.taxa_conversao) || 1,
    Number(watched.bonus_percentual) || 0
  );

  const programaDestino = useMemo(() => {
    const conta = contas?.find((c) => c.id === watched.conta_destino_id);
    return programas?.find((p) => p.id === conta?.programa_id);
  }, [contas, programas, watched.conta_destino_id]);

  const onSubmit = async (values: FormValues) => {
    if (values.conta_origem_id === values.conta_destino_id) {
      toast.error("Conta de origem e destino não podem ser iguais");
      return;
    }
    const qtd = Number(values.quantidade_origem);
    const dest = calcularTransferencia(
      qtd,
      Number(values.taxa_conversao),
      Number(values.bonus_percentual)
    );
    try {
      await createMut.mutateAsync({
        conta_origem_id: values.conta_origem_id,
        conta_destino_id: values.conta_destino_id,
        quantidade_origem: qtd,
        quantidade_destino: dest,
        bonus_percentual: Number(values.bonus_percentual),
        taxa_conversao: Number(values.taxa_conversao),
        custo_reais: Number(values.custo_reais ?? 0),
        data: values.data,
        observacao: values.observacao || null,
        validade_meses_destino: programaDestino?.validade_meses,
      });
      toast.success(`Transferência registrada: ${formatNumber(dest)} milhas creditadas`);
      reset({
        taxa_conversao: 1,
        bonus_percentual: 0,
        custo_reais: 0,
        data: new Date().toISOString().slice(0, 10),
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

                <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Milhas no destino:</span>
                    <span className="font-mono font-semibold">{formatNumber(qtdDestino)}</span>
                  </div>
                  {programaDestino && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Validade no destino:</span>
                      <span>{programaDestino.validade_meses} meses</span>
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
                    {Number(t.bonus_percentual) > 0 ? `+${t.bonus_percentual}%` : "—"}
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
