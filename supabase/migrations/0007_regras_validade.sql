-- Regras de validade por origem dos pontos/milhas em cada programa.
-- A validade padrão (programas.validade_meses) continua como fallback.

create table if not exists public.programas_regras_validade (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.programas(id) on delete cascade,
  origem text not null check (
    origem in ('cartao', 'compra', 'transferencia', 'assinatura', 'promocao', 'parceiro', 'ajuste', 'outro')
  ),
  validade_meses integer not null check (validade_meses > 0),
  descricao text,
  created_at timestamptz not null default now(),
  unique (programa_id, origem)
);

create index if not exists idx_regras_validade_programa
  on public.programas_regras_validade(programa_id);

alter table public.movimentacoes
  add column if not exists origem text check (
    origem is null or origem in (
      'cartao', 'compra', 'transferencia', 'assinatura', 'promocao', 'parceiro', 'ajuste', 'outro'
    )
  );

-- Resolve validade em meses: regra específica → validade padrão do programa → 24.
create or replace function public.validade_meses_programa(
  p_programa_id uuid,
  p_origem text default null
) returns integer
language sql
stable
as $$
  select coalesce(
    (
      select r.validade_meses
      from public.programas_regras_validade r
      where r.programa_id = p_programa_id
        and r.origem = p_origem
    ),
    (select p.validade_meses from public.programas p where p.id = p_programa_id),
    24
  );
$$;

-- Seeds de exemplo para programas comuns (podem ser editados na UI).
insert into public.programas_regras_validade (programa_id, origem, validade_meses, descricao)
select p.id, v.origem, v.validade_meses, v.descricao
from public.programas p
cross join (
  values
    ('cartao',        24, 'Cartão de crédito'),
    ('transferencia', 24, 'Transferência de outro programa'),
    ('assinatura',    36, 'Clube / assinatura'),
    ('promocao',      12, 'Promoções e bônus temporários')
) as v(origem, validade_meses, descricao)
where p.nome = 'Smiles'
on conflict (programa_id, origem) do nothing;

insert into public.programas_regras_validade (programa_id, origem, validade_meses, descricao)
select p.id, v.origem, v.validade_meses, v.descricao
from public.programas p
cross join (
  values
    ('cartao',        24, 'Cartão de crédito'),
    ('compra',        24, 'Compra direta de pontos'),
    ('transferencia', 24, 'Transferência para programa aéreo'),
    ('parceiro',      12, 'Compras em lojas parceiras')
) as v(origem, validade_meses, descricao)
where p.nome = 'Livelo'
on conflict (programa_id, origem) do nothing;

insert into public.programas_regras_validade (programa_id, origem, validade_meses, descricao)
select p.id, v.origem, v.validade_meses, v.descricao
from public.programas p
cross join (
  values
    ('cartao',        24, 'Cartão de crédito'),
    ('transferencia', 24, 'Transferência de outro programa'),
    ('parceiro',      12, 'Estadias e parceiros')
) as v(origem, validade_meses, descricao)
where p.nome = 'All Accor'
on conflict (programa_id, origem) do nothing;

-- RPCs de assinatura passam a usar validade por origem.
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
  v_quantidade numeric(14,2);
begin
  for r in
    select a.id, a.conta_id, a.milhas_mensais, a.dia_cobranca, a.data_inicio, a.data_fim,
           a.bonus_percentual, a.bonus_fixo,
           c.programa_id
    from public.assinaturas a
    join public.contas c on c.id = a.conta_id
    where a.status = 'ativa'
      and a.milhas_mensais > 0
      and a.data_inicio <= (date_trunc('month', p_ref_mes) + interval '1 month - 1 day')::date
      and (a.data_fim is null or a.data_fim >= date_trunc('month', p_ref_mes)::date)
  loop
    v_data_credito := make_date(
      v_ano, v_mes,
      least(r.dia_cobranca, extract(day from (date_trunc('month', p_ref_mes) + interval '1 month - 1 day'))::int)
    );

    if exists (
      select 1 from public.movimentacoes m
      where m.assinatura_id = r.id
        and date_trunc('month', m.data) = date_trunc('month', p_ref_mes)
        and m.tipo = 'assinatura'
    ) then
      continue;
    end if;

    v_validade_meses := public.validade_meses_programa(r.programa_id, 'assinatura');
    v_data_expiracao := (v_data_credito + (v_validade_meses || ' months')::interval)::date;

    v_quantidade := round(
      r.milhas_mensais * (1 + coalesce(r.bonus_percentual, 0) / 100.0)
      + coalesce(r.bonus_fixo, 0),
      2
    );

    insert into public.movimentacoes(
      conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id, origem
    ) values (
      r.conta_id, 'assinatura', v_quantidade, v_data_credito, v_data_expiracao,
      'Crédito mensal de assinatura' ||
        case when coalesce(r.bonus_percentual,0) > 0 or coalesce(r.bonus_fixo,0) > 0
             then ' (com bônus)' else '' end,
      r.id, 'assinatura'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.gerar_creditos_retroativos_assinatura(p_assinatura_id uuid)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
  r record;
  v_validade_meses int;
  v_mes date;
  v_fim date;
  v_ultimo_dia int;
  v_data_credito date;
  v_data_expiracao date;
  v_quantidade numeric(14,2);
begin
  select a.id, a.conta_id, a.milhas_mensais, a.dia_cobranca, a.data_inicio, a.data_fim,
         a.bonus_percentual, a.bonus_fixo,
         c.programa_id
    into r
  from public.assinaturas a
  join public.contas c on c.id = a.conta_id
  where a.id = p_assinatura_id;

  if not found then
    raise exception 'Assinatura % não encontrada', p_assinatura_id;
  end if;

  if coalesce(r.milhas_mensais, 0) <= 0 then
    return 0;
  end if;

  v_validade_meses := public.validade_meses_programa(r.programa_id, 'assinatura');
  v_mes := date_trunc('month', r.data_inicio)::date;
  v_fim := date_trunc('month', least(current_date, coalesce(r.data_fim, current_date)))::date;

  while v_mes <= v_fim loop
    v_ultimo_dia := extract(day from (v_mes + interval '1 month - 1 day'))::int;
    v_data_credito := make_date(
      extract(year from v_mes)::int,
      extract(month from v_mes)::int,
      least(r.dia_cobranca, v_ultimo_dia)
    );

    if not exists (
      select 1 from public.movimentacoes m
      where m.assinatura_id = r.id
        and m.tipo = 'assinatura'
        and date_trunc('month', m.data) = v_mes
    ) then
      v_quantidade := round(
        r.milhas_mensais * (1 + coalesce(r.bonus_percentual, 0) / 100.0)
        + coalesce(r.bonus_fixo, 0),
        2
      );
      v_data_expiracao := (v_data_credito + (v_validade_meses || ' months')::interval)::date;

      insert into public.movimentacoes(
        conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id, origem
      ) values (
        r.conta_id, 'assinatura', v_quantidade, v_data_credito, v_data_expiracao,
        'Crédito mensal de assinatura' ||
          case when coalesce(r.bonus_percentual, 0) > 0 or coalesce(r.bonus_fixo, 0) > 0
               then ' (com bônus)' else '' end,
        r.id, 'assinatura'
      );

      v_count := v_count + 1;
    end if;

    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  return v_count;
end;
$$;

create or replace function public.aplicar_bonus_adesao_assinatura(p_assinatura_id uuid)
returns numeric
language plpgsql
as $$
declare
  r record;
  v_validade_meses int;
  v_data date := current_date;
  v_data_expiracao date;
begin
  select a.id, a.conta_id, a.bonus_adesao, a.bonus_adesao_creditado, a.data_inicio,
         c.programa_id
    into r
  from public.assinaturas a
  join public.contas c on c.id = a.conta_id
  where a.id = p_assinatura_id;

  if not found then
    raise exception 'Assinatura % não encontrada', p_assinatura_id;
  end if;

  if r.bonus_adesao_creditado or coalesce(r.bonus_adesao, 0) <= 0 then
    return 0;
  end if;

  v_validade_meses := public.validade_meses_programa(r.programa_id, 'promocao');
  v_data := coalesce(r.data_inicio, current_date);
  v_data_expiracao := (v_data + (v_validade_meses || ' months')::interval)::date;

  insert into public.movimentacoes(
    conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id, origem
  ) values (
    r.conta_id, 'assinatura', r.bonus_adesao, v_data, v_data_expiracao,
    'Bônus de adesão', r.id, 'promocao'
  );

  update public.assinaturas
     set bonus_adesao_creditado = true
   where id = r.id;

  return r.bonus_adesao;
end;
$$;

-- Transferência: registra origem e calcula expiração da compra de pontos.
drop function if exists public.criar_transferencia(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric, date, text, date, numeric
);

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
  p_data_expiracao_destino date,
  p_pontos_comprados numeric default 0
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_programa_origem uuid;
  v_validade_compra int;
  v_data_expiracao_compra date;
begin
  if p_conta_origem = p_conta_destino then
    raise exception 'Conta de origem e destino devem ser diferentes';
  end if;
  if p_qtd_origem <= 0 or p_qtd_destino <= 0 then
    raise exception 'Quantidades devem ser positivas';
  end if;

  select c.programa_id into v_programa_origem
  from public.contas c where c.id = p_conta_origem;

  insert into public.transferencias(
    conta_origem_id, conta_destino_id, quantidade_origem, quantidade_destino,
    bonus_percentual, taxa_conversao, custo_reais, data, observacao
  ) values (
    p_conta_origem, p_conta_destino, p_qtd_origem, p_qtd_destino,
    coalesce(p_bonus_pct,0), coalesce(p_taxa_conversao,1),
    coalesce(p_custo_reais,0), coalesce(p_data, current_date), p_observacao
  ) returning id into v_id;

  if coalesce(p_pontos_comprados, 0) > 0 then
    v_validade_compra := public.validade_meses_programa(v_programa_origem, 'compra');
    v_data_expiracao_compra := (
      coalesce(p_data, current_date) + (v_validade_compra || ' months')::interval
    )::date;

    insert into public.movimentacoes(
      conta_id, tipo, quantidade, data, data_expiracao, descricao, transferencia_id, origem
    ) values (
      p_conta_origem, 'credito', p_pontos_comprados, coalesce(p_data, current_date),
      v_data_expiracao_compra, 'Compra de pontos para transferência', v_id, 'compra'
    );
  end if;

  insert into public.movimentacoes(conta_id, tipo, quantidade, data, descricao, transferencia_id)
  values (p_conta_origem, 'transferencia_saida', -p_qtd_origem, p_data, 'Transferência saída', v_id);

  insert into public.movimentacoes(
    conta_id, tipo, quantidade, data, data_expiracao, descricao, transferencia_id, origem
  ) values (
    p_conta_destino, 'transferencia_entrada', p_qtd_destino, p_data,
    p_data_expiracao_destino, 'Transferência entrada', v_id, 'transferencia'
  );

  return v_id;
end;
$$;
