"use client";

import { useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
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
  useContasComSaldo,
  useCreateConta,
  useDeleteConta,
} from "@/lib/queries/contas";
import { useTitulares } from "@/lib/queries/titulares";
import { useProgramas } from "@/lib/queries/programas";
import { formatNumber } from "@/lib/utils";

interface FormValues {
  titular_id: string;
  programa_id: string;
  numero_conta?: string;
  saldo_inicial?: number;
}

export function ContasPageClient() {
  const { data: contas, isLoading } = useContasComSaldo();
  const { data: titulares } = useTitulares();
  const { data: programas } = useProgramas();
  const createMut = useCreateConta();
  const deleteMut = useDeleteConta();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      await createMut.mutateAsync({
        titular_id: values.titular_id,
        programa_id: values.programa_id,
        numero_conta: values.numero_conta?.trim() || null,
        saldo_inicial: Number(values.saldo_inicial ?? 0),
      });
      toast.success("Conta criada");
      reset();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir conta? Todas as movimentações serão removidas.")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Conta removida");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const semDependencias = !titulares?.length || !programas?.length;

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Contas"
        description="Vínculo de titulares com programas de fidelidade"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={semDependencias}>
                <Plus className="h-4 w-4" /> Nova conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova conta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="titular_id">Titular *</Label>
                  <Select id="titular_id" {...register("titular_id", { required: true })}>
                    <option value="">Selecione...</option>
                    {titulares?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="programa_id">Programa *</Label>
                  <Select id="programa_id" {...register("programa_id", { required: true })}>
                    <option value="">Selecione...</option>
                    {programas?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="numero_conta">Nº da conta</Label>
                    <Input id="numero_conta" {...register("numero_conta")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="saldo_inicial">Saldo inicial</Label>
                    <Input
                      id="saldo_inicial"
                      type="number"
                      step="any"
                      defaultValue={0}
                      {...register("saldo_inicial", { valueAsNumber: true })}
                    />
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

      {semDependencias && (
        <p className="text-sm text-amber-600 mb-4">
          Cadastre ao menos um titular e tenha programas no catálogo antes de criar contas.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !contas || contas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta cadastrada"
          description="Vincule titulares a programas para começar a controlar saldos."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titular</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Nº</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.titular?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.programa?.cor }}
                      />
                      {c.programa?.nome}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.numero_conta ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(c.saldo_atual ?? 0)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}>
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
