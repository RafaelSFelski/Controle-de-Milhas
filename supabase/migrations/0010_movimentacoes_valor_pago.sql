-- Valor pago em R$ associado a uma movimentação.
-- Uso principal: taxas/embarque pagos em resgates (débitos), permitindo calcular
-- custo efetivo do resgate (R$ por milheiro) e custo médio das milhas.
-- Nullable: créditos de extrato normalmente não têm valor associado.

alter table public.movimentacoes
  add column if not exists valor_pago numeric(14,2);

comment on column public.movimentacoes.valor_pago is
  'Valor em R$ pago na operação (ex.: taxas de embarque em resgate). NULL quando não se aplica ou é desconhecido.';
