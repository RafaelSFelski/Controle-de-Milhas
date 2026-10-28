"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Conta, Hospedagem, Movimentacao, Programa } from "@/types/database";
import { queryKeys } from "./keys";

/** Estadia + o resgate que a pagou e o programa usado. */
export interface HospedagemDetalhada extends Hospedagem {
  movimentacao?: Pick<
    Movimentacao,
    "id" | "data" | "quantidade" | "descricao"
  > | null;
  conta?: (Pick<Conta, "id" | "numero_conta"> & {
    programa?: Pick<Programa, "id" | "nome" | "cor"> | null;
  }) | null;
}

/** Pontos usados na estadia (0 quando foi paga em dinheiro). */
export function pontosDaHospedagem(h: HospedagemDetalhada): number {
  return Number(h.pontos ?? 0);
}

/** Valor da estadia em R$ (tarifa com impostos). 0 quando desconhecido. */
export function valorDaHospedagem(h: HospedagemDetalhada): number {
  return Number(h.valor ?? 0);
}

/** Quanto custaria por noite, em R$. */
export function valorPorNoiteDaHospedagem(h: HospedagemDetalhada): number {
  const noites = Number(h.noites ?? 0);
  if (noites <= 0) return 0;
  return valorDaHospedagem(h) / noites;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function useHospedagens() {
  return useQuery({
    queryKey: queryKeys.hospedagens,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<HospedagemDetalhada[]> => {
      const { data, error } = await getSupabase()
        .from("hospedagens")
        .select(
          "*, movimentacao:movimentacoes(id,data,quantidade,descricao), conta:contas(id,numero_conta,programa:programas(id,nome,cor))"
        )
        .order("check_in", { ascending: false });
      if (error) throw error;

      return ((data ?? []) as HospedagemDetalhada[]).map((row) => ({
        ...row,
        movimentacao: pickOne(row.movimentacao),
        conta: pickOne(row.conta),
      }));
    },
  });
}

/**
 * Débitos do ledger que descrevem resgate de estadia (inclui os que ainda não
 * têm hotel/datas cadastrados). Serve para a página não esconder resgates.
 */
export function useResgatesEstadia() {
  return useQuery({
    queryKey: queryKeys.resgatesEstadia,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<
      Pick<Movimentacao, "id" | "conta_id" | "data" | "quantidade" | "descricao">[]
    > => {
      const { data, error } = await getSupabase()
        .from("movimentacoes")
        .select("id, conta_id, data, quantidade, descricao")
        .eq("tipo", "debito")
        .ilike("descricao", "Estadia paga com pontos%")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
