"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Transferencia } from "@/types/database";
import { queryKeys } from "./keys";

export interface TransferenciaJoin extends Transferencia {
  conta_origem?: {
    id: string;
    titular?: { nome: string } | null;
    programa?: { nome: string; cor: string } | null;
  } | null;
  conta_destino?: {
    id: string;
    titular?: { nome: string } | null;
    programa?: { nome: string; cor: string } | null;
  } | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function useTransferencias() {
  return useQuery({
    queryKey: queryKeys.transferencias,
    queryFn: async (): Promise<TransferenciaJoin[]> => {
      const { data, error } = await getSupabase()
        .from("transferencias")
        .select(
          `*,
           conta_origem:contas!transferencias_conta_origem_id_fkey(id, titular:titulares(nome), programa:programas(nome,cor)),
           conta_destino:contas!transferencias_conta_destino_id_fkey(id, titular:titulares(nome), programa:programas(nome,cor))`
        )
        .order("data", { ascending: false });
      if (error) throw error;

      type RawRow = Transferencia & {
        conta_origem: unknown;
        conta_destino: unknown;
      };
      const rows = (data ?? []) as RawRow[];
      return rows.map((r) => {
        const co = pickOne<{
          id: string;
          titular: unknown;
          programa: unknown;
        }>(r.conta_origem as never);
        const cd = pickOne<{
          id: string;
          titular: unknown;
          programa: unknown;
        }>(r.conta_destino as never);
        return {
          ...r,
          conta_origem: co
            ? {
                id: co.id,
                titular: pickOne<{ nome: string }>(co.titular as never),
                programa: pickOne<{ nome: string; cor: string }>(
                  co.programa as never
                ),
              }
            : null,
          conta_destino: cd
            ? {
                id: cd.id,
                titular: pickOne<{ nome: string }>(cd.titular as never),
                programa: pickOne<{ nome: string; cor: string }>(
                  cd.programa as never
                ),
              }
            : null,
        } as TransferenciaJoin;
      });
    },
  });
}

export interface CreateTransferenciaInput {
  conta_origem_id: string;
  conta_destino_id: string;
  quantidade_origem: number;
  quantidade_destino: number;
  bonus_percentual: number;
  taxa_conversao: number;
  custo_reais: number;
  data: string;
  observacao?: string | null;
  /** Validade em meses do programa destino — usada para calcular data_expiracao do crédito gerado. */
  validade_meses_destino?: number | null;
  /** Quantidade de pontos comprados (será debitado da conta de origem) */
  pontos_comprados?: number | null;
}

function calcularDataExpiracaoDestino(
  data: string,
  validadeMeses?: number | null
): string | null {
  if (!validadeMeses || validadeMeses <= 0) return null;
  const d = new Date(data);
  d.setMonth(d.getMonth() + validadeMeses);
  return d.toISOString().slice(0, 10);
}

export function useCreateTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTransferenciaInput) => {
      const dataExpiracaoDestino = calcularDataExpiracaoDestino(
        input.data,
        input.validade_meses_destino
      );
      const { data, error } = await getSupabase().rpc("criar_transferencia", {
        p_conta_origem: input.conta_origem_id,
        p_conta_destino: input.conta_destino_id,
        p_qtd_origem: input.quantidade_origem,
        p_qtd_destino: input.quantidade_destino,
        p_bonus_pct: input.bonus_percentual,
        p_taxa_conversao: input.taxa_conversao,
        p_custo_reais: input.custo_reais,
        p_data: input.data,
        p_observacao: input.observacao ?? null,
        p_data_expiracao_destino: dataExpiracaoDestino,
        p_pontos_comprados: input.pontos_comprados ?? 0,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transferencias });
      qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
    },
  });
}

export function useDeleteTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("transferencias")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transferencias });
      qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
    },
  });
}
