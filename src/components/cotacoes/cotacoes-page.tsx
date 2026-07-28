"use client";

import { useMemo, useState } from "react";
import { Plus, TrendingUp, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
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
  useCreateCotacao,
  useDeleteCotacao,
  useCotacoes,
  useCotacoesAtuais,
} from "@/lib/queries/cotacoes";
import { useProgramas } from "@/lib/queries/programas";
import { cotacaoSchema, type CotacaoFormValues } from "@/lib/schemas";
import { formatBRL, formatDate } from "@/lib/utils";
import { CustoMedioCard } from "./custo-medio-card";

export function CotacoesPageClient() {
  const { data: cotacoes, isLoading } = useCotacoes();
  const { data: atuais } = useCotacoesAtuais();
  const { data: programas } = useProgramas();
  const createMut = useCreateCotacao();
  const deleteMut = useDeleteCotacao();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<CotacaoFormValues>({
    resolver: zodResolver(cotacaoSchema) as Resolver<CotacaoFormValues>,
    defaultValues: { data: new Date().toISOString().slice(0, 10) },
  });

  const atuaisMap = useMemo(() => {
    const m: Record<string, number> = {};
    atuais?.forEach((c) => (m[c.programa_id] = Number(c.valor_milheiro)));
    return m;
  }, [atuais]);

  const onSubmit = async (values: CotacaoFormValues) => {
    try {
      await createMut.mutateAsync({
        programa_id: values.programa_id,
        valor_milheiro: Number(values.valor_milheiro),
        data: values.data,
        fonte: values.fonte || null,
      });
      toast.success("Cotação registrada");
      reset({ data: new Date().toISOString().slice(0, 10) });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Cotações"
        description="Acompanhe o valor de mercado (R$/milheiro) por programa"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!programas?.length}>
                <Plus className="h-4 w-4" /> Nova cotação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova cotação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Programa *</Label>
                  <Select {...register("programa_id")}>
                    <option value="">Selecione...</option>
                    {programas?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </Select>
                  <FieldError error={formState.errors.programa_id} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>R$/milheiro *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register("valor_milheiro", { valueAsNumber: true })}
                    />
                    <FieldError error={formState.errors.valor_milheiro} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data *</Label>
                    <Input type="date" {...register("data")} />
                    <FieldError error={formState.errors.data} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Fonte</Label>
                  <Input placeholder="Ex: Hotmilhas, Mercado Livre..." {...register("fonte")} />
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

      <CustoMedioCard />

      {programas && programas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {programas
            .filter((p) => atuaisMap[p.id])
            .slice(0, 12)
            .map((p) => (
              <div
                key={p.id}
                className="rounded-md border p-3 bg-card"
              >
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.cor }}
                  />
                  {p.nome}
                </p>
                <p className="font-mono text-base mt-1">
                  {formatBRL(atuaisMap[p.id])}
                  <span className="text-xs text-muted-foreground">/k</span>
                </p>
              </div>
            ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !cotacoes || cotacoes.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma cotação registrada"
          description="Cadastre o valor de mercado das milhas (em R$ por 1.000 milhas) para calcular o valor estimado da sua carteira."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead className="text-right">R$/milheiro</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotacoes.map((c) => {
                const programa = programas?.find((p) => p.id === c.programa_id);
                return (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.data)}</TableCell>
                    <TableCell>{programa?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatBRL(Number(c.valor_milheiro))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.fonte ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Excluir cotação?")) return;
                          try {
                            await deleteMut.mutateAsync(c.id);
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
