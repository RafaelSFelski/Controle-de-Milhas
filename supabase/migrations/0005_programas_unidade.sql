-- Unidade de pontuação por programa (milhas vs pontos).
alter table public.programas
  add column if not exists unidade text not null default 'milhas'
  check (unidade in ('milhas', 'pontos'));

-- Programas de coalizão/cartão usam "pontos".
update public.programas
set unidade = 'pontos'
where nome in (
  'Livelo',
  'Esfera',
  'Iupp',
  'Pontos Itaú',
  'Atacadão Pontos',
  'Membership Rewards'
);
