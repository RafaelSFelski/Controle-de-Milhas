// Cálculos centralizados do dashboard de milhas.

import { addMonths, parseISO } from "date-fns";

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
 * Calcula a quantidade efetiva de milhas creditadas mensalmente em uma assinatura,
 * considerando bônus percentual e bônus fixo.
 * Fórmula: milhas_mensais * (1 + bonus_percentual/100) + bonus_fixo
 */
export function milhasEfetivasMensais(
  milhasMensais: number,
  bonusPercentual = 0,
  bonusFixo = 0
): number {
  const base = (milhasMensais ?? 0) * (1 + (bonusPercentual ?? 0) / 100);
  return Math.round((base + (bonusFixo ?? 0)) * 100) / 100;
}

/**
 * Custo em R$ por milha de uma assinatura.
 * Considera bônus percentual e fixo no denominador (milhas efetivas).
 * Retorna 0 se milhas efetivas for inválido.
 */
function custoPorMilha(
  valorMensal: number,
  milhasMensais: number,
  bonusPercentual = 0,
  bonusFixo = 0
): number {
  const efetivas = milhasEfetivasMensais(milhasMensais, bonusPercentual, bonusFixo);
  if (!efetivas || efetivas <= 0) return 0;
  return valorMensal / efetivas;
}

/**
 * Custo por milheiro (1000 milhas) — métrica mais comum no mercado.
 */
export function custoPorMilheiro(
  valorMensal: number,
  milhasMensais: number,
  bonusPercentual = 0,
  bonusFixo = 0
): number {
  return (
    custoPorMilha(valorMensal, milhasMensais, bonusPercentual, bonusFixo) * 1000
  );
}

/**
 * Calcula a data de expiração de um crédito a partir da data e validade em meses.
 */
export function calcularDataExpiracao(
  dataCredito: Date | string,
  validadeMeses: number
): Date {
  const base =
    typeof dataCredito === "string" ? parseISO(dataCredito) : dataCredito;
  return addMonths(base, validadeMeses);
}
