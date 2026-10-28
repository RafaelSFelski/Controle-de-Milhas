-- Hospedagens (estadias) — o detalhe que o extrato de pontos não traz.
--
-- Espelha `voos`: uma linha por estadia, ligada opcionalmente ao débito de
-- pontos que a pagou. O extrato só diz "Estadia paga com pontos: <hotel>";
-- hotel, datas e localizador vêm da API de reservas do programa.
--
-- `pontos` é positivo (débito do extrato entra negativo em movimentacoes).
-- Sem coluna de dinheiro: o programa não informa quanto foi pago em R$.

create table if not exists public.hospedagens (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references public.contas(id) on delete set null,
  -- resgate de pontos que pagou a estadia (nulo quando foi paga em dinheiro)
  movimentacao_id uuid references public.movimentacoes(id) on delete set null,
  hotel text not null,
  marca text,
  categoria smallint,
  cidade text,
  estado text,
  pais text,
  endereco text,
  check_in date not null,
  check_out date not null,
  noites integer not null default 1,
  hospedes integer,
  quarto text,
  pontos numeric(14,2) not null default 0,
  -- valor da estadia em R$ (tarifa com impostos); não é o dinheiro pago no resgate
  valor numeric(14,2),
  localizador text,
  status text not null default 'concluida'
    check (status in ('reservada', 'em_andamento', 'concluida', 'cancelada')),
  observacao text,
  created_at timestamptz not null default now()
);

-- O Supabase liga RLS por padrão em tabela nova; sem isso a anon key recebe 200
-- com lista vazia (mesmo problema que aconteceu com `voos`).
alter table public.hospedagens disable row level security;

create index if not exists idx_hospedagens_conta on public.hospedagens(conta_id);
create index if not exists idx_hospedagens_movimentacao on public.hospedagens(movimentacao_id);
create index if not exists idx_hospedagens_check_in on public.hospedagens(check_in);

comment on table public.hospedagens is
  'Estadias: hotel, datas, noites e pontos. Alimenta a página Minhas Hospedagens.';
comment on column public.hospedagens.pontos is
  'Pontos usados na estadia (positivo). 0 quando a estadia foi paga em dinheiro.';
comment on column public.hospedagens.valor is
  'Valor da estadia em R$ (tarifa com impostos). Em resgate, é quanto a estadia custaria em dinheiro, não necessariamente o que foi pago.';
comment on column public.hospedagens.movimentacao_id is
  'Débito "Estadia paga com pontos" que pagou a hospedagem. NULL quando não houve resgate.';
