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

export type UnidadePrograma = "milhas" | "pontos";

export type OrigemCredito =
  | "cartao"
  | "compra"
  | "transferencia"
  | "assinatura"
  | "promocao"
  | "parceiro"
  | "ajuste"
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
  unidade: UnidadePrograma;
  is_default: boolean;
  created_at: string;
}

export interface ProgramaRegraValidade {
  id: string;
  programa_id: string;
  origem: OrigemCredito;
  validade_meses: number;
  descricao: string | null;
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
  /** Saldo ainda disponível no crédito após consumo FIFO; null em débitos. */
  quantidade_restante: number | null;
  data: string;
  data_expiracao: string | null;
  origem: OrigemCredito | null;
  descricao: string | null;
  transferencia_id: string | null;
  assinatura_id: string | null;
  /** Dinheiro efetivamente pago (taxas de embarque), só em resgates de voo. */
  valor_pago?: number | null;
  created_at: string;
}

export interface Voo {
  id: string;
  conta_id: string | null;
  /** Movimentação (resgate) que pagou o trecho; pode ter várias linhas em `voos`. */
  movimentacao_id: string | null;
  data_voo: string;
  origem: string;
  destino: string;
  /** Passageiro do bilhete — um pedido com n passageiros gera n linhas. */
  passageiro: string;
  /** Milhas atribuídas a este passageiro (rateio do resgate). */
  milhas: number;
  /** R$ atribuído a este passageiro (rateio do pedido). */
  valor_pago: number | null;
  localizador: string | null;
  companhia: string | null;
  numero_voo: string | null;
  /** Horário no formato `HH:MM:SS` (coluna `time` do Postgres). */
  hora_saida: string | null;
  hora_chegada: string | null;
  observacao: string | null;
  created_at: string;
}

export interface Hospedagem {
  id: string;
  conta_id: string | null;
  /** Débito de pontos que pagou a estadia; NULL quando foi paga em dinheiro. */
  movimentacao_id: string | null;
  hotel: string;
  marca: string | null;
  categoria: number | null;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  endereco: string | null;
  check_in: string;
  check_out: string;
  noites: number;
  hospedes: number | null;
  quarto: string | null;
  /** Pontos usados na estadia (positivo). 0 = paga em dinheiro. */
  pontos: number;
  /** Valor da estadia em R$ (tarifa com impostos); não é o dinheiro pago no resgate. */
  valor: number | null;
  localizador: string | null;
  status: "reservada" | "em_andamento" | "concluida" | "cancelada";
  observacao: string | null;
  created_at: string;
}

export interface VooRealizado {
  id: string;
  conta_id: string | null;
  data: string;
  /** IATA do aeroporto de origem (`CWB`). */
  origem: string;
  destino: string;
  /** Nome da cidade como o programa escreve. */
  origem_nome: string | null;
  destino_nome: string | null;
  localizador: string | null;
  companhia: string | null;
  /** Pontos resgatáveis ganhos no trecho (0 = só status). */
  pontos: number;
  observacao: string | null;
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
  /** Bônus % aplicado sobre milhas_mensais a cada crédito mensal. */
  bonus_percentual: number;
  /** Milhas extras somadas após o percentual a cada crédito mensal. */
  bonus_fixo: number;
  /** Bônus único creditado ao contratar (one-time). */
  bonus_adesao: number;
  /** True se o bônus de adesão já foi creditado. */
  bonus_adesao_creditado: boolean;
  created_at: string;
}

export interface Meta {
  id: string;
  conta_id: string | null;
  titular_id: string | null;
  descricao: string;
  quantidade_alvo: number;
  /** NOT NULL no schema SQL. */
  data_alvo: string;
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

