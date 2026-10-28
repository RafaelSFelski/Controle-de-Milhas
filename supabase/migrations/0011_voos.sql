-- Voos: detalhe de cada trecho resgatado (ou comprado) com milhas.
--
-- Por que uma tabela separada de `movimentacoes`:
--   * `movimentacoes` é o extrato/ledger (data do resgate, milhas, R$ de taxa).
--   * um voo tem dados que não pertencem ao ledger: data do voo, rota,
--     passageiros, localizador (PNR), companhia, número do voo e horários.
--   * um resgate pode gerar mais de um trecho (ida/volta), e um voo pode
--     existir sem movimentação (comprado em dinheiro).
--
-- Milhas e R$ NÃO são duplicados aqui: a página lê de `movimentacoes` pela FK
-- `movimentacao_id`. Fonte única de verdade continua sendo o ledger.

create table if not exists public.voos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references public.contas(id) on delete set null,
  -- Resgate que pagou o voo. Se a movimentação for excluída, o voo sai junto.
  movimentacao_id uuid unique references public.movimentacoes(id) on delete cascade,
  data_voo date not null,
  origem text not null,
  destino text not null,
  passageiros text[] not null default '{}',
  localizador text,
  companhia text,
  numero_voo text,
  hora_saida time,
  hora_chegada time,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_voos_data on public.voos(data_voo desc);
create index if not exists idx_voos_conta on public.voos(conta_id);

-- O Supabase liga RLS por padrão em tabelas novas do schema public; as demais
-- tabelas do app rodam sem RLS (uso pessoal, sem autenticação). Sem isto, a
-- anon key recebe 200 com lista vazia.
alter table public.voos disable row level security;

comment on table public.voos is
  'Trechos de voo resgatados com milhas (ou comprados). Milhas/R$ vêm da movimentação vinculada.';
comment on column public.voos.movimentacao_id is
  'Resgate no ledger que pagou este trecho. Excluir a movimentação remove o voo (cascade).';
comment on column public.voos.passageiros is
  'Nomes dos passageiros do trecho, como constam no bilhete.';
