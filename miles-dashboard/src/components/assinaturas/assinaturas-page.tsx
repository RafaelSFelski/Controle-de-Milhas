"use client";

import { useState } from "react";
import { Plus, Repeat, Trash2, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAssinaturas,
  useCreateAssinatura,
  useDeleteAssinatura,
  useGerarCreditosMes,
  useUpdateAssinaturaStatus,
} from "@/lib/queries/assinaturas";
import { useContas } from "@/lib/queries/contas";
import { custoPorMilheiro } from "@/lib/calculations";
import { formatBRL, formatNumber } from "@/lib/utils";
import type { StatusAssinatura } from "@/types/database";

interface FormValues {
  conta_id: string;
  nome_plano: string;
  valor_mensal: number;
  dia_cobranca: number;
  milhas_mensais: number;
  data_inicio: string;
}

export function AssinaturasPageClient() {
  const { data, isLoading } = useAssinaturas();
  const { data: contas } = useContas();
  const createMut = useCreateAssinatura();
  const deleteMut = useDeleteAssinatura();
  const updateStatusMut = useUpdateAssinaturaStatus();
  const gerarMut = useGerarCreditosMes();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: {
      dia_cobranca: 1,
      data_inicio: new Date().toISOString().slice(0, 10),
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createMut.mutateAsync({
        conta_id: values.conta_id,
        nome_plano: values.nome_plano,
        valor_mensal: Number(values.valor_mensal),
        dia_cobranca: Number(values.dia_cobranca),
        milhas_mensais: Number(values.milhas_mensais),
        data_inicio: values.data_inicio,
      });
      toast.success("Assinatura criada");
      reset({
        dia_cobranca: 1,
        data_inicio: new Date().toISOString().slice(0, 10),
      });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onGerar = async () => {
    try {
      const r = await gerarMut.mutateAsync();
      if (r.criadas > 0) toast.success(`${r.criadas} crédito(s) gerado(s)`);
      else toast.info("Nenhum crédito a gerar — todas as assinaturas já têm crédito do mês");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Assinaturas"
        description="Clubes de milhas e programas de assinatura"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={onGerar} disabled={gerarMut.isPending}>
              <Zap className="h-4 w-4" /> Gerar créditos do mês
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={!contas?.length}>
                  <Plus className="h-4 w-4" /> Nova assinatura
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova assinatura</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Conta *</Label>
                    <Select {...register("conta_id", { required: true })}>
                      <option value="">Selecione...</option>
                      {contas?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titular?.nome} · {c.programa?.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome do plano *</Label>
                    <Input
                      placeholder="Ex: Smiles Clube 5000"
                      {...register("nome_plano", { required: true })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Valor (R$/mês) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register("valor_mensal", { required: true, valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Milhas/mês *</Label>
                      <Input
                        type="number"
                        step="any"
                        {...register("milhas_mensais", { required: true, valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dia cobrança *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        {...register("dia_cobranca", { required: true, valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Início *</Label>
                    <Input type="date" {...register("data_inicio", { required: true })} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={formState.isSubmitting}>
                      Salvar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nenhuma assinatura cadastrada"
          description="Cadastre clubes de fidelidade para acompanhar custo por milha e gerar créditos mensais."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Milhas/mês</TableHead>
                <TableHead className="text-right">R$/milheiro</TableHead>
                <TableHead>Cobrança</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => {
                const cpm = custoPorMilheiro(Number(a.valor_mensal), Number(a.milhas_mensais));
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nome_plano}</TableCell>
                    <TableCell className="text-sm">
                      {a.conta?.programa?.nome}
                      <div className="text-xs text-muted-foreground">
                        {a.conta?.titular?.nome}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(Number(a.valor_mensal))}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(Number(a.milhas_mensais))}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(cpm)}</TableCell>
                    <TableCell>Dia {a.dia_cobranca}</TableCell>
                    <TableCell>
                      <Select
                        value={a.status}
                        onChange={(e) =>
                          updateStatusMut.mutate({
                            id: a.id,
                            status: e.target.value as StatusAssinatura,
                          })
                        }
                        className="h-7 text-xs w-28"
                      >
                        <option value="ativa">Ativa</option>
                        <option value="pausada">Pausada</option>
                        <option value="cancelada">Cancelada</option>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Excluir assinatura?")) return;
                          try {
                            await deleteMut.mutateAsync(a.id);
                            toast.success("Removida");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

