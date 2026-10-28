-- Extrato do Esfera (Santander) capturado em 27/10/2026.
--
-- Fonte: GET https://apigw.esfera.com.vc/bff-extract/ehis/customer/sum-transactions?period=MM/AAAA
-- (tela /meu-extrato, Bearer da sessão). Ver docs/SINCRONIZACAO-PROGRAMAS.md §7.
--
-- A API só devolve ~6 meses de extrato: meses anteriores a 05/2026 voltam vazios.
-- Como o saldo do site em 27/10/2026 é 5.310 e a soma visível é −46.665, entra um
-- `ajuste` de +51.975 (saldo que existia antes da janela) para o saldo fechar.
-- É reconciliação explícita, não movimento do programa.
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
   where p.nome = 'Esfera'
     and c.numero_conta = '08713844938';

  if v_conta is null then
    raise notice 'Conta Esfera nao encontrada; seed ignorado.';
    return;
  end if;

  insert into public.assinaturas
    (conta_id, nome_plano, valor_mensal, dia_cobranca, milhas_mensais, data_inicio, data_fim, status)
  select v_conta, 'Clube Esfera 1.000 (anual)', 39.51, 29, 1167, '2026-05-29', null, 'ativa'
   where not exists (
     select 1 from public.assinaturas a
      where a.conta_id = v_conta and a.nome_plano = 'Clube Esfera 1.000 (anual)'
   );

  select a.id into v_assinatura
    from public.assinaturas a
   where a.conta_id = v_conta and a.nome_plano = 'Clube Esfera 1.000 (anual)'
   limit 1;

  if exists (select 1 from public.movimentacoes where conta_id = v_conta) then
    return;
  end if;

  insert into public.movimentacoes
    (conta_id, data, tipo, origem, quantidade, data_expiracao, valor_pago, descricao, assinatura_id)
  select v_conta, v.d, v.tipo, v.origem, v.qtd, v.exp, null, v.ds,
         case when v.clube then v_assinatura end
    from (values
      ('2026-04-30'::date, 'ajuste', 'ajuste', 51975::numeric, null,
       'Saldo anterior ao extrato Esfera (fora da janela de 6 meses da API)', false),
      ('2026-05-29'::date, 'assinatura', 'assinatura', 1167::numeric, '2028-05-29'::date, 'Clube Esfera', true),
      ('2026-05-29'::date, 'transferencia_saida', 'transferencia', -52500::numeric, null,
       'Transferência para Accor · pedido 315402965', false),
      ('2026-06-29'::date, 'assinatura', 'assinatura', 1167::numeric, '2028-06-29'::date, 'Clube Esfera', true),
      ('2026-07-29'::date, 'assinatura', 'assinatura', 1167::numeric, '2028-07-29'::date, 'Clube Esfera', true),
      ('2026-08-29'::date, 'assinatura', 'assinatura', 1167::numeric, '2028-08-29'::date, 'Clube Esfera', true),
      ('2026-09-29'::date, 'assinatura', 'assinatura', 1167::numeric, '2028-09-29'::date, 'Clube Esfera', true)
    ) as v (d, tipo, origem, qtd, exp, ds, clube);
end
$$;
