-- Trechos resgatados com milhas Smiles em 2026 (detalhe extraído do site em 27/10/2026).
-- Idempotente: casa cada trecho com a movimentação de resgate pela
-- conta + data + quantidade e não insere duas vezes.
--
-- Fonte: docs/VOOS-SMILES.md. Se a movimentação não existir, nada é inserido
-- (o join não encontra a linha) — o seed não quebra um banco vazio.
--
-- Roda só enquanto a coluna `passageiros` existir: a 0013 converte para uma linha
-- por passageiro e remove o array. Numa base já migrada o bloco é ignorado (e o
-- `on conflict` da 0013 não vale mais, porque o unique é removido).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'voos' and column_name = 'passageiros'
  ) then
    raise notice 'voos ja convertido para uma linha por passageiro; seed 0012 ignorado.';
    return;
  end if;

  insert into public.voos (
    conta_id, movimentacao_id, data_voo, origem, destino, passageiros,
    localizador, companhia, numero_voo, hora_saida, hora_chegada, observacao
  )
  select
    m.conta_id, m.id, v.data_voo, v.origem, v.destino, v.passageiros,
    v.localizador, v.companhia, v.numero_voo, v.hora_saida, v.hora_chegada, v.observacao
  from (values
    ('2026-06-09'::date, -64165::numeric, '2026-08-29'::date, 'CWB', 'AEP',
     array['Rafael Soares Felski', 'Mariana Barbosa Balvedi']::text[],
     'LMUXWJ', 'GOL', 'G3 7642', '11:00'::time, '17:20'::time,
     'Pedido de 2 passageiros: 32.082 (Rafael) + 32.083 (Mariana) milhas, incluindo 2.565 milhas de seguro viagem SulAmérica (2 apólices).'),
    ('2026-07-10'::date, -45000::numeric, '2026-08-29'::date, 'CWB', 'AEP',
     array['Claudete Duarte Barbosa']::text[],
     'CGRRVS', 'GOL', 'G3 7642', '11:00'::time, '17:20'::time,
     'Mesmo voo do resgate de 09/06, mas com localizador e bilhete separados.'),
    ('2026-08-11'::date, -36200::numeric, '2026-09-03'::date, 'POA', 'CWB',
     array['Rafael Soares Felski']::text[],
     'OCSXKE', 'GOL', 'G3 1279', '12:30'::time, '16:35'::time,
     'Resgate emitido pelo app do Smiles.')
  ) as v (data_resgate, quantidade, data_voo, origem, destino, passageiros,
          localizador, companhia, numero_voo, hora_saida, hora_chegada, observacao)
  join public.movimentacoes m
    on m.data = v.data_resgate
   and m.quantidade = v.quantidade
   and m.tipo = 'debito'
   and m.descricao like 'Resgate de voo%'
  where not exists (
    select 1 from public.voos x where x.movimentacao_id = m.id
  );
end
$$;
