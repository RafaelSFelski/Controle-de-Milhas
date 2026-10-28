-- Trechos voados pela Azul, lidos do extrato do TudoAzul em 27/10/2026.
--
-- Fonte: operações com `type.code = 'ACV'`/nome "Acúmulo de voo" no extrato
-- (`POST /perfil/br/pt/extract`), que trazem em `comments`
-- "Booking: <localizador> | From <origem> to <destino>" e 0 ponto resgatável.
--
-- São 9 trechos / 5 localizadores. O extrato não traz número do voo, horário
-- nem assento, então esses campos ficam de fora.
--
-- Idempotente por conta + localizador + data + trecho.

insert into public.voos_realizados
  (conta_id, data, origem, destino, origem_nome, destino_nome, localizador, companhia, pontos, observacao)
select
  c.id, v.data, v.origem, v.destino, v.origem_nome, v.destino_nome,
  v.localizador, 'Azul', 0, 'Trecho creditado sem pontos resgatáveis (só status).'
from (values
  ('2023-10-14'::date, 'CWB', 'IGU', 'Curitiba', 'Foz do Iguaçu', 'SWGWTX'),
  ('2023-10-20'::date, 'IGU', 'CWB', 'Foz do Iguaçu', 'Curitiba', 'SWGWTX'),
  ('2025-04-17'::date, 'CWB', 'GIG', 'Curitiba', 'Rio de Janeiro (Galeão)', 'TMZL9T'),
  ('2025-04-21'::date, 'GIG', 'CWB', 'Rio de Janeiro (Galeão)', 'Curitiba', 'TMZL9T'),
  ('2025-08-21'::date, 'CWB', 'POA', 'Curitiba', 'Porto Alegre', 'FHSIQC'),
  ('2025-08-21'::date, 'POA', 'BRC', 'Porto Alegre', 'Bariloche', 'PLZW7G'),
  ('2025-08-27'::date, 'IGU', 'CWB', 'Foz do Iguaçu', 'Curitiba', 'OW2BFA'),
  ('2025-11-23'::date, 'CWB', 'IGU', 'Curitiba', 'Foz do Iguaçu', 'IMKJRD'),
  ('2025-11-26'::date, 'IGU', 'CWB', 'Foz do Iguaçu', 'Curitiba', 'IMKJRD')
) as v (data, origem, destino, origem_nome, destino_nome, localizador)
join public.contas c on true
join public.programas p on p.id = c.programa_id
where p.nome = 'TudoAzul'
  and c.numero_conta = '9873867577'
  and not exists (
    select 1 from public.voos_realizados x
     where x.conta_id = c.id
       and x.localizador = v.localizador
       and x.data = v.data
       and x.origem = v.origem
       and x.destino = v.destino
  );
