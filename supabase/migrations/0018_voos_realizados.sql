-- Voos realizados (voados), separados dos resgates com milhas.
--
-- `voos` guarda o detalhe de um RESGATE (o débito de milhas que pagou o bilhete).
-- `voos_realizados` guarda trechos que o titular voou — inclusive os pagos em
-- dinheiro, que aparecem no extrato do programa como "acúmulo de voo".
--
-- Um trecho pode existir aqui sem linha em `voos` (voo pago) e vice-versa.
-- Não há vínculo obrigatório: são conceitos diferentes.

create table if not exists public.voos_realizados (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references public.contas(id) on delete set null,
  data date not null,
  -- IATA (`CWB`, `IGU`, `GIG`, `POA`, `BRC`)
  origem text not null,
  destino text not null,
  -- como o programa escreve o nome da cidade
  origem_nome text,
  destino_nome text,
  localizador text,
  companhia text,
  -- pontos resgatáveis ganhos no trecho (0 = só status)
  pontos numeric(14,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now()
);

-- Tabela nova nasce com RLS ligado no Supabase e a anon key passa a receber 200
-- com lista vazia. Mesmo tratamento de `voos` e `hospedagens`.
alter table public.voos_realizados disable row level security;

create index if not exists idx_voos_realizados_conta on public.voos_realizados(conta_id);
create index if not exists idx_voos_realizados_data on public.voos_realizados(data);

comment on table public.voos_realizados is
  'Trechos efetivamente voados pelo titular. Alimenta a aba "Voos realizados" em Meus Voos.';
comment on column public.voos_realizados.pontos is
  'Pontos resgatáveis ganhos no trecho. 0 quando o trecho só rendeu pontos de status.';
