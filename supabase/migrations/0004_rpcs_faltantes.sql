-- =============================================================
-- Corrige RPCs chamadas pelo front que não existiam no banco:
--   * gerar_creditos_retroativos_assinatura(p_assinatura_id)
--   * criar_transferencia(...) agora aceita p_pontos_comprados
-- =============================================================

-- -------------------------------------------------------------
-- RPC: gera créditos mensais retroativos de UMA assinatura,
-- de data_inicio até o mês atual (ou data_fim, se anterior).
-- Idempotente: pula meses que já possuem crédito de assinatura.
-- Fórmula por mês: milhas_mensais * (1 + bonus_percentual/100) + bonus_fixo
-- Retorna a quantidade de meses creditados.
-- -------------------------------------------------------------
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
         p.validade_meses
    into r
  from public.assinaturas a
  join public.contas c on c.id = a.conta_id
  join public.programas p on p.id = c.programa_id
  where a.id = p_assinatura_id;

  if not found then
    raise exception 'Assinatura % não encontrada', p_assinatura_id;
  end if;

  if coalesce(r.milhas_mensais, 0) <= 0 then
    return 0;
  end if;

  v_validade_meses := coalesce(r.validade_meses, 24);
  v_mes := date_trunc('month', r.data_inicio)::date;
  v_fim := date_trunc('month', least(current_date, coalesce(r.data_fim, current_date)))::date;

  while v_mes <= v_fim loop
    v_ultimo_dia := extract(day from (v_mes + interval '1 month - 1 day'))::int;
    v_data_credito := make_date(
      extract(year from v_mes)::int,
      extract(month from v_mes)::int,
      least(r.dia_cobranca, v_ultimo_dia)
    );

    -- idempotência: pula meses já creditados para esta assinatura
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

      insert into public.movimentacoes(conta_id, tipo, quantidade, data, data_expiracao, descricao, assinatura_id)
      values (
        r.conta_id, 'assinatura', v_quantidade, v_data_credito, v_data_expiracao,
        'Crédito mensal de assinatura' ||
          case when coalesce(r.bonus_percentual, 0) > 0 or coalesce(r.bonus_fixo, 0) > 0
               then ' (com bônus)' else '' end,
        r.id
      );

      v_count := v_count + 1;
    end if;

    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  return v_count;
end;
$$;

-- -------------------------------------------------------------
-- RPC: recria criar_transferencia adicionando p_pontos_comprados.
-- Quando > 0, credita os pontos comprados na conta de ORIGEM antes
-- do débito da transferência (assim o saldo comporta a saída).
-- -------------------------------------------------------------
drop function if exists public.criar_transferencia(
  uuid, uuid, numeric, numeric, numeric, numeric, numeric, date, text, date
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

  -- pontos comprados creditados na conta de origem antes da saída
  if coalesce(p_pontos_comprados, 0) > 0 then
    insert into public.movimentacoes(conta_id, tipo, quantidade, data, descricao, transferencia_id)
    values (p_conta_origem, 'credito', p_pontos_comprados, coalesce(p_data, current_date),
            'Compra de pontos para transferência', v_id);
  end if;

  insert into public.movimentacoes(conta_id, tipo, quantidade, data, descricao, transferencia_id)
  values (p_conta_origem, 'transferencia_saida', -p_qtd_origem, p_data, 'Transferência saída', v_id);

  insert into public.movimentacoes(conta_id, tipo, quantidade, data, data_expiracao, descricao, transferencia_id)
  values (p_conta_destino, 'transferencia_entrada', p_qtd_destino, p_data, p_data_expiracao_destino, 'Transferência entrada', v_id);

  return v_id;
end;
$$;
