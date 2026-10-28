# Hospedagens — All Accor

De onde vêm os dados da página **Minhas Hospedagens** e como cada estadia foi
registrada. Capturado em **27/10/2026**.

---

## 1. Fonte

A tela **Minhas reservas** (`https://all.accor.com/account/pt-br/my-bookings`) chama:

```
GET https://api.accor.com/orders/v1/contacts/me/orders
    ?currency=BRL
    &fields=id,folderNumber,invoice,metaInfo.*,orderItems.*,
            orderItems.hotelBooking.*,
            orderItems.hotelBooking.hotel[name,contact,factsheetUrl,id,brand,label,localization,rating]
```

Retorno: array de pedidos, um por reserva. O que importa está em
`orderItems[0].hotelBooking`:

| Campo | Exemplo |
|---|---|
| `hotel.name` | `ibis Buenos Aires Obelisco` |
| `hotel.brand.label` | `Ibis` |
| `hotel.rating.star.score` | `3` |
| `hotel.localization.address.city` | `BUENOS AIRES` |
| `hotel.localization.address.country` / `countryCode` | `Argentina` / `AR` |
| `hotel.localization.address.line1` | `Av Corrientes 1344` |
| `reservation.stayInfo.arrivalDate` / `departureDate` | `2026-08-29` / `2026-09-02` |
| `reservation.stayInfo.nightCount` | `4` |
| `reservation.stayInfo.adultCount` | `2` |
| `stayDetails[0].declaration.roomNumber` | `0815` |
| `status` | `ACTIVE_INITIAL`, `ACTIVE_MODIFIED`, `CANCELLED` |
| `folderNumber` | `QNCSHGTZ` |
| `externalUniqueIds[]` | id de reserva **e** de confirmação do PMS |

O `externalUniqueIds` com `application` terminando em `_Confirmation` é o mesmo
número que aparece como `fileNumber` no extrato de pontos — é por ele que a
estadia e o débito de pontos se reconhecem.

**Dinheiro não é confiável aqui.** `paymentTransactions` vem `0` e os valores de
`amounts`/`loyaltySavings` são tarifa e "economia", não o que saiu do bolso. Por
isso a tabela `hospedagens` guarda **`valor` como custo da estadia** (tarifa com
impostos, `reservation.amounts.netPriceIncludingTaxes`) — e **não** como "pago".
Numa estadia com pontos, esse é o valor que os pontos cobriram.

---

## 2. O que foi gravado

Endpooint devolveu 3 reservas; entram as 2 que aconteceram:

| Reserva | Hotel | Cidade | Entrada → saída | Noites | Pontos | Custo | Débito vinculado |
|---|---|---|---|---:|---:|---:|---|
| `QNCSHGTZ` | ibis Buenos Aires Obelisco | Buenos Aires, AR | 29/08 → 02/09/2026 | 4 | 13.000 | R$ 1.632,27 | 29/08, `-13.000` |
| `QNFSJSBF` | ibis Curitiba Aeroporto | São José dos Pinhais, PR | 28/08 → 29/08/2026 | 1 | 2.000 | R$ 254,30 | 29/08, `-2.000` |

O custo vem de `reservation.amounts.netPriceIncludingTaxes` (tarifa **com impostos**):
R$ 408,07 por noite em Buenos Aires e R$ 254,30 em Curitiba.

**Ficou de fora:** `QNCSHJDL` (ibis Curitiba, 28/08, `CANCELLED`, 0 pontos) — decisão
do usuário. O débito de 38.000 pontos do **Pullman Miami Airport** (reserva cancelada,
`cancelled: true` no extrato) também não tem estadia correspondente e aparece na página
em **Resgates sem detalhe de hospedagem**.

### Por que o ibis Curitiba tem 2.000 pontos

A reserva foi feita com tarifa em dinheiro e o `rewardsUsage` da reserva vem vazio —
mas o extrato tem um débito de `-2.000` em 29/08 com `fileNumber 220851610`, que é
exatamente o **id de confirmação** dessa reserva (`externalUniqueIds`). Ou seja: os
2.000 pontos foram usados no âmbito dessa estadia, mesmo não sendo o pagamento da
diária.

---

## 3. Checksum

| Item | Pontos |
|---|---:|
| Pontos nas estadias registradas | 15.000 |
| Débitos de estadia no extrato All Accor | 15.000 (−13.000 −2.000) |
| Débitos **sem** estadia | 38.000 (Pullman, cancelada) |

O total de débitos de estadia do extrato é −53.000 (incluindo o Pullman); a página
mostra 15.000 vinculados e lista os 38.000 restantes como resgate sem detalhe.

| Item | R$ |
|---|---:|
| Custo das estadias registradas | 1.886,57 |
| · ibis Buenos Aires (4 noites) | 1.632,27 |
| · ibis Curitiba (1 noite) | 254,30 |

---

## 4. Tabela `hospedagens`

Migration `0015_hospedagens.sql` (tabela + RLS desligado) e
`0016_seed_hospedagens_accor.sql` (as duas estadias, idempotente por `localizador`).

| Coluna | Observação |
|---|---|
| `conta_id` | conta do programa |
| `movimentacao_id` | débito de pontos que pagou a estadia; `NULL` quando não houve |
| `hotel`, `marca`, `categoria` | nome, bandeira e estrelas |
| `cidade`, `estado`, `pais`, `endereco` | localização |
| `check_in`, `check_out`, `noites`, `hospedes`, `quarto` | estadia |
| `pontos` | positivo (o extrato guarda negativo) |
| `valor` | custo da estadia em R$ (tarifa com impostos) |
| `localizador` | `folderNumber` da reserva |
| `status` | `reservada` · `em_andamento` · `concluida` · `cancelada` |
| `observacao` | texto livre |

---

## 5. Página

**Menu → Minhas Hospedagens** (`/hospedagens`). Cartões de resumo (hospedagens,
noites, pontos usados, custo), tabela com entrada/saída, hotel, local, noites,
pontos, custo e localizador, e o bloco de resgates sem detalhe.

O **custo** é o valor da estadia em R$ (tarifa com impostos). Numa estadia paga com
pontos ele representa quanto a estadia custaria em dinheiro — não o que saiu do
bolso. Estadia sem valor informado aparece com “—”.

Os números seguem o mesmo alinhamento das demais colunas (à esquerda), como em
**Meus Voos**.
