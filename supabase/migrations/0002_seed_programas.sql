-- Seed: programas brasileiros mais comuns.
-- Idempotente via UNIQUE(nome).

insert into public.programas (nome, categoria, cor, validade_meses, is_default) values
  ('Smiles',                 'aerea',    '#FF6900', 36, true),
  ('Latam Pass',             'aerea',    '#E10A18', 24, true),
  ('TudoAzul',               'aerea',    '#00C2FF', 24, true),
  ('Livelo',                 'bancario', '#E5006D', 24, true),
  ('Esfera',                 'bancario', '#0050B3', 24, true),
  ('Iupp',                   'bancario', '#5B2D90', 24, true),
  ('LifeMiles',              'aerea',    '#0066CC', 12, true),
  ('Membership Rewards',     'cartao',   '#016FD0', 12, true),
  ('Pontos Itaú',            'bancario', '#EC7000', 24, true),
  ('Atacadão Pontos',        'varejo',   '#00529B', 12, true),
  ('Hilton Honors',          'hotel',    '#0F2F5F', 12, true),
  ('Marriott Bonvoy',        'hotel',    '#A1996F', 24, true),
  ('All Accor',              'hotel',    '#252359', 24, true)
on conflict (nome) do nothing;
