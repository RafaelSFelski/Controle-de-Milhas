"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import type { Assinatura, StatusAssinatura } from "@/types/database";
import { queryKeys } from "./keys";

export interface AssinaturaJoin extends Assinatura {
  conta: {
    id: string;
    titular: { id: string; nome: string };
    programa: { id: string; nome: string; cor: string };
  };
}

export function useAssinaturas() {
  return useQuery({
    queryKey: queryKeys.assinaturas,
    queryFn: async (): Promise<AssinaturaJoin[]> => {
      const { data, error } = await getSupabase()
        .from("assinaturas")
        .select(
          "*, conta:contas(id, titular:titulares(id,nome), programa:programas(id,nome,cor))"
        )
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = Assinatura & {
        conta:
          | {
              id: string;
              titular: { id: string; nome: string } | { id: string; nome: string }[];
              programa:
                | { id: string; nome: string; cor: string }
                | { id: string; nome: string; cor: string }[];
            }
          | {
              id: string;
              titular: { id: string; nome: string } | { id: string; nome: string }[];
              programa:
                | { id: string; nome: string; cor: string }
                | { id: string; nome: string; cor: string }[];
            }[];
      };
      const rows = (data ?? []) as unknown as Row[];
      const norm = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);
      return rows.map((r) => {
        const c = norm(r.conta);
        return {
          ...r,
          conta: {
            id: c.id,
            titular: norm(c.titular),
            programa: norm(c.programa),
          },
        } as AssinaturaJoin;
      });
    },
  });
}

export interface CreateAssinaturaInput {
  conta_id: string;
  nome_plano: string;
  valor_mensal: number;
  dia_cobranca: number;
  milhas_mensais: number;
  data_inicio: string;
  data_fim?: string | null;
  status?: StatusAssinatura;
}

export function useCreateAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssinaturaInput) => {
      const { data, error } = await getSupabase()
        .from("assinaturas")
        .insert({
          conta_id: input.conta_id,
          nome_plano: input.nome_plano,
          valor_mensal: input.valor_mensal,
          dia_cobranca: input.dia_cobranca,
          milhas_mensais: input.milhas_mensais,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim ?? null,
          status: input.status ?? "ativa",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.assinaturas }),
  });
}

export function useUpdateAssinaturaStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: StatusAssinatura }) => {
      const { error } = await getSupabase()
        .from("assinaturas")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.assinaturas }),
  });
}

export function useDeleteAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("assinaturas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.assinaturas }),
  });
}

export function useGerarCreditosMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ criadas: number }> => {
      const { data, error } = await getSupabase().rpc(
        "gerar_creditos_assinaturas_mes",
        {}
      );
      if (error) throw error;
      return { criadas: Number(data) || 0 };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
      qc.invalidateQueries({ queryKey: queryKeys.assinaturas });
    },
  });
}
