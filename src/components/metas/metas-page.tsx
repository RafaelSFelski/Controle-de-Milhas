"use client";

import { useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  useCreateMeta,
  useDeleteMeta,
  useMetas,
  useUpdateMeta,
} from "@/lib/queries/metas";
import { useContasComSaldo } from "@/lib/queries/contas";
import { useTitulares } from "@/lib/queries/titulares";
import { useMovimentacoes } from "@/lib/queries/movimentacoes";
import { projecaoMeta } from "@/lib/calculations";
import { metaSchema, type MetaFormValues } from "@/lib/schemas";
import { formatDate, formatNumber } from "@/lib/utils";
import { addMonths, parseISO, startOfMonth } from "date-fns";

export function MetasPageClient() {
  const { data: metas, isLoading } = useMetas();
  const { data: contas } = useContasComSaldo();
  const { data: titulares } = useTitulares();
  const { data: movs } = useMovimentacoes();
  const createMut = useCreateMeta();
  const updateMut = useUpdateMeta();
  const deleteMut = useDeleteMeta();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control, reset, formState } = useForm<MetaFormValues>({
    resolver: zodResolver(metaSchema) as Resolver<MetaFormValues>,
    defaultValues: { escopo: "conta" },
  });
  const escopo = useWatch({ control, name: "escopo" });

  const mediaMensalPorConta = useMemo(() => {
    if (!movs) return new Map<string, number>();
    const cutoff = startOfMonth(addMonths(new Date(), -3));
    const map = new Map<string, number>();
    for (const m of movs) {
      if (Number(m.quantidade) <= 0) continue;
      if (parseISO(m.data) < cutoff) continue;
      map.set(m.conta_id, (map.get(m.conta_id) ?? 0) + Number(m.quantidade));
    }
    // dividir por 3 meses
    const result = new Map<string, number>();
    map.forEach((v, k) => result.set(k, v / 3));
    return result;
  }, [movs]);

  const onSubmit = async (values: MetaFormValues) => {
    try {
      await createMut.mutateAsync({
        conta_id: values.escopo === "conta" ? values.conta_id ?? null : null,
        titular_id: values.escopo === "titular" ? values.titular_id ?? null : null,
        descricao: values.descricao,
        quantidade_alvo: Number(values.quantidade_alvo),
        data_alvo: values.data_alvo,
      });
      toast.success("Meta criada");
      reset({ escopo: "conta" });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const calcularSaldoMeta = (m: { conta_id: string | null; titular_id: string | null }) => {
    if (!contas) return { saldo: 0, mediaMensal: 0 };
    if (m.conta_id) {
      const c = contas.find((x) => x.id === m.conta_id);
      return {
        saldo: c?.saldo_atual ?? 0,
        mediaMensal: mediaMensalPorConta.get(m.conta_id) ?? 0,
      };
    }
    if (m.titular_id) {
      const filtered = contas.filter((c) => c.titular_id === m.titular_id);
      return {
        saldo: filtered.reduce((s, c) => s + (c.saldo_atual ?? 0), 0),
        mediaMensal: filtered.reduce(
          (s, c) => s + (mediaMensalPorConta.get(c.id) ?? 0),
          0
        ),
      };
    }
    return {
      saldo: contas.reduce((s, c) => s + (c.saldo_atual ?? 0), 0),
      mediaMensal: Array.from(mediaMensalPorConta.values()).reduce((s, v) => s + v, 0),
    };
  };

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Metas"
        description="Acompanhe o progresso de acúmulo de milhas"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nova meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova meta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Escopo</Label>
                  <Select {...register("escopo")}>
                    <option value="conta">Conta específica</option>
                    <option value="titular">Titular</option>
                    <option value="global">Global (todas as contas)</option>
                  </Select>
                </div>
                {escopo === "conta" && (
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
                )}
                {escopo === "titular" && (
                  <div className="space-y-1.5">
                    <Label>Titular *</Label>
                    <Select {...register("titular_id")}>
                      <option value="">Selecione...</option>
                      {titulares?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </Select>
                    <FieldError error={formState.errors.titular_id} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Descrição *</Label>
                  <Input
                    placeholder="Ex: Viagem família 2026"
                    {...register("descricao")}
                  />
                  <FieldError error={formState.errors.descricao} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Alvo (milhas) *</Label>
                    <Input
                      type="number"
                      step="any"
                      {...register("quantidade_alvo", { valueAsNumber: true })}
                    />
                    <FieldError error={formState.errors.quantidade_alvo} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data alvo *</Label>
                    <Input
                      type="date"
                      {...register("data_alvo")}
                    />
                    <FieldError error={formState.errors.data_alvo} />
                  </div>
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
      ) : !metas || metas.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta cadastrada"
          description="Crie metas para acompanhar quanto falta para atingir um objetivo."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metas.map((m) => {
            const { saldo, mediaMensal } = calcularSaldoMeta(m);
            const pct = Math.min(100, (saldo / Number(m.quantidade_alvo)) * 100);
            const meses = projecaoMeta(saldo, Number(m.quantidade_alvo), mediaMensal);
            const escopoLabel = m.conta_id
              ? "Conta"
              : m.titular_id
                ? "Titular"
                : "Global";
            return (
              <Card key={m.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{escopoLabel}</p>
                      <p className="font-semibold truncate">{m.descricao}</p>
                      {m.data_alvo && (
                        <p className="text-xs text-muted-foreground">
                          Até {formatDate(m.data_alvo)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Excluir meta?")) return;
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
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono">{formatNumber(saldo)}</span>
                      <span className="text-muted-foreground">
                        / {formatNumber(Number(m.quantidade_alvo))}
                      </span>
                    </div>
                    <Progress value={pct} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}% concluído</span>
                      <span>
                        {pct >= 100
                          ? "Meta atingida 🎉"
                          : meses === null
                            ? "Sem média de acúmulo"
                            : meses === 0
                              ? "Pronto!"
                              : `~${meses} mês(es) na média atual`}
                      </span>
                    </div>
                    {pct >= 100 && !m.concluida && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => updateMut.mutate({ id: m.id, concluida: true })}
                      >
                        Marcar como concluída
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
