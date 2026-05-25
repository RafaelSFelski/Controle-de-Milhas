"use client";

import { useState } from "react";
import { Gift, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  useAplicarBonusAdesao,
  useAssinaturas,
  useCreateAssinatura,
  useDeleteAssinatura,
  useGerarCreditosMes,
  useUpdateAssinaturaStatus,
} from "@/lib/queries/assinaturas";
import { useContas } from "@/lib/queries/contas";
import { custoPorMilheiro, milhasEfetivasMensais } from "@/lib/calculations";
import { formatBRL, formatNumber } from "@/lib/utils";
import type { StatusAssinatura } from "@/types/database";

interface FormValues {
  conta_id: string;
  nome_plano: string;
  valor_mensal: number;
  dia_cobranca: number;
  milhas_mensais: number;
  data_inicio: string;
  bonus_percentual: number;
  bonus_fixo: number;
  bonus_adesao: number;
  aplicar_bonus_adesao: boolean;
}

export function AssinaturasPageClient() {
  const { data, isLoading } = useAssinaturas();
  const { data: contas } = useContas();
  const createMut = useCreateAssinatura();
  const deleteMut = useDeleteAssinatura();
  const updateStatusMut = useUpdateAssinaturaStatus();
  const gerarMut = useGerarCreditosMes();
  const aplicarBonusMut = useAplicarBonusAdesao();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      dia_cobranca: 1,
      data_inicio: new Date().toISOString().slice(0, 10),
      bonus_percentual: 0,
      bonus_fixo: 0,
      bonus_adesao: 0,
      aplicar_bonus_adesao: true,
    },
  });
  const { register, handleSubmit, reset, formState, control } = form;

  const watched = useWatch({ control });
  const milhasEfetivas = milhasEfetivasMensais(
    Number(watched.milhas_mensais) || 0,
    Number(watched.bonus_percentual) || 0,
    Number(watched.bonus_fixo) || 0
  );
  const cpmPreview = custoPorMilheiro(
    Number(watched.valor_mensal) || 0,
    Number(watched.milhas_mensais) || 0,
    Number(watched.bonus_percentual) || 0,
    Number(watched.bonus_fixo) || 0
  );

  const onSubmit = async (values: FormValues) => {
    try {
      await createMut.mutateAsync({
        conta_id: values.conta_id,
        nome_plano: values.nome_plano,
        valor_mensal: Number(values.valor_mensal),
        dia_cobranca: Number(values.dia_cobranca),
        milhas_mensais: Number(values.milhas_mensais),
        data_inicio: values.data_inicio,
        bonus_percentual: Number(values.bonus_percentual ?? 0),
        bonus_fixo: Number(values.bonus_fixo ?? 0),
        bonus_adesao: Number(values.bonus_adesao ?? 0),
        aplicar_bonus_adesao: values.aplicar_bonus_adesao,
      });
      toast.success("Assinatura criada");
      reset({
        dia_cobranca: 1,
        data_inicio: new Date().toISOString().slice(0, 10),
        bonus_percentual: 0,
        bonus_fixo: 0,
        bonus_adesao: 0,
        aplicar_bonus_adesao: true,
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

  const onAplicarBonusAdesao = async (id: string) => {
    try {
      const qtd = await aplicarBonusMut.mutateAsync(id);
      if (qtd > 0) toast.success(`Bônus de adesão aplicado: ${formatNumber(qtd)} milhas`);
      else toast.info("Bônus já creditado anteriormente ou inexistente");
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
              <DialogContent className="max-w-xl">
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

                  <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Gift className="h-4 w-4 text-emerald-600" />
                      Bônus (opcional)
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bônus mensal %</Label>
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          placeholder="0"
                          {...register("bonus_percentual", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bônus fixo/mês</Label>
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          placeholder="0"
                          {...register("bonus_fixo", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bônus adesão</Label>
                        <Input
                          type="number"
                          step="any"
                          min={0}
                          placeholder="0"
                          {...register("bonus_adesao", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" {...register("aplicar_bonus_adesao")} />
                      Creditar bônus de adesão imediatamente
                    </label>
                    <div className="text-xs space-y-0.5 pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Milhas efetivas/mês:</span>
                        <span className="font-mono font-semibold">
                          {formatNumber(milhasEfetivas)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">R$/milheiro efetivo:</span>
                        <span className="font-mono">{formatBRL(cpmPreview)}</span>
                      </div>
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
                <TableHead>Bônus</TableHead>
                <TableHead className="text-right">Efetivas/mês</TableHead>
                <TableHead className="text-right">R$/milheiro</TableHead>
                <TableHead>Cobrança</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => {
                const bonusPct = Number(a.bonus_percentual ?? 0);
                const bonusFix = Number(a.bonus_fixo ?? 0);
                const bonusAdesao = Number(a.bonus_adesao ?? 0);
                const efetivas = milhasEfetivasMensais(
                  Number(a.milhas_mensais),
                  bonusPct,
                  bonusFix
                );
                const cpm = custoPorMilheiro(
                  Number(a.valor_mensal),
                  Number(a.milhas_mensais),
                  bonusPct,
                  bonusFix
                );
                const temBonusMensal = bonusPct > 0 || bonusFix > 0;
                const temBonusAdesaoPendente =
                  bonusAdesao > 0 && !a.bonus_adesao_creditado;

                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nome_plano}</TableCell>
                    <TableCell className="text-sm">
                      {a.conta?.programa?.nome}
                      <div className="text-xs text-muted-foreground">
                        {a.conta?.titular?.nome}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBRL(Number(a.valor_mensal))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(Number(a.milhas_mensais))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {temBonusMensal || bonusAdesao > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {bonusPct > 0 && (
                            <Badge variant="success" className="w-fit">
                              +{bonusPct}%
                            </Badge>
                          )}
                          {bonusFix > 0 && (
                            <Badge variant="success" className="w-fit">
                              +{formatNumber(bonusFix)}/mês
                            </Badge>
                          )}
                          {bonusAdesao > 0 && (
                            <Badge
                              variant={a.bonus_adesao_creditado ? "outline" : "warning"}
                              className="w-fit"
                            >
                              Adesão: {formatNumber(bonusAdesao)}
                              {a.bonus_adesao_creditado ? " ✓" : ""}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(efetivas)}
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
                      <div className="flex gap-1">
                        {temBonusAdesaoPendente && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Aplicar bônus de adesão"
                            onClick={() => onAplicarBonusAdesao(a.id)}
                            disabled={aplicarBonusMut.isPending}
                          >
                            <Gift className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
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
                      </div>
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
