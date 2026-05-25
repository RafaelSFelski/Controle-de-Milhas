-- =============================================================
-- Milhas Dashboard — schema inicial
-- Banco compartilhado, sem autenticação (uso pessoal).
-- =============================================================

create extension if not exists "pgcrypto";

-- ----- titulares -----
create table if not exists public.titulares (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  email text,
  created_at timestamptz not null default now()
);

-- ----- programas -----
create table if not exists public.programas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  categoria text not null check (categoria in ('aerea','cartao','bancario','varejo','hotel','outro')),
  cor text not null default '#6366f1',
  logo_url text,
  validade_meses integer not null default 24,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----- contas (titular x programa) -----
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  titular_id uuid not null references public.titulares(id) on delete cascade,
  programa_id uuid not null references public.programas(id) on delete restrict,
  numero_conta text,
  created_at timestamptz not null default now(),
  unique (titular_id, programa_id)
);
create index if not exists idx_contas_titular on public.contas(titular_id);
create index if not exists idx_contas_programa on public.contas(programa_id);

-- ----- transferências -----
create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  conta_origem_id uuid not null references public.contas(id) on delete cascade,
  conta_destino_id uuid not null references public.contas(id) on delete cascade,
  quantidade_origem numeric(14,2) not null check (quantidade_origem > 0),
  quantidade_destino numeric(14,2) not null check (quantidade_destino > 0),
  bonus_percentual numeric(8,2) not null default 0,
  taxa_conversao numeric(8,4) not null default 1,
  custo_reais numeric(14,2) not null default 0,
  data date not null default current_date,
  observacao text,
  created_at timestamptz not null default now(),
  check (conta_origem_id <> conta_destino_id)
);
create index if not exists idx_transf_origem on public.transferencias(conta_origem_id);
create index if not exists idx_transf_destino on public.transferencias(conta_destino_id);
create index if not exists idx_transf_data on public.transferencias(data desc);

-- ----- assinaturas -----
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  nome_plano text not null,
  valor_mensal numeric(14,2) not null check (valor_mensal >= 0),
  dia_cobranca integer not null check (dia_cobranca between 1 and 31),
  milhas_mensais numeric(14,2) not null check (milhas_mensais >= 0),
  data_inicio date not null,
  data_fim date,
  status text not null default 'ativa' check (status in ('ativa','pausada','cancelada')),
  created_at timestamptz not null default now()
);
create index if not exists idx_assin_conta on public.assinaturas(conta_id);
create index if not exists idx_assin_status on public.assinaturas(status);

-- ----- movimentações -----
create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  tipo text not null check (tipo in (
    'credito','debito','transferencia_saida','transferencia_entrada',
    'expiracao','assinatura','ajuste'
  )),
  quantidade numeric(14,2) not null,
  data date not null default current_date,
  data_expiracao date,
  descricao text,
  transferencia_id uuid references public.transferencias(id) on delete cascade,
  assinatura_id uuid references public.assinaturas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mov_conta on public.movimentacoes(conta_id);
create index if not exists idx_mov_data on public.movimentacoes(data desc);
create index if not exists idx_mov_expir on public.movimentacoes(data_expiracao) where data_expiracao is not null;
create index if not exists idx_mov_assin on public.movimentacoes(assinatura_id) where assinatura_id is not null;

-- ----- metas -----
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references public.contas(id) on delete cascade,
  titular_id uuid references public.titulares(id) on delete cascade,
  descricao text not null,
  quantidade_alvo numeric(14,2) not null check (quantidade_alvo > 0),
  data_alvo date not null,
  concluida boolean not null default false,
  created_at timestamptz not null default now(),
  check (conta_id is not null or titular_id is not null)
);
create index if not exists idx_metas_conta on public.metas(conta_id);
create index if not exists idx_metas_titular on public.metas(titular_id);

-- ----- cotações (R$/milheiro) -----
create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas(id) on delete cascade,
  valor_milheiro numeric(10,2) not null check (valor_milheiro >= 0),
  data date not null default current_date,
  fonte text
);
create index if not exists idx_cot_programa on public.cotacoes(programa_id, data desc);

-- =============================================================
-- View: saldo por conta (calculado dinamicamente)
-- =============================================================
create or replace view public.v_saldos_contas as
select
  c.id as conta_id,
  c.titular_id,
  c.programa_id,
  coalesce(sum(m.quantidade), 0) as saldo
from public.contas c
left join public.movimentacoes m on m.conta_id = c.id
group by c.id, c.titular_id, c.programa_id;

-- =============================================================
-- RPC: criar transferência atomicamente
-- (1 linha em transferencias + 2 movimentações)
-- =============================================================
create or replace function public.criar_transferencia(
  p_conta_origem  uuid,
  p_conta_destino uuid,
  p_qtd_origem    numeric,
  p_qtd_destino   numeric,
  p_bonus_pct     numeric,
  p_taxa_conversao numeric,
  p_custo_reais   numeric,
  p_data          date,
  p_observacao    text,
  p_data_expiracao_destino date
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_conta_origem = p_conta_destino then
    raise exception 'Conta de origem e destino devem ser diferentes';
  end if;
  if p_qtd_origem <= 0 or p_qtd_destino <= 0 then
    raise exception 'Quantidades devem ser positivas';
  end if;

  insert into public.transferencias(
    conta_origem_id, conta_destino_id, quantidade_origem, quantidade_destino,
    bonus_percentual, taxa_conversao, custo_reais, data, observacao
  ) values (
    p_conta_origem, p_conta_destino, p_qtd_origem, p_qtd_destino,
    coalesce(p_bonus_pct,0), coalesce(p_taxa_conversao,1),
    coalesce(p_custo_reais,0), coalesce(p_data, current_date), p_observacao
  ) returning id into v_id;

  insert into public.movimentacoes(conta_id, tipo, quantidade, data, descricao, transferencia_id)
  values (p_conta_origem, 'transferencia_saida', -p_qtd_origem, p_data, 'Transferência saída', v_id);

  insert into public.movimentacoes(conta_id, tipo, quantidade, data, data_expiracao, descricao, transferencia_id)
  values (p_conta_destino, 'transferencia_entrada', p_qtd_destino, p_data, p_data_expiracao_destino, 'Transferência entrada', v_id);

  return v_id;
end;
$$;

-- =============================================================
-- RPC: gerar créditos do mês para assinaturas ativas (idempotente)
-- Cria movimentações tipo 'assinatura' para o mês corrente que ainda não tenham sido geradas.
-- =============================================================
create or replace function public.gerar_creditos_assinaturas_mes(p_ref_mes date default current_date)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  v_ano   integer := extract(year from p_ref_mes);
  v_mes   integer := extract(month from p_ref_mes);
  r record;
  v_data_credito date;
  v_data_expiracao date;
  v_validade_meses int;
begin
  for r in
    select a.id, a.conta_id, a.milhas_mensais, a.dia_cobranca, a.data_inicio, a.data_fim,
           p.validade_meses
    from public.assinaturas a
    join public.contas c on c.id = a.conta_id
    join public.programas p on p.id = c.programa_id
    where a.status = 'ativa'
      and a.milhas_mensais > 0
      and a.data_inicio <= (date_trunc('month', p_ref_mes) + interval '1 month - 1 day')::date
      and (a.data_fim is null or a.data_fim >= date_trunc('month', p_ref_mes)::date)
  loop
    v_data_credito := make_date(
      v_ano, v_mes,
      least(r.dia_cobranca, extract(day from (date_trunc('month', p_ref_mes) + interval '1 month - 1 day'))::int)
    );

    -- idempotência: pula se já existe movimentação dessa assinatura no mês
    if exists (
      select 1 from public.movimentacoes m
      where m.assinatura_id = r.id
        and date_trunc('month', m.data) = date_trunc('month', p_ref_mes)
    ) then
      continue;
    end if;

    v_validade_meses := coalesce(r.validade_meses, 24);
    v_data_expiracao := (v_data_credito + (v_validade_meses || ' months')::interval)::date;

    insert into public.movimentacoes(conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id)
    values (r.conta_id, 'assinatura', r.milhas_mensais, v_data_credito, v_data_expiracao, 'Crédito mensal de assinatura', r.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
