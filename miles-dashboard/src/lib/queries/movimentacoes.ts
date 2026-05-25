"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Movimentacao, TipoMovimentacao } from "@/types/database";
import { queryKeys } from "./keys";

export function useMovimentacoes(contaId?: string) {
  return useQuery({
    queryKey: queryKeys.movimentacoes(contaId),
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
          descricao: input.descricao ?? null,
          transferencia_id: null,
          assinatura_id: null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
    },
  });
}

/**
 * Lista de movimentações de crédito com data_expiracao no futuro,
 * ordenadas pela data de expiração mais próxima.
 */
export function useExpiracoes() {
  return useQuery({
    queryKey: ["expiracoes"] as const,
    queryFn: async (): Promise<Movimentacao[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await getSupabase()
        .from("movimentacoes")
        .select("*")
        .gt("quantidade", 0)
        .not("data_expiracao", "is", null)
        .gte("data_expiracao", hoje)
        .order("data_expiracao", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
    },
  });
}
