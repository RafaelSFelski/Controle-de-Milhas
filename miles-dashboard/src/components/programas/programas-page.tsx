"use client";

import { useState } from "react";
import { Plane, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
  useCreatePrograma,
  useDeletePrograma,
  useProgramas,
} from "@/lib/queries/programas";
import type { CategoriaPrograma } from "@/types/database";

interface FormValues {
  nome: string;
  categoria: CategoriaPrograma;
  cor?: string;
  validade_meses?: number;
}

const CATEGORIAS: { value: CategoriaPrograma; label: string }[] = [
  { value: "aerea", label: "Aérea" },
  { value: "cartao", label: "Cartão" },
  { value: "bancario", label: "Bancário" },
  { value: "varejo", label: "Varejo / Coalizão" },
  { value: "hotel", label: "Hotel" },
  { value: "outro", label: "Outro" },
];

export function ProgramasPageClient() {
  const { data, isLoading } = useProgramas();
  const createMut = useCreatePrograma();
  const deleteMut = useDeletePrograma();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: { categoria: "aerea", cor: "#0ea5e9", validade_meses: 24 },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createMut.mutateAsync({
        nome: values.nome.trim(),
        categoria: values.categoria,
        cor: values.cor ?? "#0ea5e9",
        validade_meses: Number(values.validade_meses ?? 24),
      });
      toast.success("Programa criado");
      reset({ categoria: "aerea", cor: "#0ea5e9", validade_meses: 24 });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir programa "${nome}"?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Programa removido");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Programas"
        description="Catálogo de programas de fidelidade disponíveis no sistema"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo programa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo programa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input id="nome" {...register("nome", { required: true })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select id="categoria" {...register("categoria")}>
                      {CATEGORIAS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="validade_meses">Validade (meses)</Label>
                    <Input
                      id="validade_meses"
                      type="number"
                      min={1}
                      {...register("validade_meses", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cor">Cor</Label>
                  <Input id="cor" type="color" {...register("cor")} className="h-10 w-20 p-1" />
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
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Nenhum programa cadastrado"
          description="Aplique a migration 0002_seed_programas.sql para carregar o catálogo padrão."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programa</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Validade</TableHead>
                <TableHead></TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: p.cor }}
                      />
                      <span className="font-medium">{p.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {CATEGORIAS.find((c) => c.value === p.categoria)?.label ?? p.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.validade_meses} meses
                  </TableCell>
                  <TableCell>
                    {p.is_default && <Badge variant="outline">Padrão</Badge>}
                  </TableCell>
                  <TableCell>
                    {!p.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(p.id, p.nome)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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
