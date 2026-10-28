"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Conta, Movimentacao, Programa, Voo, VooRealizado } from "@/types/database";
import { queryKeys } from "./keys";

/** Trecho + o resgate que o pagou (data) e o programa usado. */
export interface VooDetalhado extends Voo {
  movimentacao?: Pick<Movimentacao, "id" | "data" | "quantidade" | "valor_pago" | "descricao"> | null;
  conta?: (Pick<Conta, "id" | "numero_conta"> & {
    programa?: Pick<Programa, "id" | "nome" | "cor"> | null;
  }) | null;
}

/** Milhas do passageiro neste trecho (já rateadas no banco). */
export function milhasDoVoo(voo: VooDetalhado): number {
  return Number(voo.milhas ?? 0);
}

/** Dinheiro pago atribuído a este passageiro (rateio do pedido). */
export function valorPagoDoVoo(voo: VooDetalhado): number {
  return Number(voo.valor_pago ?? 0);
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function useVoos() {
  return useQuery({
    queryKey: queryKeys.voos,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<VooDetalhado[]> => {
      const { data, error } = await getSupabase()
        .from("voos")
        .select(
          "*, movimentacao:movimentacoes(id,data,quantidade,valor_pago,descricao), conta:contas(id,numero_conta,programa:programas(id,nome,cor))"
        )
        .order("data_voo", { ascending: false })
        .order("passageiro", { ascending: true });
      if (error) throw error;

      return ((data ?? []) as VooDetalhado[]).map((row) => ({
        ...row,
        movimentacao: pickOne(row.movimentacao),
        conta: pickOne(row.conta),
      }));
    },
  });
}

/**
 * Débitos do ledger que descrevem resgate de voo (inclui os que ainda não têm
 * trecho detalhado). Serve para a página não esconder resgates não cadastrados.
 */
export function useResgatesVoo() {
  return useQuery({
    queryKey: queryKeys.resgatesVoo,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<
      Pick<Movimentacao, "id" | "conta_id" | "data" | "quantidade" | "valor_pago" | "descricao">[]
    > => {
      const { data, error } = await getSupabase()
        .from("movimentacoes")
        .select("id, conta_id, data, quantidade, valor_pago, descricao")
        .eq("tipo", "debito")
        .ilike("descricao", "Resgate de voo%")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Trechos que o titular realmente voou (não são resgates com milhas). */
export function useVoosRealizados() {
  return useQuery({
    queryKey: queryKeys.voosRealizados,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<VooRealizado[]> => {
      const { data, error } = await getSupabase()
        .from("voos_realizados")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VooRealizado[];
    },
  });
}
