"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CategoriaPrograma, Programa, UnidadePrograma } from "@/types/database";
import { queryKeys } from "./keys";

export function useProgramas() {
  return useQuery({
    queryKey: queryKeys.programas,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<Programa[]> => {
      const { data, error } = await getSupabase()
        .from("programas")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      categoria: CategoriaPrograma;
      cor: string;
      validade_meses: number;
      unidade: UnidadePrograma;
    }) => {
      const { data, error } = await getSupabase()
        .from("programas")
        .insert({
          nome: input.nome,
          categoria: input.categoria,
          cor: input.cor,
          validade_meses: input.validade_meses,
          unidade: input.unidade,
          is_default: false,
          logo_url: null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.programas }),
  });
}

export function useUpdatePrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nome: string;
      categoria: CategoriaPrograma;
      cor: string;
      validade_meses: number;
      unidade: UnidadePrograma;
    }) => {
      const { data, error } = await getSupabase()
        .from("programas")
        .update({
          nome: input.nome,
          categoria: input.categoria,
          cor: input.cor,
          validade_meses: input.validade_meses,
          unidade: input.unidade,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.programas }),
  });
}

export function useDeletePrograma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("programas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.programas }),
  });
}
