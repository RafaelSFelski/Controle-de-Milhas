-- Voos em linhas separadas por passageiro.
--
-- Antes (0011): 1 linha por resgate, com `passageiros text[]` e milhas/R$ lidos
-- da movimentação vinculada.
-- Agora: 1 linha por bilhete/passageiro, mesmo quando o pedido é único, com
-- `passageiro text`, `milhas` e `valor_pago` próprios.
--
-- Rateio de um pedido com n passageiros (não perde nem sobra 1 milha):
--   milhas_i = floor(total * i / n) - floor(total * (i-1) / n)
--   valor_i  = round(total * i / n, 2) - round(total * (i-1) / n, 2)
-- A soma das linhas continua igual ao total do resgate.

alter table public.voos add column if not exists passageiro text;
alter table public.voos add column if not exists milhas numeric(14,2);
alter table public.voos add column if not exists valor_pago numeric(14,2);

-- Um resgate pode pagar vários passageiros/trechos: o vínculo deixa de ser 1:1.
-- (precisa vir antes do insert do passo 2)
alter table public.voos drop constraint if exists voos_movimentacao_id_key;
create index if not exists idx_voos_movimentacao on public.voos(movimentacao_id);

-- 1) A linha existente vira o 1º passageiro do pedido.
update public.voos v
   set passageiro = coalesce(v.passageiros[1], 'Passageiro'),
       milhas = floor(coalesce(x.quantidade, 0) / x.n),
       valor_pago = round(coalesce(x.valor_pago, 0) / x.n, 2)
  from (
        select v2.id,
               abs(m.quantidade) as quantidade,
               m.valor_pago,
               greatest(coalesce(array_length(v2.passageiros, 1), 0), 1) as n
          from public.voos v2
          left join public.movimentacoes m on m.id = v2.movimentacao_id
       ) x
 where x.id = v.id;

-- 2) Os demais passageiros ganham linha própria.
insert into public.voos (
  conta_id, movimentacao_id, data_voo, origem, destino, passageiro,
  localizador, companhia, numero_voo, hora_saida, hora_chegada, observacao,
  milhas, valor_pago, created_at
)
select
  v.conta_id, v.movimentacao_id, v.data_voo, v.origem, v.destino, v.passageiros[i],
  v.localizador, v.companhia, v.numero_voo, v.hora_saida, v.hora_chegada, v.observacao,
  floor(coalesce(abs(m.quantidade), 0) * i / l.n)
    - floor(coalesce(abs(m.quantidade), 0) * (i - 1) / l.n),
  round(coalesce(m.valor_pago, 0) * i / l.n, 2)
    - round(coalesce(m.valor_pago, 0) * (i - 1) / l.n, 2),
  v.created_at
from public.voos v
left join public.movimentacoes m on m.id = v.movimentacao_id
cross join lateral (
  select greatest(coalesce(array_length(v.passageiros, 1), 0), 1) as n
) l
cross join lateral generate_series(2, l.n) as i
where not exists (
  select 1 from public.voos x
   where x.movimentacao_id is not distinct from v.movimentacao_id
     and x.passageiro = v.passageiros[i]
);

-- 3) Fecha o schema: sem array e sem relação 1:1 com o resgate.
alter table public.voos drop column if exists passageiros;

update public.voos set milhas = 0 where milhas is null;

alter table public.voos alter column passageiro set not null;
alter table public.voos alter column milhas set default 0;
alter table public.voos alter column milhas set not null;

comment on column public.voos.passageiro is
  'Passageiro do bilhete. Um pedido com n passageiros gera n linhas em voos.';
comment on column public.voos.milhas is
  'Milhas atribuídas a este passageiro (rateio do resgate). Soma por movimentacao_id = total do resgate.';
comment on column public.voos.valor_pago is
  'R$ atribuído a este passageiro (rateio do pedido). NULL quando desconhecido.';
