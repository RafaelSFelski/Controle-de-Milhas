# Voos resgatados com milhas Smiles — 2026

Detalhamento dos três resgates de voo que aparecem no extrato Smiles de 2026
(todos `tipo = 'debito'`, hoje com prefixo `Resgate de voo` na descrição).

> **Fonte:** site do Smiles (sessão do titular, conta `458520580`), via API interna
> da tela **Minhas viagens** (`GET https://member-flight-green.smiles.com.br/v1/flights/internal`)
> e da API do extrato (`POST https://alltransactions-prd.smiles.com.br/transaction-search`).
> **Extração:** 27/10/2026. Nenhum dado foi digitado à mão: os valores abaixo vêm
> dos JSONs dessas duas APIs.

---

## 1. Os voos

| Resgate (data) | Voo (data) | Rota | Voo | Passageiro(s) | Milhas | R$ pago | Localizador |
|---|---|---|---|---:|---:|---:|---|
| 09/06/2026 | 29/08/2026 | CWB → AEP (Curitiba → Buenos Aires) | G3 7642 · 11:00 → 17:20 | Rafael Soares Felski, Mariana Barbosa Balvedi | 64.165 | 226,38 | **LMUXWJ** |
| 10/07/2026 | 29/08/2026 | CWB → AEP (Curitiba → Buenos Aires) | G3 7642 · 11:00 → 17:20 | Claudete Duarte Barbosa | 45.000 | 133,18 | **CGRRVS** |
| 11/08/2026 | 03/09/2026 | POA → CWB (Porto Alegre → Curitiba) | G3 1279 · 12:30 → 16:35 | Rafael Soares Felski | 36.200 | 59,46 | **OCSXKE** |

Companhia: **GOL Linhas Aéreas (G3)** em todos. Tarifa `Tarifa Exclusiva Clube
Smiles e Diamante` (benefício Clube Smiles), classes X / O / N.
Todas emitidas em canal Web/App com milhas; **nenhum trecho de volta** aparece na
conta — os três voos "anteriores" existentes são exatamente estes.

### Como cada resgate casa com a linha do extrato

O casamento é **exato pelo total de milhas** — não foi preciso casar só por data:

| Linha no app | Milhas | Composição no extrato Smiles | Pedido (order id) |
|---|---:|---|---|
| 09/06/2026 · −64.165 | −64.165 | 30.800 (Rafael) + 30.800 (Mariana) + 1.283 + 1.282 (seguro viagem SulAmérica) | 157476508 |
| 10/07/2026 · −45.000 | −45.000 | 45.000 (Claudete) | 158748002 |
| 11/08/2026 · −36.200 | −36.200 | 36.200 (Rafael) | 160135393 |

Observações:

- O resgate de **09/06** inclui **2.565 milhas de seguro viagem** (SulAmérica
  Internacional, 2 apólices) além dos 2 bilhetes — por isso 64.165 e não 61.600.
  O `R$ 226,38` é o valor em dinheiro do **pedido inteiro** (2 passageiros).
- **11/08** foi canal **APP**; os outros dois, **Web**.
- As milhas foram debitadas de blocos distintos (clube, Livelo, Inter) — o extrato
  detalha a origem de cada parcela, mas isso não muda o total.

---

## 2. Custo médio das milhas

### 2.1 Custo de aquisição via Clube Smiles

Plano `Clube Smiles 5.000 (anual)` — tabela `public.assinaturas`:
`valor_mensal = R$ 156,40`, `milhas_mensais = 5.000`, `dia_cobranca = 5`,
`data_inicio = 04/05/2026`.

```
R$ 156,40 ÷ 5.000 milhas = R$ 0,03128/milha  →  R$ 31,28 / milheiro
```

### 2.2 Custo efetivo dos resgates (só taxas)

```
taxas pagas   = 226,38 + 133,18 + 59,46              = R$ 419,02
milhas gastas = 64.165 + 45.000 + 36.200             = 145.365
R$/milheiro   = 419,02 ÷ 145.365 × 1.000             = R$ 2,88 / milheiro
```

Ou seja: **cada milheiro resgatado custou R$ 2,88 em dinheiro** — mas esse número
ignora quanto custou *gerar* as milhas (é só a taxa de embarque).

### 2.3 Custo médio ponderado do que foi adquirido no período

```
custo do clube  = 6 competências (mai–out/2026) × R$ 156,40 = R$ 938,40
taxas pagas     =                                          = R$ 419,02
-------------------------------------------------------------
total desembolsado                                          = R$ 1.357,42

milhas creditadas na conta em 2026 (19 créditos)            = 170.560
R$/milheiro = 1.357,42 ÷ 170.560 × 1.000                    = R$ 7,96 / milheiro
```

**Premissas adotadas:**

1. **6 competências de clube** (04/05 a 27/10/2026 = maio, junho, julho, agosto,
   setembro, outubro), cobrança no dia 5. O extrato confirma 6 linhas
   `tipo = 'assinatura'`.
2. O denominador são **todas as milhas creditadas em 2026** (170.560), somando
   clube, transferências e bônus — é o "estoque" que efetivamente entrou no período.
3. As taxas entram no numerador porque foram dinheiro real gasto para usar as milhas.

**O que ficou de fora (e distorce o número para baixo):**

- **Transferências Livelo e Inter Loop não têm custo registrado** no app: 40.000
  (Livelo) + 27.000 (Inter Loop, 15.000 + 12.000 de bônus) entraram como custo zero.
  Se esses pontos tiveram custo de aquisição, o R$ 7,96 real é **maior**.
- **Bônus** (Clube Anual bônus, Bônus Reativação, Bônus de transferência) também
  entram sem custo — mas são consequência das compras acima, então em parte já
  estão embutidos.
- O **seguro viagem** do resgate de 09/06 consumiu 2.565 milhas: está nas milhas
  gastas, mas não é "voo".
- Não há imposto/IOF, anuidade de cartão ou custo de oportunidade no cálculo.

**Visão alternativa (só milhas de clube):** o clube creditou 27.000 milhas em 6
meses (o 1º mês foi proporcional, 2.000) para R$ 938,40 → **R$ 34,76/milheiro**.
É o custo "puro" das milhas compradas; o R$ 7,96 é o custo médio do estoque
inteiro, diluído pelas milhas que entraram de graça.

---

## 3. O que foi gravado no banco

`public.movimentacoes` (conta `52f93b89-5ffa-4a50-9d1c-9668734812d8`):

| data | quantidade | valor_pago | descricao |
|---|---:|---:|---|
| 2026-06-09 | −64.165 | 226,38 | `Resgate de voo · CWB→AEP · Rafael Soares Felski, Mariana Barbosa Balvedi · R$ 226,38` |
| 2026-07-10 | −45.000 | 133,18 | `Resgate de voo · CWB→AEP · Claudete Duarte Barbosa · R$ 133,18` |
| 2026-08-11 | −36.200 | 59,46 | `Resgate de voo · POA→CWB · Rafael Soares Felski · R$ 59,46` |

`quantidade`, `data`, `tipo`, `conta_id` e `data_expiracao` **não** foram alterados.
Total de movimentações permanece **22** e o saldo continua **25.195**, igual ao site.

### 3.1 Na tabela `voos` (página **Voos**)

`public.voos` guarda uma **linha por passageiro**, mesmo quando o pedido é único.
`milhas` e `valor_pago` são o rateio daquele passageiro dentro do resgate:

| data_voo | rota | voo | passageiro | localizador | milhas | R$ |
|---|---|---|---|---|---:|---:|
| 29/08/2026 | CWB→AEP | GOL G3 7642 · 11:00–17:20 | Rafael Soares Felski | LMUXWJ | 32.082 | 113,19 |
| 29/08/2026 | CWB→AEP | GOL G3 7642 · 11:00–17:20 | Mariana Barbosa Balvedi | LMUXWJ | 32.083 | 113,19 |
| 29/08/2026 | CWB→AEP | GOL G3 7642 · 11:00–17:20 | Claudete Duarte Barbosa | CGRRVS | 45.000 | 133,18 |
| 03/09/2026 | POA→CWB | GOL G3 1279 · 12:30–16:35 | Rafael Soares Felski | OCSXKE | 36.200 | 59,46 |

**Como o pedido de 09/06 foi dividido** (64.165 milhas e R$ 226,38 no total):

- 30.800 milhas por bilhete + seguro viagem (1.283 + 1.282) = **32.082 + 32.083**.
  O último passageiro leva a milha restante, então a soma fecha exatamente.
- O R$ 226,38 não vem separado por passageiro na API → rateio de **113,19** cada.
  É rateio, não valor informado pelo Smiles.

A tela fica em **Menu → Voos** (`/voos`) e mostra os cartões de resumo (bilhetes,
milhas, taxas pagas), a tabela por passageiro (com o R$ das taxas por linha) e um aviso
de resgates que ainda não têm detalhe cadastrado.

---

## 4. O que não foi possível obter

- **Trecho de volta**: não existe na conta. Provavelmente a volta foi comprada em
  dinheiro ou por outro canal (a viagem termina com um POA→CWB em 03/09).
- **Valor exato por passageiro**: a API de "Minhas viagens" devolve apenas o
  `money` do pedido (total). Para o resgate de 09/06 (2 passageiros) não dá para
  separar quanto cada um pagou de taxa.
- **Número do bilhete por passageiro**: existe no extrato (`Ticket Number`), mas
  não foi gravado no app por não haver coluna para isso.
- **Composição detalhada do `money`** (taxa de embarque × serviço): o site só
  devolve o total.
- A API do extrato **não** traz destino/trecho — por isso foi preciso cruzar com a
  API de "Minhas viagens". O runbook antigo (`docs/SINCRONIZACAO-PROGRAMAS.md`,
  §10) dava esse detalhe como pendência; agora está resolvido.
