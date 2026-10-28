-- Extrato do TudoAzul (Azul Fidelidade) capturado em 27/10/2026.
--
-- Fonte: Server Action `POST /perfil/br/pt/extract` (tela /perfil/br/pt/extract),
-- com pageSize=0 e dateFrom=2015-01-01. O site é Next.js + Akamai: a chamada só
-- funciona de dentro da página logada. Ver docs/SINCRONIZACAO-PROGRAMAS.md §5.
--
-- 65 operações; 16 têm 0 ponto (5 aceites de campanha, 9 "acúmulo de voo",
-- 1 reprocesso, 1 "trechos e gastos") e ficam de fora.
-- Soma das 49 linhas = 13.033 = saldo do site no dia da captura.
--
-- Validade: créditos expiram em 3 anos (categoria Topázio). O extrato não informa
-- validade por lançamento; a data é derivada da regra publicada do programa.
--
-- Idempotência: assinaturas por nome_plano; movimentos só se a conta estiver vazia.

do $$
declare
  v_conta uuid;
  v_antigo uuid;
  v_atual uuid;
begin
  select c.id into v_conta
    from public.contas c
    join public.programas p on p.id = c.programa_id
   where p.nome = 'TudoAzul'
     and c.numero_conta = '9873867577';

  if v_conta is null then
    raise notice 'Conta TudoAzul nao encontrada; seed ignorado.';
    return;
  end if;

  insert into public.assinaturas
    (conta_id, nome_plano, valor_mensal, dia_cobranca, milhas_mensais, data_inicio, data_fim, status)
  select v_conta, 'Clube TudoAzul 1.000 (anual)', 37.80, 5, 1000, '2025-05-26', '2026-05-13', 'cancelada'
   where not exists (
     select 1 from public.assinaturas a
      where a.conta_id = v_conta and a.nome_plano = 'Clube TudoAzul 1.000 (anual)'
   );

  insert into public.assinaturas
    (conta_id, nome_plano, valor_mensal, dia_cobranca, milhas_mensais, data_inicio, data_fim, status)
  select v_conta, 'Clube TudoAzul 2.000 (anual)', 74.00, 5, 3400, '2026-05-14', null, 'ativa'
   where not exists (
     select 1 from public.assinaturas a
      where a.conta_id = v_conta and a.nome_plano = 'Clube TudoAzul 2.000 (anual)'
   );

  select a.id into v_antigo from public.assinaturas a
   where a.conta_id = v_conta and a.nome_plano = 'Clube TudoAzul 1.000 (anual)' limit 1;
  select a.id into v_atual from public.assinaturas a
   where a.conta_id = v_conta and a.nome_plano = 'Clube TudoAzul 2.000 (anual)' limit 1;

  if exists (select 1 from public.movimentacoes where conta_id = v_conta) then
    return;
  end if;

  insert into public.movimentacoes
    (conta_id, data, tipo, origem, quantidade, data_expiracao, valor_pago, descricao, assinatura_id)
  select v_conta, v.d, v.tipo, v.origem, v.qtd, v.exp, null, v.ds,
         case v.plano when 'antigo' then v_antigo when 'atual' then v_atual end
    from (values
    ('2025-01-22'::date, 'credito', 'transferencia', 8000::numeric, '2028-01-22'::date, 'Transferência Banco Inter', null),
    ('2025-03-11'::date, 'credito', 'transferencia', 5000::numeric, '2028-03-11'::date, 'Transferência Banco Inter', null),
    ('2025-03-31'::date, 'credito', 'transferencia', 2000::numeric, '2028-03-31'::date, 'Bônus Banco Inter (promoção)', null),
    ('2025-05-13'::date, 'debito', null, -9800::numeric, null, 'Resgate de voo · Azul', null),
    ('2025-05-13'::date, 'debito', null, -9800::numeric, null, 'Resgate de voo · Azul', null),
    ('2025-05-13'::date, 'credito', 'transferencia', 5000::numeric, '2028-05-13'::date, 'Transferência Banco Inter', null),
    ('2025-05-18'::date, 'credito', 'parceiro', 2940::numeric, '2028-05-18'::date, 'Azul Viagens', null),
    ('2025-05-26'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-05-26'::date, 'Clube Azul', 'antigo'),
    ('2025-06-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-06-07'::date, 'Clube Azul', 'antigo'),
    ('2025-06-12'::date, 'credito', 'cartao', 4799::numeric, '2028-06-12'::date, 'Cartão Azul Itaú', null),
    ('2025-07-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-07-07'::date, 'Clube Azul', 'antigo'),
    ('2025-07-11'::date, 'credito', 'cartao', 2967::numeric, '2028-07-11'::date, 'Cartão Azul Itaú', null),
    ('2025-08-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-08-07'::date, 'Clube Azul', 'antigo'),
    ('2025-08-13'::date, 'credito', 'cartao', 20943::numeric, '2028-08-13'::date, 'Cartão Azul Itaú', null),
    ('2025-09-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-09-07'::date, 'Clube Azul', 'antigo'),
    ('2025-09-10'::date, 'credito', 'cartao', 2019::numeric, '2028-09-10'::date, 'Cartão Azul Itaú', null),
    ('2025-09-10'::date, 'credito', 'transferencia', 9000::numeric, '2028-09-10'::date, 'Transferência Banco Inter', null),
    ('2025-09-12'::date, 'debito', null, -14400::numeric, null, 'Resgate de voo · Azul', null),
    ('2025-09-12'::date, 'debito', null, -17640::numeric, null, 'Resgate de voo · Azul', null),
    ('2025-09-12'::date, 'debito', null, -14400::numeric, null, 'Resgate de voo · Azul', null),
    ('2025-09-12'::date, 'debito', null, -17640::numeric, null, 'Resgate de voo · Azul', null),
    ('2025-09-12'::date, 'credito', 'transferencia', 17000::numeric, '2028-09-12'::date, 'Transferência Banco Inter', null),
    ('2025-10-08'::date, 'credito', 'cartao', 597::numeric, '2028-10-08'::date, 'Cartão Azul Itaú', null),
    ('2025-10-09'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-10-09'::date, 'Clube Azul', 'antigo'),
    ('2025-11-05'::date, 'credito', 'cartao', 173::numeric, '2028-11-05'::date, 'Cartão Azul Itaú', null),
    ('2025-11-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-11-07'::date, 'Clube Azul', 'antigo'),
    ('2025-12-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2028-12-07'::date, 'Clube Azul', 'antigo'),
    ('2025-12-10'::date, 'credito', 'cartao', 225::numeric, '2028-12-10'::date, 'Cartão Azul Itaú', null),
    ('2026-01-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2029-01-07'::date, 'Clube Azul', 'antigo'),
    ('2026-02-07'::date, 'assinatura', 'assinatura', 1000::numeric, '2029-02-07'::date, 'Clube Azul', 'antigo'),
    ('2026-03-05'::date, 'assinatura', 'assinatura', 1000::numeric, '2029-03-05'::date, 'Clube Azul', 'antigo'),
    ('2026-04-05'::date, 'assinatura', 'assinatura', 1000::numeric, '2029-04-05'::date, 'Clube Azul', 'antigo'),
    ('2026-04-22'::date, 'credito', 'transferencia', 24000::numeric, '2029-04-22'::date, 'Transferência Banco Inter', null),
    ('2026-04-24'::date, 'credito', 'compra', 63000::numeric, '2029-04-24'::date, 'Compra de pontos (bônus)', null),
    ('2026-04-24'::date, 'credito', 'compra', 20000::numeric, '2029-04-24'::date, 'Compra de pontos (voucher)', null),
    ('2026-05-05'::date, 'assinatura', 'assinatura', 1000::numeric, '2029-05-05'::date, 'Clube Azul', 'antigo'),
    ('2026-05-14'::date, 'assinatura', 'assinatura', 3400::numeric, '2029-05-14'::date, 'Clube Azul', 'atual'),
    ('2026-06-05'::date, 'assinatura', 'assinatura', 3400::numeric, '2029-06-05'::date, 'Clube Azul', 'atual'),
    ('2026-07-01'::date, 'debito', null, -30000::numeric, null, 'Shopping Azul · pedido 2763120 · item 61323370', null),
    ('2026-07-01'::date, 'debito', null, -30000::numeric, null, 'Shopping Azul · pedido 2763120 · item 61323369', null),
    ('2026-07-01'::date, 'debito', null, -30000::numeric, null, 'Shopping Azul · pedido 2763120 · item 61323367', null),
    ('2026-07-01'::date, 'debito', null, -30000::numeric, null, 'Shopping Azul · pedido 2763120 · item 61323368', null),
    ('2026-07-05'::date, 'assinatura', 'assinatura', 3400::numeric, '2029-07-05'::date, 'Clube Azul', 'atual'),
    ('2026-07-16'::date, 'credito', 'transferencia', 33150::numeric, '2029-07-16'::date, 'Transferência Banco Inter', null),
    ('2026-07-21'::date, 'debito', null, -7500::numeric, null, 'Shopping Azul · pedido 2792180 · item 61971835', null),
    ('2026-07-21'::date, 'debito', null, -30000::numeric, null, 'Shopping Azul · pedido 2792180 · item 61971834', null),
    ('2026-08-05'::date, 'assinatura', 'assinatura', 3400::numeric, '2029-08-05'::date, 'Clube Azul', 'atual'),
    ('2026-09-05'::date, 'assinatura', 'assinatura', 3400::numeric, '2029-09-05'::date, 'Clube Azul', 'atual'),
    ('2026-10-05'::date, 'assinatura', 'assinatura', 3400::numeric, '2029-10-05'::date, 'Clube Azul', 'atual')
    ) as v (d, tipo, origem, qtd, exp, ds, plano);
end
$$;
