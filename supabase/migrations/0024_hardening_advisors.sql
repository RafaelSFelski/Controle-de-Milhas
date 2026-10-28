-- Endurecimento apontado pelos advisors de segurança do Supabase.
--
-- 1) search_path fixo nas funções do app. Sem isso, uma função resolvida por
--    search_path pode acabar chamando um objeto plantado em outro schema.
-- 2) v_saldos_contas passa a rodar com as permissões de quem consulta
--    (security_invoker), em vez das do dono (security definer).
-- 3) rls_auto_enable() deixa de ser executável por anon/authenticated: ela só é
--    usada pelo event trigger `ensure_rls`, que roda como postgres no DDL.
--
-- RLS continua desligado de propósito nas tabelas públicas — é a decisão de
-- arquitetura registrada na 0009 (app pessoal, uma única conta, sem multi-tenant).
-- Por isso o lint `rls_disabled_in_public` permanece; os outros somem.

-- 1) search_path fixo
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.proname in (
         'aplicar_bonus_adesao_assinatura',
         'criar_transferencia',
         'gerar_creditos_assinaturas_mes',
         'gerar_creditos_retroativos_assinatura',
         'milhas_expirando_em_dias',
         'recalcular_quantidade_restante',
         'recalcular_quantidade_restante_todas',
         'trg_movimentacoes_fifo',
         'validade_meses_programa'
       )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
  end loop;
end
$$;

-- 2) view com as permissões do invocador
do $$
begin
  if exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'v_saldos_contas' and c.relkind = 'v'
  ) then
    execute 'alter view public.v_saldos_contas set (security_invoker = true)';
  end if;
end
$$;

-- 3) rls_auto_enable() fora do alcance de anon/authenticated
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
