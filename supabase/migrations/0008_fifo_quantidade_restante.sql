-- FIFO: débitos / saídas / expirações consomem créditos mais antigos primeiro.
-- quantidade_restante reflete o saldo ainda disponível em cada crédito.
-- O saldo da conta continua sendo SUM(quantidade); esta coluna só afina alertas de validade.

alter table public.movimentacoes
  add column if not exists quantidade_restante numeric(14,2);

comment on column public.movimentacoes.quantidade_restante is
  'Saldo remanescente do crédito após consumo FIFO. NULL em linhas de débito.';

create index if not exists idx_movimentacoes_fifo_creditos
  on public.movimentacoes (conta_id, data_expiracao nulls last, data, created_at)
  where quantidade > 0;

-- ---------------------------------------------------------------------------
-- Recalcula quantidade_restante de todos os créditos de uma conta.
-- Consome abs(débitos) em ordem FIFO: data_expiracao ASC NULLS LAST, data, created_at.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_quantidade_restante(p_conta_id uuid)
returns void
language plpgsql
as $$
declare
  v_consumir numeric(14,2);
  r record;
  v_usar numeric(14,2);
begin
  update public.movimentacoes
  set quantidade_restante = case
    when quantidade > 0 then quantidade
    else null
  end
  where conta_id = p_conta_id;

  select coalesce(sum(-quantidade), 0)
  into v_consumir
  from public.movimentacoes
  where conta_id = p_conta_id
    and quantidade < 0;

  if v_consumir <= 0 then
    return;
  end if;

  for r in
    select id, quantidade_restante as restante
    from public.movimentacoes
    where conta_id = p_conta_id
      and quantidade_restante > 0
    order by
      data_expiracao asc nulls last,
      data asc,
      created_at asc,
      id asc
  loop
    exit when v_consumir <= 0;
    v_usar := least(r.restante, v_consumir);
    update public.movimentacoes
    set quantidade_restante = quantidade_restante - v_usar
    where id = r.id;
    v_consumir := v_consumir - v_usar;
  end loop;
end;
$$;

create or replace function public.recalcular_quantidade_restante_todas()
returns void
language plpgsql
as $$
declare
  c record;
begin
  for c in select distinct conta_id from public.movimentacoes
  loop
    perform public.recalcular_quantidade_restante(c.conta_id);
  end loop;
end;
$$;

-- Trigger: recalcula após mudanças estruturais; ignora updates só de quantidade_restante
-- (evita recursão quando o próprio recalcular atualiza a coluna).
create or replace function public.trg_movimentacoes_fifo()
returns trigger
language plpgsql
as $$
declare
  v_conta uuid;
  v_conta_old uuid;
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_quantidade_restante(old.conta_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.quantidade is not distinct from old.quantidade
       and new.data is not distinct from old.data
       and new.data_expiracao is not distinct from old.data_expiracao
       and new.conta_id is not distinct from old.conta_id
       and new.tipo is not distinct from old.tipo
    then
      return new;
    end if;
    v_conta := new.conta_id;
    v_conta_old := old.conta_id;
    perform public.recalcular_quantidade_restante(v_conta);
    if v_conta_old is distinct from v_conta then
      perform public.recalcular_quantidade_restante(v_conta_old);
    end if;
    return new;
  end if;

  -- INSERT
  perform public.recalcular_quantidade_restante(new.conta_id);
  return new;
end;
$$;

drop trigger if exists trg_movimentacoes_fifo on public.movimentacoes;
create trigger trg_movimentacoes_fifo
  after insert or update or delete on public.movimentacoes
  for each row
  execute function public.trg_movimentacoes_fifo();

-- Backfill histórico
select public.recalcular_quantidade_restante_todas();

-- Agregado preciso para o dashboard (não depende de limit/paginação no client)
create or replace function public.milhas_expirando_em_dias(p_dias integer default 90)
returns numeric
language sql
stable
as $$
  select coalesce(sum(m.quantidade_restante), 0)
  from public.movimentacoes m
  where m.quantidade_restante > 0
    and m.data_expiracao is not null
    and m.data_expiracao >= current_date
    and m.data_expiracao <= (current_date + (p_dias::text || ' days')::interval)::date;
$$;
