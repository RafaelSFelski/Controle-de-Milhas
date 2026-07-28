"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCpf, isCompleteCpf, normalizeCpf } from "@/lib/cpf";
import {
  useCreateTitular,
  useDeleteTitular,
  useTitulares,
  useUpdateTitular,
} from "@/lib/queries/titulares";
import type { Titular } from "@/types/database";

interface FormValues {
  nome: string;
  cpf?: string;
  email?: string;
}

const cpfFieldRules = {
  validate: (value?: string) =>
    !value?.trim() || isCompleteCpf(value) || "Informe um CPF completo (000.000.000-00)",
};

export function TitularesPageClient() {
  const { data, isLoading } = useTitulares();
  const createMut = useCreateTitular();
  const updateMut = useUpdateTitular();
  const deleteMut = useDeleteTitular();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingTitular, setEditingTitular] = useState<Titular | null>(null);

  const createForm = useForm<FormValues>();
  const editForm = useForm<FormValues>();

  const createCpfRegister = createForm.register("cpf", cpfFieldRules);
  const editCpfRegister = editForm.register("cpf", cpfFieldRules);

  const onSubmitCreate = async (values: FormValues) => {
    try {
      await createMut.mutateAsync({
        nome: values.nome.trim(),
        cpf: normalizeCpf(values.cpf),
        email: values.email?.trim() || null,
      });
      toast.success("Titular criado");
      createForm.reset();
      setCreateOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onOpenEdit = (titular: Titular) => {
    setEditingTitular(titular);
    editForm.reset({
      nome: titular.nome,
      cpf: titular.cpf ? formatCpf(titular.cpf) : "",
      email: titular.email ?? "",
    });
  };

  const onSubmitEdit = async (values: FormValues) => {
    if (!editingTitular) return;
    try {
      await updateMut.mutateAsync({
        id: editingTitular.id,
        nome: values.nome.trim(),
        cpf: normalizeCpf(values.cpf),
        email: values.email?.trim() || null,
      });
      toast.success("Titular atualizado");
      setEditingTitular(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir titular "${nome}"? Todas as contas vinculadas serão removidas.`))
      return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Titular removido");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <ConfigWarning />
      <PageHeader
        title="Titulares"
        description="Pessoas que possuem contas em programas de fidelidade"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo titular
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo titular</DialogTitle>
              </DialogHeader>
              <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-nome">Nome *</Label>
                  <Input
                    id="create-nome"
                    {...createForm.register("nome", { required: true })}
                    placeholder="João da Silva"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-cpf">CPF</Label>
                    <Input
                      id="create-cpf"
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="000.000.000-00"
                      {...createCpfRegister}
                      onChange={(e) => {
                        e.target.value = formatCpf(e.target.value);
                        void createCpfRegister.onChange(e);
                      }}
                    />
                    {createForm.formState.errors.cpf && (
                      <p className="text-sm text-destructive">
                        {createForm.formState.errors.cpf.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create-email">Email</Label>
                    <Input id="create-email" type="email" {...createForm.register("email")} />
                  </div>
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
      <Dialog open={!!editingTitular} onOpenChange={(open) => { if (!open) setEditingTitular(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar titular</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nome">Nome *</Label>
              <Input
                id="edit-nome"
                {...editForm.register("nome", { required: true })}
                placeholder="João da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cpf">CPF</Label>
                <Input
                  id="edit-cpf"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  {...editCpfRegister}
                  onChange={(e) => {
                    e.target.value = formatCpf(e.target.value);
                    void editCpfRegister.onChange(e);
                  }}
                />
                {editForm.formState.errors.cpf && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.cpf.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" {...editForm.register("email")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingTitular(null)}>
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
          icon={Users}
          title="Nenhum titular cadastrado"
          description="Comece adicionando os titulares que possuirão contas nos programas de fidelidade."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.cpf ? formatCpf(t.cpf) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenEdit(t)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(t.id, t.nome)}
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
