-- Mantém o comportamento do app (uso pessoal, RLS desativado — ver AGENTS.md).
-- Projetos Supabase novos habilitam RLS por padrão em tabelas public.* criadas
-- via SQL editor, o que bloqueia o app (anon) por completo.
alter table public.titulares disable row level security;
alter table public.programas disable row level security;
alter table public.programas_regras_validade disable row level security;
alter table public.contas disable row level security;
alter table public.transferencias disable row level security;
alter table public.assinaturas disable row level security;
alter table public.movimentacoes disable row level security;
alter table public.metas disable row level security;
alter table public.cotacoes disable row level security;

-- Garante os privilégios padrão do PostgREST (necessário em projetos novos).
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
