-- Hospedagens do All Accor capturadas em 27/10/2026.
--
-- Fonte: GET https://api.accor.com/orders/v1/contacts/me/orders (tela
-- /account/pt-br/my-bookings). Ver docs/HOSPEDAGENS-ACCOR.md.
--
-- Entram só estadias que aconteceram. A reserva cancelada (QNCSHJDL, 28/08/2026,
-- 0 pontos) fica de fora por decisão do usuário — o resgate dela aparece no
-- extrato como "Estadia paga com pontos: Pullman Miami Airport" (cancelado).
--
-- Idempotente por localizador: não insere a mesma reserva duas vezes.

insert into public.hospedagens (
  conta_id, movimentacao_id, hotel, marca, categoria, cidade, estado, pais,
  endereco, check_in, check_out, noites, hospedes, quarto, pontos, valor,
  localizador, status, observacao
)
select
  c.id,
  (select m.id
     from public.movimentacoes m
    where m.conta_id = c.id
      and m.data = '2026-08-29'
      and m.quantidade = -13000
      and m.descricao like 'Estadia paga com pontos%'
    limit 1),
  'ibis Buenos Aires Obelisco', 'Ibis', 3, 'Buenos Aires', null, 'Argentina',
  'Av Corrientes 1344', '2026-08-29', '2026-09-02', 4, 2, '0815', 13000, 1632.27,
  'QNCSHGTZ', 'concluida', null
from public.contas c
join public.programas p on p.id = c.programa_id
where p.nome = 'All Accor'
  and c.numero_conta = '3081033974922A2B'
  and not exists (
    select 1 from public.hospedagens h where h.localizador = 'QNCSHGTZ'
  );

insert into public.hospedagens (
  conta_id, movimentacao_id, hotel, marca, categoria, cidade, estado, pais,
  endereco, check_in, check_out, noites, hospedes, quarto, pontos, valor,
  localizador, status, observacao
)
select
  c.id,
  (select m.id
     from public.movimentacoes m
    where m.conta_id = c.id
      and m.data = '2026-08-29'
      and m.quantidade = -2000
      and m.descricao like 'Estadia paga com pontos%'
    limit 1),
  'ibis Curitiba Aeroporto', 'Ibis', 3, 'São José dos Pinhais', 'PR', 'Brasil',
  'Rodovia BR 376, 1633', '2026-08-28', '2026-08-29', 1, 2, '0670', 2000, 254.30,
  'QNFSJSBF', 'concluida',
  'Reserva com tarifa em dinheiro; o extrato registra 2.000 pontos nesta estadia (confirmação 220851610).'
from public.contas c
join public.programas p on p.id = c.programa_id
where p.nome = 'All Accor'
  and c.numero_conta = '3081033974922A2B'
  and not exists (
    select 1 from public.hospedagens h where h.localizador = 'QNFSJSBF'
  );
