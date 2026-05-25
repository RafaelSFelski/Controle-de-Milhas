// Chaves do React Query — centralizadas para invalidations consistentes.

export const queryKeys = {
  titulares: ["titulares"] as const,
  programas: ["programas"] as const,
  contas: ["contas"] as const,
  contasComJoin: ["contas", "join"] as const,
  saldos: ["saldos"] as const,
  movimentacoes: (contaId?: string) =>
    contaId
      ? (["movimentacoes", contaId] as const)
      : (["movimentacoes"] as const),
  transferencias: ["transferencias"] as const,
  assinaturas: ["assinaturas"] as const,
  metas: ["metas"] as const,
  cotacoes: ["cotacoes"] as const,
};
