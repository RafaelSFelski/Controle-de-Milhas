-- Índice que faltava para a FK de transferência.
--
-- O advisor "unindexed_foreign_keys" aponta que movimentacoes.transferencia_id não
-- tem índice de cobertura: ao apagar/atualizar uma transferência, o Postgres precisa
-- varrer movimentacoes inteira para achar as linhas filhas (as duas pernas do
-- lançamento: transferencia_saida e transferencia_entrada).

create index if not exists idx_movimentacoes_transferencia
  on public.movimentacoes(transferencia_id);

comment on index public.idx_movimentacoes_transferencia is
  'Cobre a FK movimentacoes.transferencia_id (advisor unindexed_foreign_keys).';
