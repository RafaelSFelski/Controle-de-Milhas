"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ORIGENS_CREDITO } from "@/lib/validade";
import {
  useCreateRegraValidade,
  useDeleteRegraValidade,
  useRegrasValidade,
  useUpdateRegraValidade,
} from "@/lib/queries/regras-validade";
import type { OrigemCredito } from "@/types/database";

interface RegrasValidadeEditorProps {
  programaId: string;
  validadePadrao: number;
}

export function RegrasValidadeEditor({
  programaId,
  validadePadrao,
}: RegrasValidadeEditorProps) {
  const { data: regras, isLoading } = useRegrasValidade(programaId);
  const createMut = useCreateRegraValidade();
  const updateMut = useUpdateRegraValidade();
  const deleteMut = useDeleteRegraValidade();

  const [novaOrigem, setNovaOrigem] = useState<OrigemCredito>("cartao");
  const [novaValidade, setNovaValidade] = useState(validadePadrao);
  const [novaDescricao, setNovaDescricao] = useState("");

  const origensDisponiveis = useMemo(() => {
    const usadas = new Set((regras ?? []).map((r) => r.origem));
    return ORIGENS_CREDITO.filter((o) => !usadas.has(o.value));
  }, [regras]);

  const onAdd = async () => {
    try {
      await createMut.mutateAsync({
        programa_id: programaId,
        origem: novaOrigem,
        validade_meses: novaValidade,
        descricao: novaDescricao.trim() || null,
      });
      toast.success("Regra adicionada");
      setNovaDescricao("");
      if (origensDisponiveis.length > 1) {
        setNovaOrigem(origensDisponiveis[1]?.value ?? "cartao");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onUpdateValidade = async (
    id: string,
    validade_meses: number,
    descricao: string | null
  ) => {
    try {
      await updateMut.mutateAsync({ id, programa_id: programaId, validade_meses, descricao });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync({ id, programa_id: programaId });
      toast.success("Regra removida");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <div>
        <p className="text-sm font-medium">Validade por origem</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cada origem pode ter validade diferente. Sem regra, usa a validade padrão (
          {validadePadrao} meses).
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando regras...</p>
      ) : regras && regras.length > 0 ? (
        <div className="space-y-2">
          {regras.map((regra) => {
            const meta = ORIGENS_CREDITO.find((o) => o.value === regra.origem);
            return (
              <div
                key={regra.id}
                className="grid grid-cols-[1fr_88px_1fr_auto] gap-2 items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{meta?.label ?? regra.origem}</p>
                  <Input
                    className="h-7 text-xs mt-1"
                    defaultValue={regra.descricao ?? ""}
                    placeholder="Descrição opcional"
                    onBlur={(e) => {
                      const val = e.target.value.trim() || null;
                      if (val !== (regra.descricao ?? "")) {
                        onUpdateValidade(regra.id, regra.validade_meses, val);
                      }
                    }}
                  />
                </div>
                <Input
                  type="number"
                  min={1}
                  className="h-8"
                  defaultValue={regra.validade_meses}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val > 0 && val !== regra.validade_meses) {
                      onUpdateValidade(regra.id, val, regra.descricao);
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">meses</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover regra"
                  onClick={() => onDelete(regra.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma regra específica — todos os créditos usam {validadePadrao} meses.
        </p>
      )}

      {origensDisponiveis.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs">Adicionar regra</Label>
          <div className="grid grid-cols-[1fr_88px_auto] gap-2 items-end">
            <Select
              value={novaOrigem}
              onChange={(e) => setNovaOrigem(e.target.value as OrigemCredito)}
            >
              {origensDisponiveis.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={1}
              value={novaValidade}
              onChange={(e) => setNovaValidade(Number(e.target.value))}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAdd}
              disabled={createMut.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
            placeholder="Descrição opcional"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
