// Cálculos centralizados do dashboard de milhas.

import { addMonths, differenceInDays, parseISO } from "date-fns";

/**
 * Calcula a quantidade de milhas no destino após aplicar taxa de conversão e bônus.
 * Ex: 10000 origem * 1.0 taxa * (1 + 100/100 bônus) = 20000 destino
 */
export function calcularTransferencia(
  quantidadeOrigem: number,
  taxaConversao: number,
  bonusPercentual: number
): number {
  const fatorBonus = 1 + (bonusPercentual ?? 0) / 100;
  const resultado = (quantidadeOrigem ?? 0) * (taxaConversao ?? 1) * fatorBonus;
  return Math.round(resultado * 100) / 100;
}

/**
 * Custo em R$ por milha de uma assinatura.
 */
export function custoPorMilha(
  valorMensal: number,
  milhasMensais: number
): number {
  if (!milhasMensais || milhasMensais <= 0) return 0;
  return valorMensal / milhasMensais;
}

/**
 * Custo por milheiro (R$ por 1000 milhas) — métrica padrão para avaliar clubes de fidelidade.
 */
export function custoPorMilheiro(
  valorMensal: number,
  milhasMensais: number
): number {
  if (!milhasMensais || milhasMensais <= 0) return 0;
  return (valorMensal / milhasMensais) * 1000;
}

/**
 * Valor estimado da carteira: soma de (saldo / 1000) * cotação_milheiro.
 * cotacoesMap: { programaId: valor_milheiro }
 */
export function valorEstimadoCarteira(
  saldosPorPrograma: Array<{ programa_id: string; saldo: number }>,
  cotacoesMap: Record<string, number>
): number {
  return saldosPorPrograma.reduce((acc, item) => {
    const cotacao = cotacoesMap[item.programa_id] ?? 0;
    return acc + (item.saldo / 1000) * cotacao;
  }, 0);
}

/**
 * Cotação atual (mais recente) por programa.
 */
export function cotacoesAtuaisPorPrograma(
  cotacoes: Array<{ programa_id: string; data: string; valor_milheiro: number }>
): Record<string, number> {
  const map: Record<string, { data: string; valor: number }> = {};
  for (const c of cotacoes) {
    const cur = map[c.programa_id];
    if (!cur || c.data > cur.data) {
      map[c.programa_id] = { data: c.data, valor: Number(c.valor_milheiro) };
    }
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) out[k] = v.valor;
  return out;
}

/**
 * Soma das milhas que expiram dentro de uma janela (em dias) a partir de hoje.
 */
export function milhasExpirandoEmDias(
  movimentacoes: Array<{ quantidade: number; data_expiracao: string | null }>,
  dias: number
): number {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(hoje.getDate() + dias);

  return movimentacoes.reduce((acc, m) => {
    if (!m.data_expiracao || Number(m.quantidade) <= 0) return acc;
    const exp = parseISO(m.data_expiracao);
    if (exp >= hoje && exp <= limite) return acc + Number(m.quantidade);
    return acc;
  }, 0);
}

/**
 * Projeção: quantos meses faltam para atingir a meta com base na média mensal de acúmulo.
 * Retorna null se mediaMensal <= 0; retorna 0 se já atingiu.
 */
export function projecaoMeta(
  saldoAtual: number,
  alvo: number,
  mediaMensal: number
): number | null {
  if (saldoAtual >= alvo) return 0;
  if (!mediaMensal || mediaMensal <= 0) return null;
  return Math.ceil((alvo - saldoAtual) / mediaMensal);
}

/**
 * Calcula a data de expiração de uma movimentação de crédito,
 * baseado na validade do programa em meses.
 */
export function calcularDataExpiracao(
  dataCredito: Date | string,
  validadeMeses: number
): Date {
  const base =
    typeof dataCredito === "string" ? parseISO(dataCredito) : dataCredito;
  return addMonths(base, validadeMeses);
}

/**
 * Dias até expiração (positivo: futuro, negativo: já expirou).
 */
export function diasAteExpiracao(dataExpiracao: string | Date): number {
  const exp =
    typeof dataExpiracao === "string"
      ? parseISO(dataExpiracao)
      : dataExpiracao;
  return differenceInDays(exp, new Date());
}
