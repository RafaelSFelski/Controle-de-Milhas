-- Extrato do Smiles de 2026 (sincronizado em 27/10/2026).
--
-- Fecha o buraco de reprodutibilidade: os movimentos do Smiles nunca tinham virado
-- migration (foram aplicados por SQL direto), então um `db reset` devolvia a carteira
-- sem Smiles — e a 0012 (trechos de voo) não encontrava os débitos de resgate.
--
-- Inclui, todos idempotentes:
--   1. assinatura "Clube Smiles 5.000 (anual)";
--   2. os 22 movimentos de 2026 (soma = 25.195);
--   3. os 4 bilhetes de voo (uma linha por passageiro).
--
-- Ver docs/SINCRONIZACAO-PROGRAMAS.md §3 e docs/VOOS-SMILES.md.

do $$
declare
  v_conta uuid;
  v_assinatura uuid;
begin
  select c.id into v_conta
    from public.contas c
    join public.programas p on p.id = c.programa_id
   where p.nome = 'Smiles'
     and c.numero_conta = '458520580';

  if v_conta is null then
    raise notice 'Conta Smiles nao encontrada; seed ignorado.';
    return;
  end if;

  insert into public.assinaturas
    (conta_id, nome_plano, valor_mensal, dia_cobranca, milhas_mensais, data_inicio, data_fim, status)
  select v_conta, 'Clube Smiles 5.000 (anual)', 156.4, 5, 5000, '2026-05-04'::date, null, 'ativa'
   where not exists (
     select 1 from public.assinaturas x
      where x.conta_id = v_conta and x.nome_plano = 'Clube Smiles 5.000 (anual)'
   );

  select x.id into v_assinatura
    from public.assinaturas x
   where x.conta_id = v_conta and x.nome_plano = 'Clube Smiles 5.000 (anual)'
   limit 1;

  if not exists (select 1 from public.movimentacoes where conta_id = v_conta) then
    insert into public.movimentacoes
      (conta_id, data, tipo, origem, quantidade, data_expiracao, valor_pago, descricao, assinatura_id)
    select v_conta, v.d, v.tipo, v.origem, v.qtd, v.exp, v.valor, v.ds,
           case when v.clube then v_assinatura end
      from (values
      ('2026-05-04'::date, 'credito', null, 20000::numeric, '2036-05-04'::date, null, 'Clube Anual (bônus)', false),
      ('2026-05-04'::date, 'assinatura', 'assinatura', 2000::numeric, '2036-05-04'::date, null, 'Clube Anual', true),
      ('2026-05-18'::date, 'credito', null, 30000::numeric, '2029-05-19'::date, null, 'Pontos Livelo', false),
      ('2026-05-18'::date, 'credito', null, 24000::numeric, '2027-05-19'::date, null, 'Transferência de pontos - Maio 26 (bônus)', false),
      ('2026-05-19'::date, 'credito', null, 2480::numeric, '2027-05-19'::date, null, 'Bônus Reativação (bônus)', false),
      ('2026-05-19'::date, 'credito', null, 800::numeric, '2027-05-19'::date, null, 'Milhas Smiles Reativadas', false),
      ('2026-05-19'::date, 'credito', null, 80::numeric, '2027-05-19'::date, null, 'Bônus Clube Smiles Plano 2000 - Reativação (bônus)', false),
      ('2026-06-05'::date, 'credito', null, 20000::numeric, '2036-06-05'::date, null, 'Clube Anual (bônus)', false),
      ('2026-06-05'::date, 'assinatura', 'assinatura', 5000::numeric, '2036-06-05'::date, null, 'Clube Anual', true),
      ('2026-06-05'::date, 'credito', null, 1000::numeric, '2036-06-05'::date, null, 'Clube Anual (bônus)', false),
      ('2026-06-09'::date, 'debito', null, -64165::numeric, null, 226.38, 'Resgate de voo · CWB→AEP · Rafael Soares Felski, Mariana Barbosa Balvedi · R$ 226,38', false),
      ('2026-07-05'::date, 'assinatura', 'assinatura', 5000::numeric, '2036-07-05'::date, null, 'Clube Anual', true),
      ('2026-07-10'::date, 'debito', null, -45000::numeric, null, 133.18, 'Resgate de voo · CWB→AEP · Claudete Duarte Barbosa · R$ 133,18', false),
      ('2026-07-16'::date, 'credito', null, 15000::numeric, '2029-07-16'::date, null, 'Créditos Inter Loop', false),
      ('2026-07-16'::date, 'credito', null, 12000::numeric, '2027-07-16'::date, null, 'Bônus - 07/2026 - Transf. Inter (bônus)', false),
      ('2026-08-05'::date, 'assinatura', 'assinatura', 5000::numeric, '2036-08-05'::date, null, 'Clube Anual', true),
      ('2026-08-11'::date, 'credito', null, 10000::numeric, '2029-08-11'::date, null, 'Pontos Livelo', false),
      ('2026-08-11'::date, 'credito', null, 8000::numeric, '2027-08-11'::date, null, 'Transf. Pontos - Bônus Agosto (bônus)', false),
      ('2026-08-11'::date, 'debito', null, -36200::numeric, null, 59.46, 'Resgate de voo · POA→CWB · Rafael Soares Felski · R$ 59,46', false),
      ('2026-09-03'::date, 'credito', null, 200::numeric, '2029-09-03'::date, null, 'Crédito Milhas Seguro Viagem Sulamerica', false),
      ('2026-09-05'::date, 'assinatura', 'assinatura', 5000::numeric, '2036-09-05'::date, null, 'Clube Anual', true),
      ('2026-10-05'::date, 'assinatura', 'assinatura', 5000::numeric, '2036-10-05'::date, null, 'Clube Anual', true)
      ) as v (d, tipo, origem, qtd, exp, valor, ds, clube);
  end if;

  -- Bilhetes de voo (a 0012 já faz isso quando os débitos existem; aqui garante o
  -- caminho de um `db reset` do zero, em que a 0012 roda antes deste seed).
  insert into public.voos
    (conta_id, movimentacao_id, data_voo, origem, destino, passageiro, localizador,
     companhia, numero_voo, hora_saida, hora_chegada, milhas, valor_pago, observacao)
  select v_conta, v.mov, v.data_voo, v.origem, v.destino, v.passageiro, v.localizador,
         v.companhia, v.numero_voo, v.hora_saida::time, v.hora_chegada::time,
         v.milhas, v.valor, v.obs
    from (values
      ('2026-08-29'::date, 'CWB', 'AEP', 'Claudete Duarte Barbosa', 'CGRRVS', 'GOL', 'G3 7642', '11:00:00', '17:20:00', 45000::numeric, 133.18, 'Mesmo voo do resgate de 09/06, mas com localizador e bilhete separados.',
       (select id from public.movimentacoes
         where conta_id = v_conta and data = '2026-07-10'::date and quantidade = -45000 and tipo = 'debito')),
      ('2026-08-29'::date, 'CWB', 'AEP', 'Rafael Soares Felski', 'LMUXWJ', 'GOL', 'G3 7642', '11:00:00', '17:20:00', 32082::numeric, 113.19, 'Pedido de 2 passageiros: 32.082 (Rafael) + 32.083 (Mariana) milhas, incluindo 2.565 milhas de seguro viagem SulAmérica (2 apólices).',
       (select id from public.movimentacoes
         where conta_id = v_conta and data = '2026-06-09'::date and quantidade = -64165 and tipo = 'debito')),
      ('2026-08-29'::date, 'CWB', 'AEP', 'Mariana Barbosa Balvedi', 'LMUXWJ', 'GOL', 'G3 7642', '11:00:00', '17:20:00', 32083::numeric, 113.19, 'Pedido de 2 passageiros: 32.082 (Rafael) + 32.083 (Mariana) milhas, incluindo 2.565 milhas de seguro viagem SulAmérica (2 apólices).',
       (select id from public.movimentacoes
         where conta_id = v_conta and data = '2026-06-09'::date and quantidade = -64165 and tipo = 'debito')),
      ('2026-09-03'::date, 'POA', 'CWB', 'Rafael Soares Felski', 'OCSXKE', 'GOL', 'G3 1279', '12:30:00', '16:35:00', 36200::numeric, 59.46, 'Resgate emitido pelo app do Smiles.',
       (select id from public.movimentacoes
         where conta_id = v_conta and data = '2026-08-11'::date and quantidade = -36200 and tipo = 'debito'))
    ) as v (data_voo, origem, destino, passageiro, localizador, companhia, numero_voo,
            hora_saida, hora_chegada, milhas, valor, obs, mov)
   where v.mov is not null
     and not exists (
       select 1 from public.voos x
        where x.movimentacao_id = v.mov and x.passageiro = v.passageiro
     );
end
$$;
