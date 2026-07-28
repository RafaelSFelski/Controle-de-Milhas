"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Movimentacao, OrigemCredito, TipoMovimentacao } from "@/types/database";
import { queryKeys } from "./keys";

function invalidateMovimentacaoQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
  qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
  qc.invalidateQueries({ queryKey: queryKeys.expiracoes });
  qc.invalidateQueries({ queryKey: ["milhas-expirando"] });
}

export function useMovimentacoes(contaId?: string) {
  return useQuery({
    queryKey: queryKeys.movimentacoes(contaId),
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<Movimentacao[]> => {
      let q = getSupabase()
        .from("movimentacoes")
        .select("*")
        .order("data", { ascending: false });
      if (contaId) q = q.eq("conta_id", contaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conta_id: string;
      tipo: TipoMovimentacao;
      quantidade: number;
      data: string;
      data_expiracao?: string | null;
      origem?: OrigemCredito | null;
      descricao?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from("movimentacoes")
        .insert({
          conta_id: input.conta_id,
          tipo: input.tipo,
          quantidade: input.quantidade,
          data: input.data,
          data_expiracao: input.data_expiracao ?? null,
          origem: input.origem ?? null,
          descricao: input.descricao ?? null,
          transferencia_id: null,
          assinatura_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateMovimentacaoQueries(qc),
  });
}

/** Insere várias movimentações em lotes (CSV). */
export function useCreateMovimentacoesBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: Array<{
        conta_id: string;
        tipo: TipoMovimentacao;
        quantidade: number;
        data: string;
        data_expiracao?: string | null;
        origem?: OrigemCredito | null;
        descricao?: string | null;
      }>
    ) => {
      if (rows.length === 0) return { inserted: 0 };
      const payload = rows.map((input) => ({
        conta_id: input.conta_id,
        tipo: input.tipo,
        quantidade: input.quantidade,
        data: input.data,
        data_expiracao: input.data_expiracao ?? null,
        origem: input.origem ?? null,
        descricao: input.descricao ?? null,
        transferencia_id: null,
        assinatura_id: null,
      }));

      const chunkSize = 50;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { data, error } = await getSupabase()
          .from("movimentacoes")
          .insert(chunk)
          .select("id");
        if (error) throw error;
        inserted += data?.length ?? chunk.length;
      }
      return { inserted };
    },
    onSuccess: () => invalidateMovimentacaoQueries(qc),
  });
}

/**
 * Créditos com saldo FIFO restante e data_expiracao futura,
 * ordenados pela expiração mais próxima (lista do dashboard).
 */
export function useExpiracoes(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.expiracoes, limit] as const,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<Movimentacao[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await getSupabase()
        .from("movimentacoes")
        .select("*")
        .gt("quantidade_restante", 0)
        .not("data_expiracao", "is", null)
        .gte("data_expiracao", hoje)
        .order("data_expiracao", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });
}

/**
 * Total de milhas a expirar na janela (RPC agregada — sem truncar por limit).
 */
export function useMilhasExpirando(dias = 90) {
  return useQuery({
    queryKey: queryKeys.milhasExpirando(dias),
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<number> => {
      const { data, error } = await getSupabase().rpc("milhas_expirando_em_dias", {
        p_dias: dias,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

export function useUpdateMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      conta_id: string;
      tipo: TipoMovimentacao;
      quantidade: number;
      data: string;
      data_expiracao?: string | null;
      origem?: OrigemCredito | null;
      descricao?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from("movimentacoes")
        .update({
          conta_id: input.conta_id,
          tipo: input.tipo,
          quantidade: input.quantidade,
          data: input.data,
          data_expiracao: input.data_expiracao ?? null,
          origem: input.origem ?? null,
          descricao: input.descricao ?? null,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateMovimentacaoQueries(qc),
  });
}

export function useDeleteMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("movimentacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateMovimentacaoQueries(qc),
  });
}
