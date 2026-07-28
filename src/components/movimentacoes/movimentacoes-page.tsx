"use client";

import { useMemo, useState } from "react";
import { Activity, Pencil, Plus, Trash2 } from "lucide-react";
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
  useCreateMovimentacao,
  useDeleteMovimentacao,
  useMovimentacoes,
  useUpdateMovimentacao,
} from "@/lib/queries/movimentacoes";
import type { Movimentacao } from "@/types/database";
import {
  useContasComSaldo,
  type ContaComSaldo,
} from "@/lib/queries/contas";
import { calcularDataExpiracao } from "@/lib/calculations";
import { useRegrasValidade } from "@/lib/queries/regras-validade";
import { ORIGENS_CREDITO, labelOrigem, resolverValidadeMeses } from "@/lib/validade";
import { formatDate, formatNumber } from "@/lib/utils";
import type { OrigemCredito, TipoMovimentacao } from "@/types/database";

interface FormValues {
  conta_id: string;
  tipo: "credito" | "debito" | "ajuste" | "expiracao";
  quantidade: number;
  data: string;
  data_expiracao?: string;
  origem?: OrigemCredito;
  descricao?: string;
  calcular_expiracao_auto?: boolean;
}

const TIPOS: Record<TipoMovimentacao, { label: string; variant: "default" | "secondary" | "warning" | "outline" }> = {
  credito: { label: "Crédito", variant: "default" },
  debito: { label: "Débito", variant: "secondary" },
  transferencia_saida: { label: "Transf. saída", variant: "secondary" },
  transferencia_entrada: { label: "Transf. entrada", variant: "default" },
  expiracao: { label: "Expiração", variant: "warning" },
  assinatura: { label: "Assinatura", variant: "default" },
  ajuste: { label: "Ajuste", variant: "outline" },
};

export function MovimentacoesPageClient() {
  const { data: movs, isLoading } = useMovimentacoes();
  const { data: contas } = useContasComSaldo();
  const { data: regrasValidade } = useRegrasValidade();
  const createMut = useCreateMovimentacao();
  const updateMut = useUpdateMovimentacao();
  const deleteMut = useDeleteMovimentacao();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMov, setEditingMov] = useState<Movimentacao | null>(null);

  // --- formulário de criação ---
  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({
    defaultValues: {
      tipo: "credito",
      data: new Date().toISOString().slice(0, 10),
      calcular_expiracao_auto: true,
      origem: "cartao",
    },
  });

  const tipo = useWatch({ control, name: "tipo" });
  const contaId = useWatch({ control, name: "conta_id" });
  const origem = useWatch({ control, name: "origem" });
  const calcAuto = useWatch({ control, name: "calcular_expiracao_auto" });
  const dataMov = useWatch({ control, name: "data" });

  const contaSel = contas?.find((c) => c.id === contaId);
  const regrasConta = useMemo(
    () => (regrasValidade ?? []).filter((r) => r.programa_id === contaSel?.programa_id),
    [regrasValidade, contaSel?.programa_id]
  );
  const validadePadrao = contaSel?.programa?.validade_meses ?? 24;
  const validade = resolverValidadeMeses(regrasConta, origem, validadePadrao);
  const expCalc =
    tipo === "credito" && calcAuto && dataMov
      ? calcularDataExpiracao(dataMov, validade).toISOString().slice(0, 10)
      : undefined;

  const onSubmitCreate = async (values: FormValues) => {
    const isDeb = values.tipo === "debito" || values.tipo === "expiracao";
    const qtd = isDeb ? -Math.abs(Number(values.quantidade)) : Math.abs(Number(values.quantidade));
    let exp: string | null = null;
    if (values.tipo === "credito") {
      if (values.calcular_expiracao_auto && values.data) {
        exp = calcularDataExpiracao(values.data, validade).toISOString().slice(0, 10);
      } else if (values.data_expiracao) {
        exp = values.data_expiracao;
      }
    }
    try {
      await createMut.mutateAsync({
        conta_id: values.conta_id,
        tipo: values.tipo,
        quantidade: qtd,
        data: values.data,
        data_expiracao: exp,
        origem: values.tipo === "credito" ? values.origem ?? "cartao" : null,
        descricao: values.descricao || null,
      });
      toast.success("Movimentação registrada");
      reset({
        tipo: "credito",
        data: new Date().toISOString().slice(0, 10),
        calcular_expiracao_auto: true,
        origem: "cartao",
      });
      setCreateOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // --- formulário de edição ---
  const {
    register: regEdit,
    handleSubmit: handleEdit,
    control: controlEdit,
    reset: resetEdit,
    formState: formStateEdit,
  } = useForm<FormValues>();

  const tipoEdit = useWatch({ control: controlEdit, name: "tipo" });
  const contaIdEdit = useWatch({ control: controlEdit, name: "conta_id" });
  const origemEdit = useWatch({ control: controlEdit, name: "origem" });
  const calcAutoEdit = useWatch({ control: controlEdit, name: "calcular_expiracao_auto" });
  const dataMovEdit = useWatch({ control: controlEdit, name: "data" });

  const contaSelEdit = contas?.find((c) => c.id === contaIdEdit);
  const regrasContaEdit = useMemo(
    () => (regrasValidade ?? []).filter((r) => r.programa_id === contaSelEdit?.programa_id),
    [regrasValidade, contaSelEdit?.programa_id]
  );
  const validadePadraoEdit = contaSelEdit?.programa?.validade_meses ?? 24;
  const validadeEdit = resolverValidadeMeses(regrasContaEdit, origemEdit, validadePadraoEdit);
  const expCalcEdit =
    tipoEdit === "credito" && calcAutoEdit && dataMovEdit
      ? calcularDataExpiracao(dataMovEdit, validadeEdit).toISOString().slice(0, 10)
      : undefined;

  const onOpenEdit = (mov: Movimentacao) => {
    setEditingMov(mov);
    const absQtd = Math.abs(Number(mov.quantidade));
    resetEdit({
      conta_id: mov.conta_id,
      tipo: (["credito", "debito", "ajuste", "expiracao"].includes(mov.tipo)
        ? mov.tipo
        : "ajuste") as FormValues["tipo"],
      quantidade: absQtd,
      data: mov.data,
      data_expiracao: mov.data_expiracao ?? "",
      origem: mov.origem ?? "cartao",
      descricao: mov.descricao ?? "",
      calcular_expiracao_auto: false,
    });
  };

  const onSubmitEdit = async (values: FormValues) => {
    if (!editingMov) return;
    const isDeb = values.tipo === "debito" || values.tipo === "expiracao";
    const qtd = isDeb ? -Math.abs(Number(values.quantidade)) : Math.abs(Number(values.quantidade));
    let exp: string | null = null;
    if (values.tipo === "credito") {
      if (values.calcular_expiracao_auto && values.data) {
        exp = calcularDataExpiracao(values.data, validadeEdit).toISOString().slice(0, 10);
      } else if (values.data_expiracao) {
        exp = values.data_expiracao;
      }
    }
    try {
      await updateMut.mutateAsync({
        id: editingMov.id,
        conta_id: values.conta_id,
        tipo: values.tipo,
        quantidade: qtd,
        data: values.data,
        data_expiracao: exp,
        origem: values.tipo === "credito" ? values.origem ?? "cartao" : null,
        descricao: values.descricao || null,
      });
      toast.success("Movimentação atualizada");
      setEditingMov(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const lookup = useMemo(() => {
    const m = new Map<string, ContaComSaldo>();
    contas?.forEach((c) => m.set(c.id, c));
    return m;
  }, [contas]);

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Movimentações"
        description="Registre créditos, débitos e ajustes nas suas contas"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!contas?.length}>
                <Plus className="h-4 w-4" /> Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova movimentação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo *</Label>
                    <Select {...register("tipo", { required: true })}>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                      <option value="ajuste">Ajuste</option>
                      <option value="expiracao">Expiração</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      {...register("quantidade", { required: true, valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data *</Label>
                    <Input type="date" {...register("data", { required: true })} />
                  </div>
                </div>
                {tipo === "credito" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Origem dos pontos/milhas</Label>
                      <Select {...register("origem", { required: true })}>
                        {ORIGENS_CREDITO.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {ORIGENS_CREDITO.find((o) => o.value === origem)?.descricao}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...register("calcular_expiracao_auto")} />
                      Calcular expiração automaticamente ({validade} meses para esta origem)
                    </label>
                    {!calcAuto && (
                      <div className="space-y-1.5">
                        <Label>Data expiração</Label>
                        <Input type="date" {...register("data_expiracao")} />
                      </div>
                    )}
                    {calcAuto && expCalc && (
                      <p className="text-xs text-muted-foreground">
                        Expira em <span className="font-mono">{formatDate(expCalc)}</span>
                      </p>
                    )}
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea rows={2} {...register("descricao")} />
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
        }
      />

      {/* Dialog de edição */}
      <Dialog open={!!editingMov} onOpenChange={(open) => { if (!open) setEditingMov(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar movimentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit(onSubmitEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Conta *</Label>
              <Select {...regEdit("conta_id", { required: true })}>
                <option value="">Selecione...</option>
                {contas?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titular?.nome} · {c.programa?.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select {...regEdit("tipo", { required: true })}>
                  <option value="credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="expiracao">Expiração</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  {...regEdit("quantidade", { required: true, valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" {...regEdit("data", { required: true })} />
              </div>
            </div>
            {tipoEdit === "credito" && (
              <>
                <div className="space-y-1.5">
                  <Label>Origem dos pontos/milhas</Label>
                  <Select {...regEdit("origem", { required: true })}>
                    {ORIGENS_CREDITO.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...regEdit("calcular_expiracao_auto")} />
                  Calcular expiração automaticamente ({validadeEdit} meses para esta origem)
                </label>
                {!calcAutoEdit && (
                  <div className="space-y-1.5">
                    <Label>Data expiração</Label>
                    <Input type="date" {...regEdit("data_expiracao")} />
                  </div>
                )}
                {calcAutoEdit && expCalcEdit && (
                  <p className="text-xs text-muted-foreground">
                    Expira em <span className="font-mono">{formatDate(expCalcEdit)}</span>
                  </p>
                )}
              </>
            )}
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} {...regEdit("descricao")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingMov(null)}>
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
      ) : !movs || movs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma movimentação"
          description="Registre créditos, débitos ou ajustes para alimentar o histórico."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.slice(0, 100).map((m) => {
                const conta = lookup.get(m.conta_id);
                const tipoMeta = TIPOS[m.tipo] ?? { label: m.tipo, variant: "outline" as const };
                const isPositive = Number(m.quantidade) >= 0;
                const editavel = !m.transferencia_id && !m.assinatura_id;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.data)}</TableCell>
                    <TableCell className="text-sm">
                      {conta?.programa?.nome ?? "—"}
                      <div className="text-xs text-muted-foreground">{conta?.titular?.nome}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tipoMeta.variant}>{tipoMeta.label}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${isPositive ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {isPositive ? "+" : ""}
                      {formatNumber(Number(m.quantidade))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.data_expiracao ? formatDate(m.data_expiracao) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {labelOrigem(m.origem)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[20ch] truncate">
                      {m.descricao ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {editavel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar"
                            onClick={() => onOpenEdit(m)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
                          onClick={async () => {
                            if (!confirm("Excluir movimentação?")) return;
                            try {
                              await deleteMut.mutateAsync(m.id);
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
