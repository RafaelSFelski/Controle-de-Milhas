"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Conta, Programa, Titular } from "@/types/database";
import { queryKeys } from "./keys";

export interface ContaComSaldo extends Conta {
  titular?: Pick<Titular, "id" | "nome"> | null;
  programa?: Pick<Programa, "id" | "nome" | "cor" | "categoria" | "validade_meses"> | null;
  saldo_atual: number;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function useContasComSaldo() {
  return useQuery({
    queryKey: queryKeys.contasComJoin,
    enabled: isSupabaseConfigured(),
    queryFn: async (): Promise<ContaComSaldo[]> => {
      const sb = getSupabase();
      const [contasRes, saldosRes] = await Promise.all([
        sb
          .from("contas")
          .select(
            "*, titular:titulares(id,nome), programa:programas(id,nome,cor,categoria,validade_meses)"
          )
          .order("created_at", { ascending: false }),
        sb.from("v_saldos_contas").select("conta_id, saldo"),
      ]);
      if (contasRes.error) throw contasRes.error;
      if (saldosRes.error) throw saldosRes.error;
      const saldoMap = new Map<string, number>();
      for (const s of (saldosRes.data ?? []) as Array<{
        conta_id: string;
        saldo: number;
      }>) {
        saldoMap.set(s.conta_id, Number(s.saldo) || 0);
      }
      const rows = (contasRes.data ?? []) as Array<
        Conta & {
          titular: unknown;
          programa: unknown;
        }
      >;
      return rows.map((row) => ({
        ...row,
        titular: pickOne<Pick<Titular, "id" | "nome">>(
          row.titular as Pick<Titular, "id" | "nome"> | Pick<Titular, "id" | "nome">[] | null
        ),
        programa: pickOne<Pick<Programa, "id" | "nome" | "cor" | "categoria" | "validade_meses">>(
          row.programa as
            | Pick<Programa, "id" | "nome" | "cor" | "categoria" | "validade_meses">
            | Pick<Programa, "id" | "nome" | "cor" | "categoria" | "validade_meses">[]
            | null
        ),
        saldo_atual: saldoMap.get(row.id) ?? 0,
      }));
    },
  });
}

// Alias para compatibilidade com código existente
export const useContas = useContasComSaldo;

export function useCreateConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      titular_id: string;
      programa_id: string;
      numero_conta?: string | null;
      saldo_inicial?: number;
    }) => {
      const sb = getSupabase();
      const { data: conta, error } = await sb
        .from("contas")
        .insert({
          titular_id: input.titular_id,
          programa_id: input.programa_id,
          numero_conta: input.numero_conta ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const c = conta as Conta;
      if (input.saldo_inicial && input.saldo_inicial !== 0) {
        const { error: errMov } = await sb.from("movimentacoes").insert({
          conta_id: c.id,
          tipo: "ajuste",
          quantidade: input.saldo_inicial,
          data: new Date().toISOString().slice(0, 10),
          data_expiracao: null,
          descricao: "Saldo inicial",
        });
        if (errMov) throw errMov;
      }
      return c;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contas });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
      qc.invalidateQueries({ queryKey: queryKeys.movimentacoes() });
      qc.invalidateQueries({ queryKey: queryKeys.expiracoes });
      qc.invalidateQueries({ queryKey: ["milhas-expirando"] });
    },
  });
}

export function useDeleteConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("contas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contas });
      qc.invalidateQueries({ queryKey: queryKeys.contasComJoin });
    },
  });
}
