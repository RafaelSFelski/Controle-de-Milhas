"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Meta } from "@/types/database";
import { queryKeys } from "./keys";

export interface MetaJoin extends Meta {
  conta:
    | {
        id: string;
        titular: { nome: string };
        programa: { nome: string; cor: string };
      }
    | null;
  titular: { nome: string } | null;
}

export function useMetas() {
  return useQuery({
    queryKey: queryKeys.metas,
    queryFn: async (): Promise<MetaJoin[]> => {
      const { data, error } = await getSupabase()
        .from("metas")
        .select(
          "*, conta:contas(id, titular:titulares(nome), programa:programas(nome,cor)), titular:titulares(nome)"
        )
        .order("data_alvo", { ascending: true });
      if (error) throw error;
      type Row = Meta & {
        conta:
          | {
              id: string;
              titular: { nome: string } | { nome: string }[];
              programa: { nome: string; cor: string } | { nome: string; cor: string }[];
            }
          | {
              id: string;
              titular: { nome: string } | { nome: string }[];
              programa: { nome: string; cor: string } | { nome: string; cor: string }[];
            }[]
          | null;
        titular: { nome: string } | { nome: string }[] | null;
      };
      const rows = (data ?? []) as unknown as Row[];
      const norm = <T,>(v: T | T[] | null): T | null =>
        v == null ? null : Array.isArray(v) ? v[0] ?? null : v;
      return rows.map((r) => {
        const conta = norm(r.conta);
        return {
          ...r,
          conta: conta
            ? {
                id: conta.id,
                titular: norm(conta.titular)!,
                programa: norm(conta.programa)!,
              }
            : null,
          titular: norm(r.titular),
        } as MetaJoin;
      });
    },
  });
}

export interface CreateMetaInput {
  conta_id: string | null;
  titular_id: string | null;
  descricao: string;
  quantidade_alvo: number;
  data_alvo: string | null;
}

export function useCreateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMetaInput) => {
      const { data, error } = await getSupabase()
        .from("metas")
        .insert({
          conta_id: input.conta_id,
          titular_id: input.titular_id,
          descricao: input.descricao,
          quantidade_alvo: input.quantidade_alvo,
          data_alvo: input.data_alvo,
          concluida: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.metas }),
  });
}

export function useUpdateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      concluida?: boolean;
      descricao?: string;
      quantidade_alvo?: number;
      data_alvo?: string | null;
    }) => {
      const { id, ...rest } = input;
      const { error } = await getSupabase()
        .from("metas")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.metas }),
  });
}

export const useToggleMetaConcluida = useUpdateMeta;

export function useDeleteMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("metas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.metas }),
  });
}
