-- Extrato do Livelo capturado em 27/10/2026.
--
-- Fonte: GET https://apis.pontoslivelo.com.br/bff-liv-customer-account-site/v1/customers/me/transactions
-- (tela /extrato, Bearer do Keycloak). Ver docs/SINCRONIZACAO-PROGRAMAS.md §6.
--
-- 17 lançamentos, soma 10.866 = saldo do site na captura.
-- Validade: regras do app (parceiro 12 meses, assinatura/promoção 24).
--
-- Idempotência: assinatura por nome_plano; movimentos só se a conta estiver vazia.

do $$
declare
  v_conta uuid;
  v_assinatura uuid;
begin
  select c.id into v_conta
    from public.contas c
    join public.programas p on p.id = c.programa_id
   where p.nome = 'Livelo'
     and c.numero_conta = '08713844938';

  if v_conta is null then
    raise notice 'Conta Livelo nao encontrada; seed ignorado.';
    return;
  end if;

  insert into public.assinaturas
    (conta_id, nome_plano, valor_mensal, dia_cobranca, milhas_mensais, data_inicio, data_fim, status)
  select v_conta, 'Clube Livelo Classic (anual)', 44.90, 24, 1000, '2026-04-24', null, 'ativa'
   where not exists (
     select 1 from public.assinaturas a
      where a.conta_id = v_conta and a.nome_plano = 'Clube Livelo Classic (anual)'
   );

  select a.id into v_assinatura
    from public.assinaturas a
   where a.conta_id = v_conta and a.nome_plano = 'Clube Livelo Classic (anual)'
   limit 1;

  if exists (select 1 from public.movimentacoes where conta_id = v_conta) then
    return;
  end if;

  insert into public.movimentacoes
    (conta_id, data, tipo, origem, quantidade, data_expiracao, valor_pago, descricao, assinatura_id)
  select v_conta, v.d, v.tipo, v.origem, v.qtd, v.exp, null, v.ds,
         case when v.clube then v_assinatura end
    from (values
    ('2026-04-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-04-24'::date, 'Clube Livelo', true),
    ('2026-04-24'::date, 'credito', 'promocao', 250::numeric, '2028-04-24'::date, 'Clube Livelo (bônus)', false),
    ('2026-05-18'::date, 'debito', null, -300::numeric, null, 'Smiles · pontos + dinheiro', false),
    ('2026-05-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-05-24'::date, 'Clube Livelo', true),
    ('2026-05-24'::date, 'credito', 'promocao', 250::numeric, '2028-05-24'::date, 'Clube Livelo (bônus)', false),
    ('2026-06-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-06-24'::date, 'Clube Livelo', true),
    ('2026-06-24'::date, 'credito', 'promocao', 500::numeric, '2028-06-24'::date, 'Clube Livelo (bônus)', false),
    ('2026-07-03'::date, 'credito', 'parceiro', 2016::numeric, '2027-07-03'::date, 'Coffee Mais', false),
    ('2026-07-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-07-24'::date, 'Clube Livelo', true),
    ('2026-07-24'::date, 'credito', 'promocao', 250::numeric, '2028-07-24'::date, 'Clube Livelo (bônus)', false),
    ('2026-08-11'::date, 'debito', null, -100::numeric, null, 'Smiles · pontos + dinheiro', false),
    ('2026-08-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-08-24'::date, 'Clube Livelo', true),
    ('2026-08-24'::date, 'credito', 'promocao', 250::numeric, '2028-08-24'::date, 'Clube Livelo (bônus)', false),
    ('2026-09-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-09-24'::date, 'Clube Livelo', true),
    ('2026-09-24'::date, 'credito', 'promocao', 500::numeric, '2028-09-24'::date, 'Clube Livelo (bônus)', false),
    ('2026-10-24'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-10-24'::date, 'Clube Livelo', true),
    ('2026-10-24'::date, 'credito', 'promocao', 250::numeric, '2028-10-24'::date, 'Clube Livelo (bônus)', false)
    ) as v (d, tipo, origem, qtd, exp, ds, clube);
end
$$;
