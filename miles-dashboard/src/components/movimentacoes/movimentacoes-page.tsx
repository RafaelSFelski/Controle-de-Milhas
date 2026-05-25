"use client";

import { useMemo, useState } from "react";
import { Activity, Plus, Trash2 } from "lucide-react";
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
} from "@/lib/queries/movimentacoes";
import {
  useContasComSaldo,
  type ContaComSaldo,
} from "@/lib/queries/contas";
import { calcularDataExpiracao } from "@/lib/calculations";
import { formatDate, formatNumber } from "@/lib/utils";
import type { TipoMovimentacao } from "@/types/database";

interface FormValues {
  conta_id: string;
  tipo: "credito" | "debito" | "ajuste" | "expiracao";
  quantidade: number;
  data: string;
  data_expiracao?: string;
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
  const createMut = useCreateMovimentacao();
  const deleteMut = useDeleteMovimentacao();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({
    defaultValues: {
      tipo: "credito",
      data: new Date().toISOString().slice(0, 10),
      calcular_expiracao_auto: true,
    },
  });

  const tipo = useWatch({ control, name: "tipo" });
  const contaId = useWatch({ control, name: "conta_id" });
  const calcAuto = useWatch({ control, name: "calcular_expiracao_auto" });
  const dataMov = useWatch({ control, name: "data" });

  const contaSel = contas?.find((c) => c.id === contaId);
  const validade = contaSel?.programa?.validade_meses ?? 24;
  const expCalc =
    tipo === "credito" && calcAuto && dataMov
      ? calcularDataExpiracao(dataMov, validade).toISOString().slice(0, 10)
      : undefined;

  const onSubmit = async (values: FormValues) => {
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
        descricao: values.descricao || null,
      });
      toast.success("Movimentação registrada");
      reset({
        tipo: "credito",
        data: new Date().toISOString().slice(0, 10),
        calcular_expiracao_auto: true,
      });
      setOpen(false);
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!contas?.length}>
                <Plus className="h-4 w-4" /> Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova movimentação</DialogTitle>
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
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...register("calcular_expiracao_auto")} />
                      Calcular expiração automaticamente ({validade} meses)
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
        }
      />

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
                <TableHead>Descrição</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.slice(0, 100).map((m) => {
                const conta = lookup.get(m.conta_id);
                const tipoMeta = TIPOS[m.tipo] ?? { label: m.tipo, variant: "outline" as const };
                const isPositive = Number(m.quantidade) >= 0;
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
                    <TableCell className="text-xs text-muted-foreground max-w-[20ch] truncate">
                      {m.descricao ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
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
