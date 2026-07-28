// Chaves do React Query — centralizadas para invalidations consistentes.

export const queryKeys = {
  titulares: ["titulares"] as const,
  programas: ["programas"] as const,
  regrasValidade: (programaId: string) => ["regras-validade", programaId] as const,
  regrasValidadeAll: ["regras-validade"] as const,
  contas: ["contas"] as const,
  contasComJoin: ["contas", "join"] as const,
  saldos: ["saldos"] as const,
  movimentacoes: (contaId?: string) =>
    contaId
      ? (["movimentacoes", contaId] as const)
      : (["movimentacoes"] as const),
  expiracoes: ["expiracoes"] as const,
  milhasExpirando: (dias: number) => ["milhas-expirando", dias] as const,
  transferencias: ["transferencias"] as const,
  assinaturas: ["assinaturas"] as const,
  metas: ["metas"] as const,
  cotacoes: ["cotacoes"] as const,
};
