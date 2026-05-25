// Tipos manuais que refletem o schema em supabase/migrations/0001_init.sql.
// Usamos o cliente Supabase sem generics (any) e tipamos os retornos manualmente
// por simplicidade. Substitua por `npx supabase gen types typescript ...` se desejar.

export type CategoriaPrograma =
  | "aerea"
  | "cartao"
  | "bancario"
  | "varejo"
  | "hotel"
  | "outro";

export type TipoMovimentacao =
  | "credito"
  | "debito"
  | "transferencia_saida"
  | "transferencia_entrada"
  | "expiracao"
  | "assinatura"
  | "ajuste";

export type StatusAssinatura = "ativa" | "pausada" | "cancelada";

export interface Titular {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  created_at: string;
}

export interface Programa {
  id: string;
  nome: string;
  categoria: CategoriaPrograma;
  cor: string;
  logo_url: string | null;
  validade_meses: number;
  is_default: boolean;
  created_at: string;
}

export interface Conta {
  id: string;
  titular_id: string;
  programa_id: string;
  numero_conta: string | null;
  created_at: string;
}

export interface Movimentacao {
  id: string;
  conta_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  data: string;
  data_expiracao: string | null;
  descricao: string | null;
  transferencia_id: string | null;
  assinatura_id: string | null;
  created_at: string;
}

export interface Transferencia {
  id: string;
  conta_origem_id: string;
  conta_destino_id: string;
  quantidade_origem: number;
  quantidade_destino: number;
  bonus_percentual: number;
  taxa_conversao: number;
  custo_reais: number;
  data: string;
  observacao: string | null;
  created_at: string;
}

export interface Assinatura {
  id: string;
  conta_id: string;
  nome_plano: string;
  valor_mensal: number;
  dia_cobranca: number;
  milhas_mensais: number;
  data_inicio: string;
  data_fim: string | null;
  status: StatusAssinatura;
  created_at: string;
}

export interface Meta {
  id: string;
  conta_id: string | null;
  titular_id: string | null;
  descricao: string;
  quantidade_alvo: number;
  data_alvo: string | null;
  concluida: boolean;
  created_at: string;
}

export interface Cotacao {
  id: string;
  programa_id: string;
  valor_milheiro: number;
  data: string;
  fonte: string | null;
}

export interface SaldoContaView {
  conta_id: string;
  titular_id: string;
  programa_id: string;
  saldo: number;
}
