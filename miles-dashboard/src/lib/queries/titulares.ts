"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Titular } from "@/types/database";
import { queryKeys } from "./keys";

export function useTitulares() {
  return useQuery({
    queryKey: queryKeys.titulares,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<Titular[]> => {
      const { data, error } = await getSupabase()
        .from("titulares")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTitular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      cpf?: string | null;
      email?: string | null;
    }) => {
      const { data, error } = await getSupabase()
        .from("titulares")
        .insert({
          nome: input.nome,
          cpf: input.cpf ?? null,
          email: input.email ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.titulares }),
  });
}

export function useUpdateTitular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nome: string;
      cpf?: string | null;
      email?: string | null;
    }) => {
      const { error } = await getSupabase()
        .from("titulares")
        .update({
          nome: input.nome,
          cpf: input.cpf ?? null,
          email: input.email ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.titulares }),
  });
}

export function useDeleteTitular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("titulares")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.titulares });
      qc.invalidateQueries({ queryKey: queryKeys.contas });
    },
  });
}
