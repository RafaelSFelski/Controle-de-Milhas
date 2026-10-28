-- Extrato do All Accor (ALL Rewards) capturado em 27/10/2026.
--
-- Fonte: GET https://api.accor.com/customer/v1/contacts/me (campos loyalty.operations.operation),
-- consumido pela tela /account/pt-br/global-transaction-history. Ver docs/SINCRONIZACAO-PROGRAMAS.md.
--
-- 43 operações no extrato; 8 têm points = 0 (só statusPoints e noites) e ficam de fora.
-- Soma das 35 linhas = 32.148 = saldo do site no dia da captura.
--
-- Idempotência: só insere se a conta ainda não tiver movimentação. O extrato é
-- importado em bloco porque a chave data+quantidade+descrição não distingue as
-- 4 transferências idênticas de 01/07/2026.

do $$
declare
  v_conta uuid;
  v_assinatura uuid;
begin
  select c.id into v_conta
    from public.contas c
    join public.programas p on p.id = c.programa_id
   where p.nome = 'All Accor'
     and c.numero_conta = '3081033974922A2B';

  if v_conta is null then
    raise notice 'Conta All Accor nao encontrada; seed ignorado.';
    return;
  end if;

  if exists (select 1 from public.movimentacoes where conta_id = v_conta) then
    return;
  end if;

  select a.id into v_assinatura
    from public.assinaturas a
   where a.conta_id = v_conta
     and a.nome_plano = 'All Signature Essential'
   limit 1;

  insert into public.movimentacoes
    (conta_id, data, tipo, origem, quantidade, data_expiracao, valor_pago, descricao, assinatura_id)
  select v_conta, v.d, v.tipo, v.origem, v.qtd, null, null, v.ds,
         case when v.plano then v_assinatura end
    from (values
    ('2026-05-29'::date, 'credito', 'promocao', 1500::numeric, 'Bonus Partner: ALLSignature_Bonus_ESFERA', false),
    ('2026-05-29'::date, 'credito', 'transferencia', 15000::numeric, 'Earn Partner: ESFERA', false),
    ('2026-05-29'::date, 'assinatura', 'assinatura', 500::numeric, 'Pontos mensais ALL Signature Essential', true),
    ('2026-06-29'::date, 'assinatura', 'assinatura', 500::numeric, 'Pontos mensais ALL Signature Essential', true),
    ('2026-07-01'::date, 'credito', 'promocao', 400::numeric, 'Bonus Partner: ALLSignature_Bonus_Tudo_Azul', false),
    ('2026-07-01'::date, 'credito', 'promocao', 400::numeric, 'Bonus Partner: ALLSignature_Bonus_Tudo_Azul', false),
    ('2026-07-01'::date, 'credito', 'promocao', 400::numeric, 'Bonus Partner: ALLSignature_Bonus_Tudo_Azul', false),
    ('2026-07-01'::date, 'credito', 'promocao', 400::numeric, 'Bonus Partner: ALLSignature_Bonus_Tudo_Azul', false),
    ('2026-07-01'::date, 'credito', 'promocao', 200::numeric, 'Bonus Partner: Azul Jul 5% 2026', false),
    ('2026-07-01'::date, 'credito', 'promocao', 200::numeric, 'Bonus Partner: Azul Jul 5% 2026', false),
    ('2026-07-01'::date, 'credito', 'promocao', 200::numeric, 'Bonus Partner: Azul Jul 5% 2026', false),
    ('2026-07-01'::date, 'credito', 'promocao', 200::numeric, 'Bonus Partner: Azul Jul 5% 2026', false),
    ('2026-07-01'::date, 'credito', 'transferencia', 4000::numeric, 'Earn Partner: Azul Fidelidade', false),
    ('2026-07-01'::date, 'credito', 'transferencia', 4000::numeric, 'Earn Partner: Azul Fidelidade', false),
    ('2026-07-01'::date, 'credito', 'transferencia', 4000::numeric, 'Earn Partner: Azul Fidelidade', false),
    ('2026-07-01'::date, 'credito', 'transferencia', 4000::numeric, 'Earn Partner: Azul Fidelidade', false),
    ('2026-07-17'::date, 'credito', 'promocao', 2400::numeric, 'AZUL Jul 2026 Cross Rewards', false),
    ('2026-07-21'::date, 'credito', 'promocao', 100::numeric, 'Bonus Partner: ALLSignature_Bonus_Tudo_Azul', false),
    ('2026-07-21'::date, 'credito', 'promocao', 400::numeric, 'Bonus Partner: ALLSignature_Bonus_Tudo_Azul', false),
    ('2026-07-21'::date, 'credito', 'promocao', 100::numeric, 'Bonus Partner: Azul MD Jul 10% 2026', false),
    ('2026-07-21'::date, 'credito', 'promocao', 400::numeric, 'Bonus Partner: Azul MD Jul 10% 2026', false),
    ('2026-07-21'::date, 'credito', 'transferencia', 1000::numeric, 'Earn Partner: Azul Fidelidade', false),
    ('2026-07-21'::date, 'credito', 'transferencia', 4000::numeric, 'Earn Partner: Azul Fidelidade', false),
    ('2026-07-21'::date, 'debito', null, -38000::numeric, 'Estadia paga com pontos: Pullman Miami Airport', false),
    ('2026-07-21'::date, 'credito', 'outro', 38000::numeric, 'Reserva cancelada: Pullman Miami Airport', false),
    ('2026-07-29'::date, 'assinatura', 'assinatura', 500::numeric, 'Pontos mensais ALL Signature Essential', true),
    ('2026-08-05'::date, 'credito', 'promocao', 250::numeric, 'AZUL MD JULHO 5% ALL SIG', false),
    ('2026-08-06'::date, 'credito', 'promocao', 500::numeric, 'AZUL MD 2026 10% Cross Rewards', false),
    ('2026-08-29'::date, 'credito', 'promocao', 32::numeric, 'Bónus Gold', false),
    ('2026-08-29'::date, 'debito', null, -13000::numeric, 'Estadia paga com pontos: ibis Buenos Aires Obelisco', false),
    ('2026-08-29'::date, 'debito', null, -2000::numeric, 'Estadia paga com pontos: ibis Curitiba Aeroporto', false),
    ('2026-08-29'::date, 'credito', 'parceiro', 66::numeric, 'Hospedagem: ibis Curitiba Aeroporto', false),
    ('2026-08-29'::date, 'assinatura', 'assinatura', 500::numeric, 'Pontos mensais ALL Signature Essential', true),
    ('2026-08-29'::date, 'credito', 'assinatura', 500::numeric, 'Pontos trimestrais ALL Signature Essential', false),
    ('2026-09-29'::date, 'assinatura', 'assinatura', 500::numeric, 'Pontos mensais ALL Signature Essential', true)
    ) as v (d, tipo, origem, qtd, ds, plano);

  -- Reajuste do plano em 29/08/2026: R$ 71,00 -> R$ 76,00.
  update public.assinaturas
     set valor_mensal = 76.00
   where conta_id = v_conta
     and nome_plano = 'All Signature Essential';
end
$$;

comment on column public.movimentacoes.data_expiracao is
  'Validade do lote de pontos. NULL quando o programa só informa a validade do saldo (All Accor: 12 meses após a última movimentação).';
