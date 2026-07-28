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
 * Prefira `quantidade_restante` (pós-FIFO) quando disponível; cai em `quantidade`.
 */
export function milhasExpirandoEmDias(
  movimentacoes: Array<{
    quantidade: number;
    quantidade_restante?: number | null;
    data_expiracao: string | null;
  }>,
  dias: number
): number {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(hoje.getDate() + dias);

  return movimentacoes.reduce((acc, m) => {
    const restante =
      m.quantidade_restante != null
        ? Number(m.quantidade_restante)
        : Number(m.quantidade);
    if (!m.data_expiracao || restante <= 0) return acc;
    const exp = parseISO(m.data_expiracao);
    if (exp >= hoje && exp <= limite) return acc + restante;
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
export function custoPorMilha(
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
 * Dias até expiração (positivo: futuro, negativo: já expirou).
 */
export function diasAteExpiracao(dataExpiracao: string | Date): number {
  const exp =
    typeof dataExpiracao === "string"
      ? parseISO(dataExpiracao)
      : dataExpiracao;
  return differenceInDays(exp, new Date());
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
