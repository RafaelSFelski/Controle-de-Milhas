"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  Grid3X3,
  Hotel,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Plane,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfigWarning } from "@/components/shared/config-warning";
import { EmptyState } from "@/components/shared/empty-state";
import { FieldError } from "@/components/shared/field-error";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useContasComSaldo } from "@/lib/queries/contas";
import { useCotacoesAtuais } from "@/lib/queries/cotacoes";
import {
  useCreatePrograma,
  useDeletePrograma,
  useProgramas,
  useUpdatePrograma,
} from "@/lib/queries/programas";
import { useRegrasValidade } from "@/lib/queries/regras-validade";
import { RegrasValidadeEditor } from "@/components/programas/regras-validade-editor";
import { programaSchema, type ProgramaFormValues } from "@/lib/schemas";
import { formatBRL, formatNumber } from "@/lib/utils";
import type {
  CategoriaPrograma,
  Programa,
  UnidadePrograma,
} from "@/types/database";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ProgramaStats {
  contas: number;
  saldoTotal: number;
  cotacaoMilheiro: number | null;
  regrasValidade: number;
}

const CATEGORIAS: {
  value: CategoriaPrograma;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "aerea", label: "Aérea", icon: Plane },
  { value: "cartao", label: "Cartão", icon: CreditCard },
  { value: "bancario", label: "Bancário", icon: Building2 },
  { value: "varejo", label: "Varejo / Coalizão", icon: ShoppingBag },
  { value: "hotel", label: "Hotel", icon: Hotel },
  { value: "outro", label: "Outro", icon: MoreHorizontal },
];

const UNIDADES: { value: UnidadePrograma; label: string }[] = [
  { value: "milhas", label: "Milhas" },
  { value: "pontos", label: "Pontos" },
];

const DEFAULT_FORM: ProgramaFormValues = {
  categoria: "aerea",
  cor: "#0ea5e9",
  validade_meses: 24,
  unidade: "milhas",
  nome: "",
};

function categoriaMeta(categoria: CategoriaPrograma) {
  return CATEGORIAS.find((c) => c.value === categoria) ?? CATEGORIAS[5];
}

function unidadeLabel(unidade: UnidadePrograma, quantidade?: number) {
  if (unidade === "pontos") {
    return quantidade === 1 ? "ponto" : "pontos";
  }
  return quantidade === 1 ? "milha" : "milhas";
}

function ProgramaFormFields({
  form,
  idPrefix,
}: {
  form: UseFormReturn<ProgramaFormValues>;
  idPrefix: string;
}) {
  const categoria = form.watch("categoria");

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-nome`}>Nome *</Label>
        <Input
          id={`${idPrefix}-nome`}
          {...form.register("nome")}
          placeholder="Ex.: Smiles, Livelo..."
        />
        <FieldError error={form.formState.errors.nome} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-categoria`}>Categoria</Label>
          <Select id={`${idPrefix}-categoria`} {...form.register("categoria")}>
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-unidade`}>Unidade</Label>
          <Select id={`${idPrefix}-unidade`} {...form.register("unidade")}>
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-validade`}>Validade padrão (meses)</Label>
          <Input
            id={`${idPrefix}-validade`}
            type="number"
            min={1}
            {...form.register("validade_meses", { valueAsNumber: true })}
          />
          <FieldError error={form.formState.errors.validade_meses} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-cor`}>Cor</Label>
          <Input
            id={`${idPrefix}-cor`}
            type="color"
            {...form.register("cor")}
            className="h-10 w-full p-1"
          />
        </div>
      </div>
      {categoria === "bancario" || categoria === "cartao" || categoria === "varejo" ? (
        <p className="text-xs text-muted-foreground">
          Programas bancários, de cartão e varejo costumam usar <strong>pontos</strong>.
        </p>
      ) : null}
    </>
  );
}

function ProgramaCard({
  programa,
  stats,
  onEdit,
  onDelete,
}: {
  programa: Programa;
  stats: ProgramaStats;
  onEdit: (p: Programa) => void;
  onDelete: (id: string, nome: string, isDefault: boolean, contas: number) => void;
}) {
  const meta = categoriaMeta(programa.categoria);
  const Icon = meta.icon;
  const valorEstimado =
    stats.cotacaoMilheiro != null
      ? (stats.saldoTotal / 1000) * stats.cotacaoMilheiro
      : null;

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: programa.cor }} />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${programa.cor}22`, color: programa.cor }}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{programa.nome}</p>
              <p className="text-xs text-muted-foreground">{meta.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {programa.is_default && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                Padrão
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] px-1.5 capitalize">
              {programa.unidade}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Saldo total</p>
            <p className="font-medium tabular-nums">
              {stats.saldoTotal > 0
                ? `${formatNumber(stats.saldoTotal)} ${unidadeLabel(programa.unidade, stats.saldoTotal)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contas</p>
            <p className="font-medium tabular-nums">
              {stats.contas > 0 ? stats.contas : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Validade padrão</p>
            <p className="font-medium">{programa.validade_meses} meses</p>
            {stats.regrasValidade > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                +{stats.regrasValidade} regra(s) por origem
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cotação</p>
            <p className="font-medium tabular-nums">
              {stats.cotacaoMilheiro != null
                ? `${formatBRL(stats.cotacaoMilheiro)}/milheiro`
                : "—"}
            </p>
          </div>
        </div>

        {valorEstimado != null && stats.saldoTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            Valor estimado: <span className="font-medium text-foreground">{formatBRL(valorEstimado)}</span>
          </p>
        )}

        <div className="flex items-center justify-end gap-1 pt-1 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(programa)}
            aria-label={`Editar ${programa.nome}`}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              onDelete(programa.id, programa.nome, programa.is_default, stats.contas)
            }
            aria-label={`Excluir ${programa.nome}`}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProgramasPageClient() {
  const { data, isLoading } = useProgramas();
  const { data: regrasValidade } = useRegrasValidade();
  const { data: contas } = useContasComSaldo();
  const { data: cotacoes } = useCotacoesAtuais();
  const createMut = useCreatePrograma();
  const updateMut = useUpdatePrograma();
  const deleteMut = useDeletePrograma();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<Programa | null>(null);
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaPrograma | "todas">("todas");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const createForm = useForm<ProgramaFormValues>({
    resolver: zodResolver(programaSchema) as Resolver<ProgramaFormValues>,
    defaultValues: DEFAULT_FORM,
  });
  const editForm = useForm<ProgramaFormValues>({
    resolver: zodResolver(programaSchema) as Resolver<ProgramaFormValues>,
  });

  const statsPorPrograma = useMemo(() => {
    const map = new Map<string, ProgramaStats>();
    for (const c of contas ?? []) {
      if (!c.programa_id) continue;
      const cur = map.get(c.programa_id) ?? {
        contas: 0,
        saldoTotal: 0,
        cotacaoMilheiro: null,
        regrasValidade: 0,
      };
      cur.contas += 1;
      cur.saldoTotal += c.saldo_atual ?? 0;
      map.set(c.programa_id, cur);
    }
    for (const cot of cotacoes ?? []) {
      const cur = map.get(cot.programa_id) ?? {
        contas: 0,
        saldoTotal: 0,
        cotacaoMilheiro: null,
        regrasValidade: 0,
      };
      cur.cotacaoMilheiro = Number(cot.valor_milheiro);
      map.set(cot.programa_id, cur);
    }
    for (const regra of regrasValidade ?? []) {
      const cur = map.get(regra.programa_id) ?? {
        contas: 0,
        saldoTotal: 0,
        cotacaoMilheiro: null,
        regrasValidade: 0,
      };
      cur.regrasValidade += 1;
      map.set(regra.programa_id, cur);
    }
    return map;
  }, [contas, cotacoes, regrasValidade]);

  const resumo = useMemo(() => {
    const programas = data ?? [];
    const emUso = programas.filter((p) => (statsPorPrograma.get(p.id)?.contas ?? 0) > 0).length;
    const categorias = new Set(programas.map((p) => p.categoria)).size;
    const saldoTotal = Array.from(statsPorPrograma.values()).reduce(
      (s, st) => s + st.saldoTotal,
      0
    );
    return { total: programas.length, emUso, categorias, saldoTotal };
  }, [data, statsPorPrograma]);

  const programasFiltrados = useMemo(() => {
    if (!data) return [];
    const termo = search.trim().toLowerCase();
    return data.filter((p) => {
      if (categoriaFiltro !== "todas" && p.categoria !== categoriaFiltro) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        categoriaMeta(p.categoria).label.toLowerCase().includes(termo) ||
        p.unidade.includes(termo)
      );
    });
  }, [data, search, categoriaFiltro]);

  const programasPorCategoria = useMemo(() => {
    const grupos = new Map<CategoriaPrograma, Programa[]>();
    for (const p of programasFiltrados) {
      const lista = grupos.get(p.categoria) ?? [];
      lista.push(p);
      grupos.set(p.categoria, lista);
    }
    return CATEGORIAS.filter((c) => grupos.has(c.value)).map((c) => ({
      ...c,
      programas: (grupos.get(c.value) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }));
  }, [programasFiltrados]);

  const onSubmitCreate = async (values: ProgramaFormValues) => {
    try {
      await createMut.mutateAsync({
        nome: values.nome.trim(),
        categoria: values.categoria,
        cor: values.cor ?? "#0ea5e9",
        validade_meses: Number(values.validade_meses ?? 24),
        unidade: values.unidade,
      });
      toast.success("Programa criado");
      createForm.reset(DEFAULT_FORM);
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
      unidade: programa.unidade ?? "milhas",
    });
  };

  const onSubmitEdit = async (values: ProgramaFormValues) => {
    if (!editingPrograma) return;
    try {
      await updateMut.mutateAsync({
        id: editingPrograma.id,
        nome: values.nome.trim(),
        categoria: values.categoria,
        cor: values.cor ?? "#0ea5e9",
        validade_meses: Number(values.validade_meses ?? 24),
        unidade: values.unidade,
      });
      toast.success("Programa atualizado");
      setEditingPrograma(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (
    id: string,
    nome: string,
    isDefault: boolean,
    contasVinculadas: number
  ) => {
    if (isDefault) {
      toast.error("Programas padrão não podem ser excluídos");
      return;
    }
    if (contasVinculadas > 0) {
      toast.error(
        `Este programa possui ${contasVinculadas} conta(s) vinculada(s). Remova-as antes de excluir.`
      );
      return;
    }
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
        description="Catálogo de programas de fidelidade — milhas, pontos e coalizões"
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
                <ProgramaFormFields form={createForm} idPrefix="create" />
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

      <Dialog
        open={!!editingPrograma}
        onOpenChange={(open) => {
          if (!open) setEditingPrograma(null);
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar programa</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
            <ProgramaFormFields form={editForm} idPrefix="edit" />
            {editingPrograma && (
              <RegrasValidadeEditor
                programaId={editingPrograma.id}
                validadePadrao={editingPrograma.validade_meses}
              />
            )}
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

      {!isLoading && data && data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Programas cadastrados"
              value={String(resumo.total)}
              description={`${resumo.categorias} categorias`}
              icon={Plane}
            />
            <StatCard
              title="Em uso"
              value={String(resumo.emUso)}
              description="Com contas vinculadas"
              icon={Users}
            />
            <StatCard
              title="Saldo consolidado"
              value={formatNumber(resumo.saldoTotal)}
              description="Soma de todas as contas"
              icon={Wallet}
            />
            <StatCard
              title="Sem uso"
              value={String(resumo.total - resumo.emUso)}
              description="Disponíveis para vincular"
              icon={Grid3X3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar programa..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Visualização em grade"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                aria-label="Visualização em tabela"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={categoriaFiltro === "todas" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoriaFiltro("todas")}
            >
              Todas
            </Button>
            {CATEGORIAS.map((c) => (
              <Button
                key={c.value}
                variant={categoriaFiltro === c.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoriaFiltro(c.value)}
              >
                <c.icon className="h-3.5 w-3.5 mr-1.5" />
                {c.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Nenhum programa cadastrado"
          description="Aplique a migration 0002_seed_programas.sql para carregar o catálogo padrão."
        />
      ) : programasFiltrados.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado"
          description="Tente outro termo de busca ou remova o filtro de categoria."
        />
      ) : viewMode === "grid" ? (
        <div className="space-y-8">
          {programasPorCategoria.map((grupo) => (
            <section key={grupo.value}>
              <div className="flex items-center gap-2 mb-3">
                <grupo.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{grupo.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {grupo.programas.length}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.programas.map((p) => (
                  <ProgramaCard
                    key={p.id}
                    programa={p}
                    stats={
                      statsPorPrograma.get(p.id) ?? {
                        contas: 0,
                        saldoTotal: 0,
                        cotacaoMilheiro: null,
                        regrasValidade: 0,
                      }
                    }
                    onEdit={onOpenEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Programa</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Contas</TableHead>
                <TableHead className="text-right">Validade padrão</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programasFiltrados.map((p) => {
                const stats = statsPorPrograma.get(p.id) ?? {
                  contas: 0,
                  saldoTotal: 0,
                  cotacaoMilheiro: null,
                  regrasValidade: 0,
                };
                const meta = categoriaMeta(p.categoria);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: p.cor }}
                        />
                        <span className="font-medium">{p.nome}</span>
                        {p.is_default && (
                          <Badge variant="outline" className="text-[10px]">
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{p.unidade ?? "milhas"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stats.saldoTotal > 0 ? formatNumber(stats.saldoTotal) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {stats.contas > 0 ? stats.contas : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.validade_meses} meses
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
                          onClick={() => onDelete(p.id, p.nome, p.is_default, stats.contas)}
                          aria-label="Excluir"
                          disabled={p.is_default}
                        >
                          <Trash2
                            className={cn(
                              "h-4 w-4",
                              p.is_default ? "text-muted-foreground" : "text-destructive"
                            )}
                          />
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
