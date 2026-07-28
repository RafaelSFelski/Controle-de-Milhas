import type { OrigemCredito, ProgramaRegraValidade } from "@/types/database";

export const ORIGENS_CREDITO: {
  value: OrigemCredito;
  label: string;
  descricao: string;
}[] = [
  { value: "cartao", label: "Cartão de crédito", descricao: "Pontos/milhas do cartão" },
  { value: "compra", label: "Compra direta", descricao: "Compra de pontos no programa" },
  {
    value: "transferencia",
    label: "Transferência",
    descricao: "Crédito vindo de outro programa",
  },
  { value: "assinatura", label: "Assinatura / clube", descricao: "Créditos de clube de fidelidade" },
  { value: "promocao", label: "Promoção / bônus", descricao: "Campanhas e bônus temporários" },
  { value: "parceiro", label: "Parceiro", descricao: "Lojas, hotéis e parceiros" },
  { value: "ajuste", label: "Ajuste manual", descricao: "Correções e saldo inicial" },
  { value: "outro", label: "Outro", descricao: "Demais origens" },
];

export function labelOrigem(origem: OrigemCredito | null | undefined): string {
  if (!origem) return "—";
  return ORIGENS_CREDITO.find((o) => o.value === origem)?.label ?? origem;
}

/**
 * Resolve validade em meses: regra específica da origem → validade padrão do programa.
 */
export function resolverValidadeMeses(
  regras: Pick<ProgramaRegraValidade, "origem" | "validade_meses">[],
  origem: OrigemCredito | null | undefined,
  validadePadrao: number
): number {
  if (origem) {
    const regra = regras.find((r) => r.origem === origem);
    if (regra) return regra.validade_meses;
  }
  return validadePadrao > 0 ? validadePadrao : 24;
}
