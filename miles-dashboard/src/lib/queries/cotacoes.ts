"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Cotacao } from "@/types/database";
import { queryKeys } from "./keys";

export function useCotacoes() {
  return useQuery({
    queryKey: queryKeys.cotacoes,
    queryFn: async (): Promise<Cotacao[]> => {
      const { data, error } = await getSupabase()
        .from("cotacoes")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cotacao[];
    },
  });
}

/**
 * Cotação mais recente de cada programa.
 */
export function useCotacoesAtuais() {
  return useQuery({
    queryKey: ["cotacoes", "atuais"] as const,
    queryFn: async (): Promise<Cotacao[]> => {
      const { data, error } = await getSupabase()
        .from("cotacoes")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      const map = new Map<string, Cotacao>();
      for (const c of (data ?? []) as Cotacao[]) {
        if (!map.has(c.programa_id)) map.set(c.programa_id, c);
      }
      return Array.from(map.values());
    },
  });
}

export function useCreateCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      programa_id: string;
      valor_milheiro: number;
      data: string;
      fonte?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from("cotacoes")
        .insert({
          programa_id: input.programa_id,
          valor_milheiro: input.valor_milheiro,
          data: input.data,
          fonte: input.fonte ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cotacoes }),
  });
}

export function useDeleteCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("cotacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cotacoes }),
  });
}
