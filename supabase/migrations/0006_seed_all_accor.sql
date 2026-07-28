-- All Accor (ALL — Accor Live Limitless) no catálogo padrão.
-- Idempotente via UNIQUE(nome).

insert into public.programas (nome, categoria, cor, validade_meses, is_default, unidade)
values ('All Accor', 'hotel', '#252359', 24, true, 'pontos')
on conflict (nome) do update
set
  categoria = excluded.categoria,
  cor = excluded.cor,
  validade_meses = excluded.validade_meses,
  is_default = excluded.is_default,
  unidade = excluded.unidade;
