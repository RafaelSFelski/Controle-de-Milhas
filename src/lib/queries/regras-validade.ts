"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { OrigemCredito, ProgramaRegraValidade } from "@/types/database";
import { queryKeys } from "./keys";

export function useRegrasValidade(programaId?: string) {
  return useQuery({
    queryKey: programaId
      ? queryKeys.regrasValidade(programaId)
      : queryKeys.regrasValidadeAll,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<ProgramaRegraValidade[]> => {
      let q = getSupabase()
        .from("programas_regras_validade")
        .select("*")
        .order("origem", { ascending: true });
      if (programaId) q = q.eq("programa_id", programaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProgramaRegraValidade[];
    },
  });
}

export function useCreateRegraValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      programa_id: string;
      origem: OrigemCredito;
      validade_meses: number;
      descricao?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from("programas_regras_validade")
        .insert({
          programa_id: input.programa_id,
          origem: input.origem,
          validade_meses: input.validade_meses,
          descricao: input.descricao ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProgramaRegraValidade;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.regrasValidade(vars.programa_id) });
      qc.invalidateQueries({ queryKey: queryKeys.regrasValidadeAll });
    },
  });
}

export function useUpdateRegraValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      programa_id: string;
      validade_meses: number;
      descricao?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from("programas_regras_validade")
        .update({
          validade_meses: input.validade_meses,
          descricao: input.descricao ?? null,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as ProgramaRegraValidade;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.regrasValidade(vars.programa_id) });
      qc.invalidateQueries({ queryKey: queryKeys.regrasValidadeAll });
    },
  });
}

export function useDeleteRegraValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; programa_id: string }) => {
      const { error } = await getSupabase()
        .from("programas_regras_validade")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.regrasValidade(vars.programa_id) });
      qc.invalidateQueries({ queryKey: queryKeys.regrasValidadeAll });
    },
  });
}
