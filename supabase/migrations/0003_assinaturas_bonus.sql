-- =============================================================
-- Adiciona suporte a bônus em assinaturas:
--  * bonus_percentual: % aplicado sobre milhas_mensais a cada crédito
--  * bonus_fixo: milhas extras somadas após o percentual a cada crédito
--  * bonus_adesao: milhas únicas creditadas ao contratar (one-time)
-- =============================================================

alter table public.assinaturas
  add column if not exists bonus_percentual numeric(8,2) not null default 0
    check (bonus_percentual >= 0),
  add column if not exists bonus_fixo numeric(14,2) not null default 0
    check (bonus_fixo >= 0),
  add column if not exists bonus_adesao numeric(14,2) not null default 0
    check (bonus_adesao >= 0),
  add column if not exists bonus_adesao_creditado boolean not null default false;

-- =============================================================
-- Atualiza a RPC de geração mensal para considerar bônus.
-- Fórmula: milhas_mensais * (1 + bonus_percentual/100) + bonus_fixo
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
  v_quantidade numeric(14,2);
begin
  for r in
    select a.id, a.conta_id, a.milhas_mensais, a.dia_cobranca, a.data_inicio, a.data_fim,
           a.bonus_percentual, a.bonus_fixo,
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
        and m.tipo = 'assinatura'
    ) then
      continue;
    end if;

    v_validade_meses := coalesce(r.validade_meses, 24);
    v_data_expiracao := (v_data_credito + (v_validade_meses || ' months')::interval)::date;

    v_quantidade := round(
      r.milhas_mensais * (1 + coalesce(r.bonus_percentual, 0) / 100.0)
      + coalesce(r.bonus_fixo, 0),
      2
    );

    insert into public.movimentacoes(conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id)
    values (
      r.conta_id, 'assinatura', v_quantidade, v_data_credito, v_data_expiracao,
      'Crédito mensal de assinatura' ||
        case when coalesce(r.bonus_percentual,0) > 0 or coalesce(r.bonus_fixo,0) > 0
             then ' (com bônus)' else '' end,
      r.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- =============================================================
-- RPC: aplicar bônus de adesão (idempotente).
-- Cria uma movimentação tipo 'assinatura' com a quantidade do bônus de adesão
-- e marca a assinatura como creditada. Pode ser chamada múltiplas vezes.
-- Retorna a quantidade creditada (0 se nada foi feito).
-- =============================================================
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
         p.validade_meses
    into r
  from public.assinaturas a
  join public.contas c on c.id = a.conta_id
  join public.programas p on p.id = c.programa_id
  where a.id = p_assinatura_id;

  if not found then
    raise exception 'Assinatura % não encontrada', p_assinatura_id;
  end if;

  if r.bonus_adesao_creditado or coalesce(r.bonus_adesao, 0) <= 0 then
    return 0;
  end if;

  v_validade_meses := coalesce(r.validade_meses, 24);
  v_data := coalesce(r.data_inicio, current_date);
  v_data_expiracao := (v_data + (v_validade_meses || ' months')::interval)::date;

  insert into public.movimentacoes(conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id)
  values (r.conta_id, 'assinatura', r.bonus_adesao, v_data, v_data_expiracao,
          'Bônus de adesão', r.id);

  update public.assinaturas
     set bonus_adesao_creditado = true
   where id = r.id;

  return r.bonus_adesao;
end;
$$;
