"use client";

import { useState } from "react";
import { Pencil, Plane, Plus, Trash2 } from "lucide-react";
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
  useUpdatePrograma,
} from "@/lib/queries/programas";
import type { CategoriaPrograma, Programa } from "@/types/database";

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
  const updateMut = useUpdatePrograma();
  const deleteMut = useDeletePrograma();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<Programa | null>(null);

  const createForm = useForm<FormValues>({
    defaultValues: { categoria: "aerea", cor: "#0ea5e9", validade_meses: 24 },
  });
  const editForm = useForm<FormValues>();

  const onSubmitCreate = async (values: FormValues) => {
    try {
      await createMut.mutateAsync({
        nome: values.nome.trim(),
        categoria: values.categoria,
        cor: values.cor ?? "#0ea5e9",
        validade_meses: Number(values.validade_meses ?? 24),
      });
      toast.success("Programa criado");
      createForm.reset({ categoria: "aerea", cor: "#0ea5e9", validade_meses: 24 });
      setCreateOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onOpenEdit = (programa: Programa) => {
    setEditingPrograma(programa);
    editForm.reset({
      nome: programa.nome,
      categoria: programa.categoria,
      cor: programa.cor,
      validade_meses: programa.validade_meses,
    });
  };

  const onSubmitEdit = async (values: FormValues) => {
    if (!editingPrograma) return;
    try {
      await updateMut.mutateAsync({
        id: editingPrograma.id,
        nome: values.nome.trim(),
        categoria: values.categoria,
        cor: values.cor ?? "#0ea5e9",
        validade_meses: Number(values.validade_meses ?? 24),
      });
      toast.success("Programa atualizado");
      setEditingPrograma(null);
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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo programa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo programa</DialogTitle>
              </DialogHeader>
              <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-nome">Nome *</Label>
                  <Input id="create-nome" {...createForm.register("nome", { required: true })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-categoria">Categoria</Label>
                    <Select id="create-categoria" {...createForm.register("categoria")}>
                      {CATEGORIAS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create-validade">Validade (meses)</Label>
                    <Input
                      id="create-validade"
                      type="number"
                      min={1}
                      {...createForm.register("validade_meses", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-cor">Cor</Label>
                  <Input id="create-cor" type="color" {...createForm.register("cor")} className="h-10 w-20 p-1" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createForm.formState.isSubmitting}>
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Dialog de edição */}
      <Dialog open={!!editingPrograma} onOpenChange={(open) => { if (!open) setEditingPrograma(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar programa</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nome">Nome *</Label>
              <Input id="edit-nome" {...editForm.register("nome", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-categoria">Categoria</Label>
                <Select id="edit-categoria" {...editForm.register("categoria")}>
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-validade">Validade (meses)</Label>
                <Input
                  id="edit-validade"
                  type="number"
                  min={1}
                  {...editForm.register("validade_meses", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cor">Cor</Label>
              <Input id="edit-cor" type="color" {...editForm.register("cor")} className="h-10 w-20 p-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPrograma(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting}>
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
                <TableHead className="w-24"></TableHead>
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenEdit(p)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(p.id, p.nome)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
