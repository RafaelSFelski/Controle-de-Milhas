"use client";

import { useState } from "react";
import { Gift, Pencil, Plus, Repeat, Trash2, TrendingUp, Zap } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
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
  useUpdateAssinatura,
  useUpdateAssinaturaStatus,
  useUpgradeAssinatura,
} from "@/lib/queries/assinaturas";
import type { AssinaturaJoin } from "@/lib/queries/assinaturas";
import { useContas } from "@/lib/queries/contas";
import { custoPorMilheiro, milhasEfetivasMensais } from "@/lib/calculations";
import {
  assinaturaEditSchema,
  assinaturaSchema,
  assinaturaUpgradeSchema,
  type AssinaturaEditFormValues,
  type AssinaturaFormValues,
  type AssinaturaUpgradeFormValues,
} from "@/lib/schemas";
import { formatBRL, formatNumber } from "@/lib/utils";
import type { StatusAssinatura } from "@/types/database";

export function AssinaturasPageClient() {
  const { data, isLoading } = useAssinaturas();
  const { data: contas } = useContas();
  const createMut = useCreateAssinatura();
  const updateMut = useUpdateAssinatura();
  const upgradeMut = useUpgradeAssinatura();
  const deleteMut = useDeleteAssinatura();
  const updateStatusMut = useUpdateAssinaturaStatus();
  const gerarMut = useGerarCreditosMes();
  const aplicarBonusMut = useAplicarBonusAdesao();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<AssinaturaJoin | null>(null);
  const [upgradingAssinatura, setUpgradingAssinatura] = useState<AssinaturaJoin | null>(null);

  // --- formulário de criação ---
  const form = useForm<AssinaturaFormValues>({
    resolver: zodResolver(assinaturaSchema) as Resolver<AssinaturaFormValues>,
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

  // --- formulário de upgrade ---
  const upgradeForm = useForm<AssinaturaUpgradeFormValues>({
    resolver: zodResolver(assinaturaUpgradeSchema) as Resolver<AssinaturaUpgradeFormValues>,
  });
  const {
    register: regUpgrade,
    handleSubmit: handleUpgradeSubmit,
    reset: resetUpgrade,
    formState: formStateUpgrade,
    control: controlUpgrade,
  } = upgradeForm;

  const watchedUpgrade = useWatch({ control: controlUpgrade });
  const milhasEfetivasUpgrade = milhasEfetivasMensais(
    Number(watchedUpgrade.milhas_mensais) || 0,
    Number(watchedUpgrade.bonus_percentual) || 0,
    Number(watchedUpgrade.bonus_fixo) || 0
  );
  const cpmUpgrade = custoPorMilheiro(
    Number(watchedUpgrade.valor_mensal) || 0,
    Number(watchedUpgrade.milhas_mensais) || 0,
    Number(watchedUpgrade.bonus_percentual) || 0,
    Number(watchedUpgrade.bonus_fixo) || 0
  );

  const onOpenUpgrade = (a: AssinaturaJoin) => {
    setUpgradingAssinatura(a);
    resetUpgrade({
      conta_id: a.conta_id,
      nome_plano: "",
      valor_mensal: Number(a.valor_mensal),
      dia_cobranca: Number(a.dia_cobranca),
      milhas_mensais: Number(a.milhas_mensais),
      data_inicio: new Date().toISOString().slice(0, 10),
      bonus_percentual: Number(a.bonus_percentual ?? 0),
      bonus_fixo: Number(a.bonus_fixo ?? 0),
      bonus_adesao: 0,
      aplicar_bonus_adesao: true,
    });
  };

  const onSubmitUpgrade = async (values: AssinaturaUpgradeFormValues) => {
    if (!upgradingAssinatura) return;
    try {
      await upgradeMut.mutateAsync({
        id_atual: upgradingAssinatura.id,
        conta_id: upgradingAssinatura.conta_id,
        nome_plano: values.nome_plano,
        valor_mensal: Number(values.valor_mensal),
        dia_cobranca: Number(values.dia_cobranca),
        milhas_mensais: Number(values.milhas_mensais),
        data_inicio: values.data_inicio,
        bonus_percentual: Number(values.bonus_percentual ?? 0),
        bonus_fixo: Number(values.bonus_fixo ?? 0),
        bonus_adesao: Number(values.bonus_adesao ?? 0),
        aplicar_bonus_adesao: values.aplicar_bonus_adesao ?? false,
      });
      toast.success("Upgrade realizado com sucesso");
      setUpgradingAssinatura(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // --- formulário de edição ---
  const editForm = useForm<AssinaturaEditFormValues>({
    resolver: zodResolver(assinaturaEditSchema) as Resolver<AssinaturaEditFormValues>,
  });
  const {
    register: regEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: formStateEdit,
  } = editForm;

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

  const onSubmit = async (values: AssinaturaFormValues) => {
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
      setCreateOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onOpenEdit = (a: AssinaturaJoin) => {
    setEditingAssinatura(a);
    resetEdit({
      nome_plano: a.nome_plano,
      valor_mensal: Number(a.valor_mensal),
      dia_cobranca: Number(a.dia_cobranca),
      milhas_mensais: Number(a.milhas_mensais),
      data_inicio: a.data_inicio,
      bonus_percentual: Number(a.bonus_percentual ?? 0),
      bonus_fixo: Number(a.bonus_fixo ?? 0),
      bonus_adesao: Number(a.bonus_adesao ?? 0),
    });
  };

  const onSubmitEdit = async (values: AssinaturaEditFormValues) => {
    if (!editingAssinatura) return;
    try {
      await updateMut.mutateAsync({
        id: editingAssinatura.id,
        nome_plano: values.nome_plano,
        valor_mensal: Number(values.valor_mensal),
        dia_cobranca: Number(values.dia_cobranca),
        milhas_mensais: Number(values.milhas_mensais),
        data_inicio: values.data_inicio,
        bonus_percentual: Number(values.bonus_percentual ?? 0),
        bonus_fixo: Number(values.bonus_fixo ?? 0),
        bonus_adesao: Number(values.bonus_adesao ?? 0),
      });
      toast.success("Assinatura atualizada");
      setEditingAssinatura(null);
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
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                    <Select {...register("conta_id")}>
                      <option value="">Selecione...</option>
                      {contas?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titular?.nome} · {c.programa?.nome}
                        </option>
                      ))}
                    </Select>
                    <FieldError error={formState.errors.conta_id} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome do plano *</Label>
                    <Input
                      placeholder="Ex: Smiles Clube 5000"
                      {...register("nome_plano")}
                    />
                    <FieldError error={formState.errors.nome_plano} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Valor (R$/mês) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register("valor_mensal", { valueAsNumber: true })}
                      />
                      <FieldError error={formState.errors.valor_mensal} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Milhas/mês *</Label>
                      <Input
                        type="number"
                        step="any"
                        {...register("milhas_mensais", { valueAsNumber: true })}
                      />
                      <FieldError error={formState.errors.milhas_mensais} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dia cobrança *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        {...register("dia_cobranca", { valueAsNumber: true })}
                      />
                      <FieldError error={formState.errors.dia_cobranca} />
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
                        <FieldError error={formState.errors.bonus_percentual} />
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
                        <FieldError error={formState.errors.bonus_fixo} />
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
                        <FieldError error={formState.errors.bonus_adesao} />
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
                    <Input type="date" {...register("data_inicio")} />
                    <FieldError error={formState.errors.data_inicio} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
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

      {/* Dialog de upgrade */}
      <Dialog open={!!upgradingAssinatura} onOpenChange={(open) => { if (!open) setUpgradingAssinatura(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Upgrade de plano
            </DialogTitle>
          </DialogHeader>
          {upgradingAssinatura && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm mb-1">
              <span className="text-muted-foreground">Plano atual: </span>
              <span className="font-medium">{upgradingAssinatura.nome_plano}</span>
              <span className="text-muted-foreground ml-2">
                ({formatNumber(Number(upgradingAssinatura.milhas_mensais))} milhas/mês —{" "}
                {formatBRL(Number(upgradingAssinatura.valor_mensal))}/mês)
              </span>
              <div className="text-xs text-amber-600 mt-1">
                O plano atual sera cancelado e um novo sera criado a partir da data de inicio informada.
              </div>
            </div>
          )}
          <form onSubmit={handleUpgradeSubmit(onSubmitUpgrade)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do novo plano *</Label>
              <Input
                placeholder="Ex: Smiles Clube 10000"
                {...regUpgrade("nome_plano")}
              />
              <FieldError error={formStateUpgrade.errors.nome_plano} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$/mês) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...regUpgrade("valor_mensal", { valueAsNumber: true })}
                />
                <FieldError error={formStateUpgrade.errors.valor_mensal} />
              </div>
              <div className="space-y-1.5">
                <Label>Milhas/mês *</Label>
                <Input
                  type="number"
                  step="any"
                  {...regUpgrade("milhas_mensais", { valueAsNumber: true })}
                />
                <FieldError error={formStateUpgrade.errors.milhas_mensais} />
              </div>
              <div className="space-y-1.5">
                <Label>Dia cobranca *</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  {...regUpgrade("dia_cobranca", { valueAsNumber: true })}
                />
                <FieldError error={formStateUpgrade.errors.dia_cobranca} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gift className="h-4 w-4 text-emerald-600" />
                Bonus do novo plano (opcional)
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bonus mensal %</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0"
                    {...regUpgrade("bonus_percentual", { valueAsNumber: true })}
                  />
                  <FieldError error={formStateUpgrade.errors.bonus_percentual} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bonus fixo/mes</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0"
                    {...regUpgrade("bonus_fixo", { valueAsNumber: true })}
                  />
                  <FieldError error={formStateUpgrade.errors.bonus_fixo} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bonus adesao</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0"
                    {...regUpgrade("bonus_adesao", { valueAsNumber: true })}
                  />
                  <FieldError error={formStateUpgrade.errors.bonus_adesao} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" {...regUpgrade("aplicar_bonus_adesao")} />
                Creditar bonus de adesao imediatamente
              </label>
              <div className="text-xs space-y-0.5 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Milhas efetivas/mes:</span>
                  <span className="font-mono font-semibold">{formatNumber(milhasEfetivasUpgrade)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">R$/milheiro efetivo:</span>
                  <span className="font-mono">{formatBRL(cpmUpgrade)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Inicio do novo plano *</Label>
              <Input type="date" {...regUpgrade("data_inicio")} />
              <FieldError error={formStateUpgrade.errors.data_inicio} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpgradingAssinatura(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formStateUpgrade.isSubmitting} className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Confirmar upgrade
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={!!editingAssinatura} onOpenChange={(open) => { if (!open) setEditingAssinatura(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar assinatura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit(onSubmitEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Conta *</Label>
              <Select value={editingAssinatura?.conta_id ?? ""} disabled onChange={() => {}}>
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
                {...regEdit("nome_plano")}
              />
              <FieldError error={formStateEdit.errors.nome_plano} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$/mês) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...regEdit("valor_mensal", { valueAsNumber: true })}
                />
                <FieldError error={formStateEdit.errors.valor_mensal} />
              </div>
              <div className="space-y-1.5">
                <Label>Milhas/mês *</Label>
                <Input
                  type="number"
                  step="any"
                  {...regEdit("milhas_mensais", { valueAsNumber: true })}
                />
                <FieldError error={formStateEdit.errors.milhas_mensais} />
              </div>
              <div className="space-y-1.5">
                <Label>Dia cobrança *</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  {...regEdit("dia_cobranca", { valueAsNumber: true })}
                />
                <FieldError error={formStateEdit.errors.dia_cobranca} />
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
                    {...regEdit("bonus_percentual", { valueAsNumber: true })}
                  />
                  <FieldError error={formStateEdit.errors.bonus_percentual} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bônus fixo/mês</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0"
                    {...regEdit("bonus_fixo", { valueAsNumber: true })}
                  />
                  <FieldError error={formStateEdit.errors.bonus_fixo} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bônus adesão</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="0"
                    {...regEdit("bonus_adesao", { valueAsNumber: true })}
                  />
                  <FieldError error={formStateEdit.errors.bonus_adesao} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Início *</Label>
              <Input type="date" {...regEdit("data_inicio")} />
              <FieldError error={formStateEdit.errors.data_inicio} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingAssinatura(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formStateEdit.isSubmitting}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                        {a.status === "ativa" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Upgrade de plano"
                            title="Fazer upgrade de plano"
                            onClick={() => onOpenUpgrade(a)}
                          >
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => onOpenEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
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
