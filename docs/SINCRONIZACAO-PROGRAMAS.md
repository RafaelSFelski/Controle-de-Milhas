# Sincronização de programas — runbook

Como puxar **extrato + assinatura** dos programas de fidelidade para o Supabase
sem digitar movimentação à mão.

> Última execução: **27/10/2026** — Smiles (22 movimentos, saldo 25.195),
> All Accor (35, 32.148), TudoAzul (49, 13.033), Livelo (17, 10.866) e
> Esfera (7, 5.310).

---

## 0. Conceito (leia antes de mexer)

O app **não armazena saldo**. `public.contas` só tem `titular_id`, `programa_id` e
`numero_conta`. O saldo é derivado:

```sql
-- public.v_saldos_contas
select conta_id, sum(quantidade) as saldo from public.movimentacoes group by conta_id
```

Consequências:

1. **Nunca se "grava saldo"** — grava-se o **extrato**. O saldo aparece sozinho.
2. O saldo do site serve como **checksum**: se `sum(quantidade)` divergir do site,
   falta (ou sobra) movimento — investigue antes de criar um `ajuste`.
3. `tipo` aceita: `credito`, `debito`, `transferencia_saida`, `transferencia_entrada`,
   `expiracao`, `assinatura`, `ajuste`.
4. **Débito e expiração são negativos.** `quantidade` é o valor com sinal.

---

## 1. Ferramenta: Chrome controlado por CDP

### Por que não o navegador embutido

O login do Smiles quebra no navegador do app: a chamada
`POST https://apigw-green.smiles.com.br/validate-doc/v2/status` volta **406 sem
`Access-Control-Allow-Origin`**, e assets de `universal-login-green.smiles.com.br`
caem com `ERR_TUNNEL_CONNECTION_FAILED` (proxy do navegador). Por isso usamos um
**Chrome separado**, com perfil próprio e rede direta.

### Subir o Chrome de automação

```powershell
$profile = Join-Path $env:TEMP "smiles-chrome-profile"
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir=$profile `
  --no-first-run --no-default-browser-check `
  https://www.smiles.com.br/

# conferir se o CDP respondeu
Invoke-RestMethod "http://127.0.0.1:9222/json/version"
```

**A janela é sua.** Você faz o login (CPF/e-mail → senha → 2FA). O agente nunca
vê senha nem toca em credencial. Não feche a janela até terminar.

### Helper `cli.mjs`

```js
// npm i puppeteer-core   (dentro da pasta do helper)
import puppeteer from "puppeteer-core";

const [cmd, a1, ...rest] = process.argv.slice(2);
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
const page = pages[Math.min(Number(a1) || 0, pages.length - 1)];

if (cmd === "pages") console.log(JSON.stringify(await Promise.all(pages.map(async (p, i) =>
  ({ i, url: p.url(), title: await p.title().catch(() => "") }))), null, 2));
if (cmd === "goto") { await page.goto(rest[0], { waitUntil: "domcontentloaded", timeout: 60000 }); console.log(page.url()); }
if (cmd === "text") console.log((await page.evaluate(() => document.body.innerText)).slice(0, 4000));
if (cmd === "eval") { const out = await page.evaluate(rest.join(" ")); console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2)); }
if (cmd === "shot") { await page.screenshot({ path: rest[0] || "shot.png" }); console.log("ok"); }

await browser.disconnect();
```

Uso: `node cli.mjs pages | goto 0 <url> | text 0 | eval 0 "<js>" | shot 0 foto.png`

---

## 2. Fluxo de sincronização (qualquer programa)

1. **Abrir** o site no Chrome de automação.
2. **Você loga** manualmente (2FA quando pedir).
3. **Localizar a tela de extrato/movimentações** (não a de saldo).
4. **Capturar o JSON** que a própria página consome (XHR), em vez de raspar HTML.
5. **Transformar** em linhas de `movimentacoes`.
6. **Validar o checksum** contra o saldo do site.
7. **Gravar** (idempotente — ver §9).
8. **Sincronizar a assinatura** se o programa for clube (§10).

Regra de ouro: **se o checksum não fechar, não grava.** Descobrir a diferença
primeiro (movimento faltando ≠ ajuste).

---

## 3. Smiles (implementado)

### 3.1 Telas

| O quê | URL |
|---|---|
| Extrato | `https://www.smiles.com.br/minha-conta/extrato` |
| Meu Clube (assinatura) | `https://www.smiles.com.br/group/guest/minha-conta/clube-smiles/informacoes-do-clube` |
| Minhas viagens (voos) | `https://www.smiles.com.br/restrito/minhas-viagens` |

A tela de extrato abre em "Últimos 30 dias". Períodos longos demoram/limitam; por
isso **não usamos a UI** — chamamos a API direto.

### 3.2 API do extrato

```
POST https://alltransactions-prd.smiles.com.br/transaction-search
authorization: Bearer <token da sessão>
content-type: application/json; charset=UTF-8

{"startDate": 1514775600000, "endDate": 1793139078444}   // epoch em ms
```

**O token não é o JWT do `localStorage`.** `localStorage["session-token"]` é um JWT
e a API responde `401 Unauthorized` com ele. O bearer válido é opaco
(`urrYC6...`) e só existe no header da requisição que a própria página faz.

**Não dá para chamar por `fetch` de dentro da página** — CORS bloqueia
(`Failed to fetch`). O caminho que funciona: **capturar o header via CDP e repetir
a chamada do Node**.

#### Passo A — capturar token + payload (recarrega o extrato)

```js
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const page = (await browser.pages())[0];
await page.bringToFront();
await page.goto("https://www.smiles.com.br/minha-conta/extrato", { waitUntil: "domcontentloaded" });

const hit = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 45000);
  page.on("response", async (res) => {
    if (!res.url().includes("transaction-search")) return;
    clearTimeout(timer);
    resolve({
      url: res.url(),
      headers: res.request().headers(),
      body: await res.text().catch(() => null),
    });
  });
});

fs.writeFileSync("smiles-req.json", JSON.stringify(hit, null, 2));
await browser.disconnect();
console.log("capturado:", hit ? hit.headers.authorization.slice(0, 16) + "..." : "NADA");
```

O token dura pouco (na prática, a sessão do site). **Recapture antes de cada
sincronização.**

#### Passo B — buscar o período desejado (Node, sem CORS)

```js
import fs from "node:fs";

const cap = JSON.parse(fs.readFileSync("smiles-req.json", "utf8"));
const startDate = new Date("2015-01-01T00:00:00-03:00").getTime();
const endDate = Date.now();

const res = await fetch(cap.url, {
  method: "POST",
  headers: {
    authorization: cap.headers.authorization,
    accept: "application/json",
    "content-type": "application/json; charset=UTF-8",
    origin: "https://www.smiles.com.br",
    referer: "https://www.smiles.com.br/",
  },
  body: JSON.stringify({ startDate, endDate }),
});
const data = await res.json();
fs.writeFileSync("smiles-transacoes.json", JSON.stringify(data, null, 2));
console.log("transações:", data.length);
```

### 3.3 Mapeamento campo → tabela

Retorno é um **array de transações**. Só dois campos importam de verdade.

| Origem (API) | Destino (`movimentacoes`) | Regra |
|---|---|---|
| `"Transaction Date"` (`MM/DD/YYYY`) | `data` | converter para `YYYY-MM-DD` |
| `"Product Name"` | `descricao` | ex.: `Clube Anual`, `Pontos Livelo`, `VOO` |
| `"Transaction Type"` | `tipo` | `Accrual` → crédito · `Redemption` → débito |
| `LOY Transaction Accrual Item[]` onde `"Point Internal Name" = "Point 1 Value"` | `quantidade` / `data_expiracao` | `"Accrualed Value"` e `"Expiration Date"` |
| `"Amount"` (redemptions de voo) | `quantidade` (negativo) | ver abaixo |

**Regras finas (importantes):**

- `Point 2 Value` são **milhas qualificáveis** (status, não saldo) → **nunca importar**.
- `"Point Sub Type" = "Bonus Smiles"` → é bônus. Gravar **em linha separada**,
  com sufixo `(bônus)` na descrição: o bônus expira em ~1 ano, a base em 5–10.
- Um mesmo `Accrual` pode ter vários itens `Point 1 Value` (base + bônus).
  O topo `"Miles Quantity"` **não** é confiável quando há bônus.
- **Crédito:** somar `Accrualed Value` de todos os itens `Point 1 Value`
  (ignorar `Used Value` — o consumo já vem como `Redemption`).
- **Redemption `VOO`:** `"Miles Quantity"` vem vazio; usar **`"Amount"`**.
- **Redemption `EXPIRACAO`:** usar `"Miles Quantity"` → `tipo = 'expiracao'`.
- Transações de `Accrual` com `"Product Name" = "VOO"` e `Amount = 0`: ignorar.

### 3.4 Conversão (script de referência)

```js
const toISO = (d) => {
  const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

const movs = [];
for (const t of transacoes) {
  const tipo = t["Transaction Type"];
  const produto = (t["Product Name"] || "").trim();
  const data = toISO(t["Transaction Date"]);
  const itens = (t["LOY Transaction Accrual Item"] || [])
    .filter((p) => p["Point Internal Name"] === "Point 1 Value");

  if (tipo === "Accrual") {
    for (const p of itens) {
      const qtd = Number(p["Accrualed Value"] || 0);
      if (!qtd) continue;
      const bonus = p["Point Sub Type"] === "Bonus Smiles";
      movs.push({
        tipo: "credito",
        quantidade: qtd,
        data,
        data_expiracao: toISO(p["Expiration Date"]),
        descricao: bonus ? `${produto} (bônus)` : produto,
      });
    }
    continue;
  }

  if (tipo === "Redemption") {
    const qtd = Number(t["Amount"] || t["Miles Quantity"] || 0);
    if (!qtd) continue;
    movs.push({
      tipo: produto === "EXPIRACAO" ? "expiracao" : "debito",
      quantidade: -qtd,                                  // débito é negativo
      data,
      data_expiracao: null,
      descricao: produto === "EXPIRACAO" ? "Expiração de milhas"
               : produto === "VOO" ? "Resgate de voo" : produto,
    });
  }
}
```

### 3.5 Checksum apurado em 27/10/2026

| Item | Milhas |
|---|---:|
| Créditos (2026) | 170.560 |
| Resgates de voo | −145.365 |
| Expirações (2018/2019/2022) | −800 |
| **Saldo calculado** | **25.195** |
| **Saldo no site** | **25.195** |

Os 12 movimentos de 2018–2022 (Shell) somam **zero** (800 crédito − 800 expiração).
Foram omitidos por decisão do usuário: importamos só **2026+**.

### 3.6 Assinatura (Clube Smiles)

Dados lidos em **Meu Clube** (27/10/2026):

| Campo | Valor |
|---|---|
| Plano | Clube Smiles **5.000** (anual) |
| Valor | R$ 1.876,80/ano → **R$ 156,40/mês** (12x) |
| Milhas | 5.000/mês |
| Dia do crédito | **5** |
| Início | 04/05/2026 |
| Status | ativo |
| Vencimento do plano | junho/2027 |

```sql
-- cria o plano (uma vez)
insert into public.assinaturas
  (conta_id, nome_plano, valor_mensal, dia_cobranca, milhas_mensais, data_inicio, status)
values
  ('<conta_smiles>', 'Clube Smiles 5.000 (anual)', 156.40, 5, 5000, '2026-05-04', 'ativa');

-- liga os créditos do clube que já vieram do extrato
update public.movimentacoes
   set assinatura_id = '<id_da_assinatura>',
       tipo = 'assinatura',
       origem = 'assinatura'
 where conta_id = '<conta_smiles>'
   and descricao = 'Clube Anual';
```

**Por que ligar:** o botão *"Gerar créditos do mês"* (`gerar_creditos_assinaturas_mes`)
só insere um crédito quando **não existe** `movimentacoes` com aquele
`assinatura_id` + `tipo='assinatura'` no mês. Sem o vínculo, ele duplicaria os
5.000 do clube.

### 3.7 Voos resgatados (detalhe + valor pago)

O extrato **não** traz rota nem passageiro — só `Resgate de voo` e o total. O
detalhe vem de:

```
GET https://member-flight-green.smiles.com.br/v1/flights/internal
```

Cruze pelo total de milhas e pela data (o casamento é exato: o total do resgate
bate com a soma dos bilhetes + seguro, quando houver).

Cada resgate tem `miles` e `money` (R$ do pedido inteiro). Grave:

| Campo | Onde |
|---|---|
| valor em R$ pago nas taxas | `movimentacoes.valor_pago` (migration `0010`) |
| rota, passageiro, valor | `movimentacoes.descricao` |
| data do voo, rota, passageiros, PNR, companhia, horários | `voos` (migration `0011`) |

Formato da descrição:
`Resgate de voo · CWB→AEP · Rafael Soares Felski, Mariana Barbosa Balvedi · R$ 226,38`

O `money` é **do pedido**, não por passageiro — não tente dividir.

#### Tabela `voos` (página **Voos**)

O detalhe estruturado fica em `public.voos`, ligado ao resgate por
`movimentacao_id` (`on delete cascade`). O vínculo **não é 1:1**: um resgate com
2 passageiros gera **2 linhas** — uma por passageiro, mesmo comprados juntos.

`milhas` e `valor_pago` são gravados na própria linha, já **rateados**:

```
milhas_i = floor(total * i / n) - floor(total * (i-1) / n)
valor_i  = round(total * i / n, 2) - round(total * (i-1) / n, 2)
```

Assim a soma das linhas de um `movimentacao_id` é sempre igual ao total do resgate
(nem 1 milha a mais, nem a menos). Verificação:

```sql
select m.id, abs(m.quantidade) as resgate, sum(v.milhas) as voos,
       abs(m.quantidade) - sum(v.milhas) as diferenca
  from public.movimentacoes m join public.voos v on v.movimentacao_id = m.id
 group by m.id, m.quantidade;
```

```sql
insert into public.voos
  (conta_id, movimentacao_id, data_voo, origem, destino, passageiro,
   localizador, companhia, numero_voo, hora_saida, hora_chegada,
   milhas, valor_pago, observacao)
values
  ('<conta_smiles>',
   (select id from public.movimentacoes
     where conta_id = '<conta_smiles>' and data = '2026-06-09'
       and quantidade = -64165 and tipo = 'debito'),
   '2026-08-29', 'CWB', 'AEP', 'Rafael Soares Felski',
   'LMUXWJ', 'GOL', 'G3 7642', '11:00', '17:20',
   32082, 113.19, 'Pedido de 2 passageiros (rateio).');
```

Regras:

- `origem` / `destino` em **IATA** (`CWB`, `AEP`).
- `passageiro` é **um nome por linha** (não array).
- `milhas`/`valor_pago` são o rateio do passageiro; sem rateio conhecido, deixe
  `valor_pago` nulo em vez de inventar.
- Ida/volta e conexões também são linhas separadas.
- A página mostra em **Resgates sem detalhe de voo** qualquer débito
  `descricao like 'Resgate de voo%'` sem linha em `voos` — nada fica escondido.
- A página mostra em **Resgates sem detalhe de voo** qualquer débito
  `descricao like 'Resgate de voo%'` sem linha em `voos` — nada fica escondido.

Resultado de 27/10/2026 (detalhe completo em `docs/VOOS-SMILES.md`):

| Resgate | Voo | Rota | Passageiro(s) | Milhas | R$ |
|---|---|---|---:|---:|---:|
| 09/06 | 29/08 | CWB→AEP | Rafael + Mariana | 64.165 | 226,38 |
| 10/07 | 29/08 | CWB→AEP | Claudete | 45.000 | 133,18 |
| 11/08 | 03/09 | POA→CWB | Rafael | 36.200 | 59,46 |

**Custo médio (27/10/2026):** clube R$ 31,28/milheiro · taxas dos resgates
R$ 2,88/milheiro · ponderado do período R$ 7,96/milheiro (subestimado: Livelo e
Inter entraram sem custo).

---

## 4. All Accor (implementado)

### 4.1 Telas e API

| O quê | URL |
|---|---|
| Extrato de pontos | `https://all.accor.com/account/pt-br/global-transaction-history` |
| Saldo / ALL Rewards | `https://all.accor.com/account/pt-br/my-loyalty-program` |
| Login (SSO) | `https://login.accor.com` (botão **Entrar / Cadastre-se**) |

O endereço antigo (`/pt-br/index.shtml`, `/br/pt-br/index.shtml`) **não existe mais** —
devolve "this address is not valid". Hoje a home é `/a/pt-br.html` e a área logada é
uma SPA Vue em `/account/` (qualquer path devolve o mesmo shell; o roteamento é no
cliente).

O extrato **não é GraphQL**. É REST com máscaras de campo:

```
GET https://api.accor.com/customer/v1/contacts/me
    ?currency=BRL
    &fields=loyalty.operations.operation,loyalty.balances,...
headers: Authorization: Bearer <token>
         x-origin: https://all.accor.com
         x-traceid: <uuid>
         appId: all.accor
```

O cookie de sessão não basta: a SPA troca a sessão por um Bearer em
`/authentication/v2.0/authorization`. Como no Smiles, **capture a requisição** e reuse
os headers — não tente montar o token.

### 4.2 Captura

```powershell
cd "$env:TEMP\smiles-automation"
node capture.mjs 'api\.accor\.com' 'C:\...\backups\accor-capture.json' `
  --navigate 'https://all.accor.com/account/pt-br/global-transaction-history' --seconds 45
```

O que interessa é a resposta de `contacts/me` que contém `loyalty.operations.operation`
(no dump foram duas: uma sem corpo por causa do `OPTIONS`, uma com 43 operações).

### 4.3 Mapeamento campo → tabela

| Origem (API) | Destino (`movimentacoes`) | Regra |
|---|---|---|
| `transactionDate` | `data` | usar **`transactionDate`**, não `operationDate` |
| `points` | `quantidade` | já vem com sinal (crédito +, resgate −) |
| `description` | `descricao` | como no site |
| `points > 0` | `tipo = 'credito'` | vira `assinatura` quando `offerCode` é `SIGPL0_MONTHLY_RPOINTS*` |
| `points < 0` | `tipo = 'debito'` | `origem` NULL |
| `statusPoints`, `nightsCount` | — | **nunca importar** (status, não saldo) |
| `fileNumber` | — | número da reserva do hotel; não usado |

`transactionDate` ≠ `operationDate` em 5 linhas. A decisiva é o resgate do Pullman
(`operationDate` 2027-06-22, data do check-out futuro): usar `operationDate` criaria
movimento em 2027 e quebraria saldo e validade.

`origem` por tipo de linha:

| Descrição | `origem` |
|---|---|
| `Earn Partner: …` | `transferencia` |
| `Bonus Partner: …`, `Bónus Gold`, `AZUL … Cross Rewards`, `AZUL MD …` | `promocao` |
| `Pontos trimestrais …` | `assinatura` (mas `tipo='credito'`, sem `assinatura_id`) |
| `Hospedagem: …` | `parceiro` |
| `Reserva cancelada: …` | `outro` |
| `Pontos mensais ALL Signature Essential` (500/mês) | `assinatura` + `assinatura_id` |
| `Estadia paga com pontos: …` | NULL (débito) |

As 8 linhas com `points = 0` ficam de fora: 5 `SIGPL0_MONTHLY_SPOINTS` (100 pontos de
status cada), 2 `SIGPL0_2MONTHS_SNIGHTS` e 1 `Hospedagem` ("earn no earn on burn").
Isso descarta também 566 pontos de status e 7 noites — o app não tem onde guardá-los.

### 4.4 Checksum 27/10/2026

| Item | Pontos |
|---|---:|
| Créditos (32 linhas) | +85.148 |
| Débitos (3 linhas) | −53.000 |
| **Saldo calculado** | **32.148** |
| **Saldo no site** (`loyalty.balances.nbPoints`) | **32.148** |

O extrato começa em 29/05/2026 (adesão ao Signature) e a soma fecha exatamente, então
não falta nem sobra operação nesse intervalo. O número **37.400** que estava anotado
era antigo — o site na captura mostrava 32.148.

### 4.5 Validade (regra do programa)

O All Accor **não tem validade por lançamento**. A regra é rolante: os pontos valem
**12 meses contados da última movimentação** da conta — qualquer crédito, resgate ou
transferência reinicia o prazo de todo o saldo.

Prova nos dados: `memberInfo.pointsExpirationDate = 29/09/2027`, que é o último crédito
(29/09/2026) + 12 meses.

Por isso `data_expiracao` fica **NULL** nas linhas do All Accor: preencher por linha
inventaria validade que não existe (e a data "andaria" a cada mês). Consequência
conhecida: o painel "Próximas expirações" não mostra All Accor (item no §14).

### 4.6 Assinatura (All Signature Essential)

| Campo | Valor |
|---|---|
| Plano | `SIGPL0` — ALL Signature Essential, mensal recorrente |
| Valor | R$ 71,00 até 29/07/2026 · **R$ 76,00** desde 29/08/2026 |
| Pontos | 500/mês (+100 pontos de status) |
| Dia da cobrança | 29 |
| Início | 29/05/2026 |
| Status | ativa · próxima cobrança 29/10/2026 |

As cobranças lidas em `allSignatureSubscriptions[0].sales`: #1 29/05 R$ 71, #2 29/06
R$ 71, #3 29/07 R$ 71, #4 29/08 R$ 76, #5 29/09 R$ 76.

Os 5 créditos "Pontos mensais" ficam com `tipo='assinatura'` + `assinatura_id`, como no
Clube Smiles (§3.6), para o botão "Gerar créditos do mês" não duplicar.

O crédito **"Pontos trimestrais"** (500, 29/08) é bônus do plano: fica `credito`,
`origem='assinatura'` e **sem** `assinatura_id`. Se virasse `tipo='assinatura'`, o
dedupe do RPC (`assinatura_id` + mês + tipo) consideraria o mês já creditado e o botão
deixaria de gerar a mensalidade.

### 4.7 Armadilha do dedupe

Em 01/07/2026 existem **4 transferências idênticas** de 4.000 pontos (cada uma com 400
de bônus ALLSignature e 200 do Azul 5%) — mesmo dia, mesma quantidade, mesma descrição.
A chave `data+quantidade+descricao` colapsaria as 4 em uma.

- A sincronização grava o extrato **em bloco**, com guarda "conta sem movimentação".
- Numa futura re-sincronização, comparar por **contagem** por chave (quantas linhas
  existem com aquela chave), nunca por "existe/não existe" — ou usar `external_id` (§14).
- Se um insert parcial falhar, o próximo sync precisa detectar a falta: comparar
  `sum(quantidade)` com o saldo do site **antes** de concluir.

### 4.8 Hospedagens (página Minhas Hospedagens)

O extrato só diz `Estadia paga com pontos: <hotel>`. O detalhe vem de outra API:

```
GET https://api.accor.com/orders/v1/contacts/me/orders
    ?currency=BRL
    &fields=id,folderNumber,invoice,metaInfo.*,orderItems.*,
            orderItems.hotelBooking.*,orderItems.hotelBooking.hotel[name,id,brand,label,localization,rating]
```

(tela `/account/pt-br/my-bookings`). Cada pedido traz `orderItems[0].hotelBooking`
com hotel, endereço, `reservation.stayInfo` (datas, noites, adultos), quarto e
`status` (`ACTIVE_INITIAL`, `ACTIVE_MODIFIED`, `CANCELLED`).

O vínculo com o débito de pontos é pelo **id de confirmação**:
`externalUniqueIds[]` com `application` terminando em `_Confirmation` é o mesmo
número que vem em `fileNumber` no extrato.

```sql
insert into public.hospedagens (
  conta_id, movimentacao_id, hotel, marca, categoria, cidade, estado, pais,
  endereco, check_in, check_out, noites, hospedes, quarto, pontos,
  localizador, status, observacao
)
select
  c.id,
  (select m.id from public.movimentacoes m
    where m.conta_id = c.id and m.data = '2026-08-29'
      and m.quantidade = -13000 and m.descricao like 'Estadia paga com pontos%'
    limit 1),
  'ibis Buenos Aires Obelisco', 'Ibis', 3, 'Buenos Aires', null, 'Argentina',
  'Av Corrientes 1344', '2026-08-29', '2026-09-02', 4, 2, '0815', 13000,
  'QNCSHGTZ', 'concluida', null
from public.contas c
join public.programas p on p.id = c.programa_id
where p.nome = 'All Accor' and c.numero_conta = '3081033974922A2B'
  and not exists (select 1 from public.hospedagens h where h.localizador = 'QNCSHGTZ');
```

Regras:

- `pontos` é **positivo** (o débito no ledger é negativo).
- `valor` é o **custo da estadia** em R$ (`reservation.amounts.netPriceIncludingTaxes`,
  tarifa com impostos). Em resgate, é quanto a estadia custaria em dinheiro — **não**
  use `paymentTransactions` (vem 0) nem `loyaltySavings` (é economia, não preço).
- `movimentacao_id` fica `NULL` quando a estadia não teve resgate.
- Reserva cancelada entra só se o usuário quiser; hoje fica de fora e o débito
  correspondente aparece como "resgate sem detalhe".
- Detalhe em `docs/HOSPEDAGENS-ACCOR.md`.

## 5. TudoAzul (implementado)

### 5.1 Telas e API

| O quê | URL |
|---|---|
| Extrato de pontos | `https://www.voeazul.com.br/perfil/br/pt/extract` |
| Login | `https://www.voeazul.com.br/br/pt/home` → **Fazer login** (modal, sem redirect) |

O extrato **não é REST puro**: é uma **Server Action do Next.js** (`POST` na própria
URL da página, com o header `next-action`). O site está atrás do **Akamai Bot Manager**:
a mesma chamada feita fora da página logada devolve `403 Access Denied`, e repetir o
POST em sequência dispara bloqueio temporário. Por isso a chamada sai **de dentro da
página**, via CDP.

Corpo (array com um objeto):

```json
[{"page":1,"pageSize":0,"dateFrom":"2015-01-01","dateTo":"2026-10-27",
  "cardResume":0,"partnerCode":"","transactionTypeCodes":[]}]
```

- `dateFrom` / `dateTo` em `YYYY-MM-DD`.
- `pageSize: 0` = padrão do servidor (20 por página).
- **Sem** `dateFrom` o extrato volta truncado (só ~6 meses).
- Resposta em RSC (`N:{json}`) com `{extracts:[…], pagination:{totalRecords,…}}`.

### 5.2 Captura

```powershell
cd "$env:TEMP\smiles-automation"

# 1) abrir o extrato e ler cookie + next-action do request real
node capture.mjs 'perfil/br/pt/extract' 'C:\...\backups\azul-capture.json' `
  --navigate 'https://www.voeazul.com.br/perfil/br/pt/extract' --seconds 45

# 2) repetir a chamada pela própria página, período completo, uma vez por página
node azul-extract-browser.mjs 'C:\...\backups\azul-extracts.json'    '2015-01-01' '2026-10-27' 0 1
node azul-extract-browser.mjs 'C:\...\backups\azul-extracts-p2.json' '2015-01-01' '2026-10-27' 0 2
```

Para conferir o formato que a UI manda, basta marcar "Últimos 30 dias" e aplicar:
`[{"page":1,"pageSize":0,"dateFrom":"2026-09-27","dateTo":"2026-10-27",…}]`.

### 5.3 Mapeamento campo → tabela

| Origem (API) | Destino | Regra |
|---|---|---|
| `date` | `data` | ISO com hora; cortar nos 10 primeiros |
| `points` | `quantidade` | já vem com sinal |
| `partner.name` | `descricao` / `origem` | tabela abaixo |
| `comments` | `descricao` | Shopping: pedido + item |
| `type.code` | — | `ER` acúmulo · `AN` resgate · `OI` campanha (0 ponto) |
| `qualifyPoints` | — | **nunca importar** (status) |

| Parceiro | `descricao` | `origem` |
|---|---|---|
| `Clube Azul` | `Clube Azul` | `assinatura` + `assinatura_id` |
| `Parceiro Banco Inter` | `Transferência Banco Inter` | `transferencia` |
| `Banco Inter Promocional` | `Bônus Banco Inter (promoção)` | `transferencia` |
| `Cartao Azul Itau` | `Cartão Azul Itaú` | `cartao` |
| `Compra de pontos Bonus` | `Compra de pontos (bônus)` | `compra` |
| `Compra de Pontos Voucher` | `Compra de pontos (voucher)` | `compra` |
| `Azul Viagens` | `Azul Viagens` | `parceiro` |
| `Shopping Azul Fidelidade` | `Shopping Azul · pedido N · item N` | NULL (débito) |
| `Azul` (resgate) | `Resgate de voo · Azul` | NULL (débito) |

As 16 linhas com `points = 0` ficam de fora: 5 aceites de campanha, 9 "acúmulo de voo"
(trechos voados, só status), 1 reprocesso e 1 "trechos e gastos".

### 5.4 Checksum 27/10/2026

| Item | Pontos |
|---|---:|
| Créditos (37 linhas) | +254.213 |
| Débitos (12 linhas) | −241.180 |
| **Saldo calculado** | **13.033** |
| **Saldo no site** | **13.033** |

O extrato começa em 14/10/2023. O número **3.783** que estava no app era antigo — o
site mostrava 13.033 na captura.

### 5.5 Validade

O extrato **não devolve validade por lançamento** (a aba "Pontos a vencer" voltou
`{"transactions":[],"totalPoints":0,"expirationEnabled":true}`). A regra é por
categoria: Azul 2 anos · **Topázio 3** · Safira 4 · Diamante 5 · Unique 10.

O titular é **Topázio**, então `data_expiracao` = data + **3 anos** em cada crédito.
É data derivada da regra publicada do programa, não informada pelo site.

### 5.6 Assinatura (Clube Azul)

| Plano | Valor | Pontos/mês | Início | Fim | Status |
|---|---|---:|---|---|---|
| Clube TudoAzul **1.000** (anual) | R$ 37,80 | 1.000 | 26/05/2025 | 13/05/2026 | cancelada |
| Clube TudoAzul **2.000** (anual) | R$ 74,00 | **3.400** | 14/05/2026 | — | ativa |

Cobranças da fatura: "TudoAzul1000" R$ 37,80/mês (12x de R$ 453,60) e, desde
14/05/2026, "TudoAzul2000" R$ 74,00/mês (12x de R$ 888,00). O plano 2.000 credita
**3.400 pontos/mês** no extrato — é esse número que vai em `milhas_mensais`.

Os 19 créditos "Clube Azul" ficam vinculados ao plano da época (13 no antigo, 6 no
atual), como no Clube Smiles (§3.6).

### 5.7 Armadilha do dedupe
Três pares de resgates de voo são idênticos (mesma data, mesmo valor, mesma
descrição): `-9.800` em 13/05/2025, `-14.400` e `-17.640` em 12/09/2025. O extrato não
traz bilhete nem rota, então não há como diferenciá-los — a chave
`data+quantidade+descricao` colapsaria cada par (mesma situação do All Accor, §4.7).

### 5.8 Voos realizados (aba em **Meus Voos**)

As operações com `type.name = "Acúmulo de voo"` trazem no `comments`:

```
Booking: IMKJRD | From Curitiba to Foz do Iguacu
```

e **0 ponto resgatável** (o trecho só rendeu status). São 9 trechos e 6 localizadores
(2023–2025), gravados em `voos_realizados` (migrations `0018`/`0019`).

`voos_realizados` é **separada de `voos`**: `voos` é o detalhe de um resgate com milhas;
`voos_realizados` é o trecho que o titular voou, pago ou não com pontos. Não há vínculo
obrigatório entre as duas.

| Data | Trecho | Localizador |
|---|---|---|
| 14/10/2023 | CWB → IGU | SWGWTX |
| 20/10/2023 | IGU → CWB | SWGWTX |
| 17/04/2025 | CWB → GIG | TMZL9T |
| 21/04/2025 | GIG → CWB | TMZL9T |
| 21/08/2025 | CWB → POA | FHSIQC |
| 21/08/2025 | POA → BRC | PLZW7G |
| 27/08/2025 | IGU → CWB | OW2BFA |
| 23/11/2025 | CWB → IGU | IMKJRD |
| 26/11/2025 | IGU → CWB | IMKJRD |

O extrato não traz número do voo, horário nem assento. A **volta de Bariloche**
(ida em 21/08 via POA) não aparece creditada.

**Valor pago: não existe na fonte.** O extrato só tem pontos (`points`,
`qualifyPoints`) e a área de reservas (`tudoazulreservation/api/booking/v2/updatebookings`)
responde `{"data":{}}` — o site não guarda mais essas reservas. Por decisão do usuário,
os trechos ficam sem coluna de dinheiro.

## 6. Livelo (implementado)

### 6.1 Telas e API

| O quê | URL |
|---|---|
| Extrato de pontos | `https://www.livelo.com.br/extrato` |
| Login | `https://acesso.livelo.com.br/auth/realms/LIV_PF/...` (Keycloak) |

O site é Next.js com micro-frontends (Module Federation: `liv-mfe-extract-resume`,
`liv-mfe-extract-transactions`). Os dados vêm de REST no host
`apis.pontoslivelo.com.br`:

```
GET /bff-liv-customer-account-site/v1/customers/me/balance?type=all&days=365
GET /bff-liv-customer-account-site/v1/customers/me/transactions?startDate=YYYY-MM-DD
GET /bff-subscription/v1/customers/me/subscriptions?type=club
headers: Authorization: Bearer <JWT RS256 do Keycloak>
```

**Não usa cookie**: o token vai no header (o cookie do Keycloak só serve para o site).
As três chamadas cabem numa captura só.

### 6.2 Captura

```powershell
cd "$env:TEMP\smiles-automation"
node capture.mjs 'livelo\.com\.br' 'C:\...\backups\livelo-capture.json' `
  --navigate 'https://www.livelo.com.br/extrato' --seconds 40
```

O extrato abre com `startDate` = hoje − 365 dias. Como a soma desse período já fecha com
o saldo, não é preciso ampliar o período.

### 6.3 Mapeamento campo → tabela

| Origem (API) | Destino | Regra |
|---|---|---|
| `date` (`dd/mm/yyyy`) | `data` | inverter para ISO |
| `points` (`"1.000"`, `"-100"`) | `quantidade` | **remover o ponto de milhar** e manter o sinal |
| `title` / `description` | `descricao` | ver tabela abaixo |
| `code` | — | `I` acúmulo · `L` bônus · `R` resgate |
| `config` | — | só cor/símbolo da tela |

| Título | Código | `descricao` | `tipo` / `origem` |
|---|---|---|---|
| `Clube Livelo` | `I` | `Clube Livelo` | `assinatura` + `assinatura_id` |
| `Clube Livelo` | `L` | `Clube Livelo (bônus)` | `credito` / `promocao` |
| `COFFEE MAIS` | `I` | `Coffee Mais` | `credito` / `parceiro` |
| `Smiles` | `R` (negativo) | `Smiles · pontos + dinheiro` | `debito` / NULL |

Aqui **não há linha com 0 ponto** para descartar: os 17 lançamentos entram.

### 6.4 Checksum 27/10/2026

| Item | Pontos |
|---|---:|
| Créditos (15 linhas) | +11.266 |
| Débitos (2 linhas) | −400 |
| **Saldo calculado** | **10.866** |
| **Saldo no site** (`pointsAmount`) | **10.866** |

O **3.700** do doc era antigo. O extrato começa em 24/04/2026 (adesão ao Clube).

### 6.5 Validade

O extrato **não manda validade por linha**, e `detailsPointsToExpire` veio
`{"amount":"0","closestExpirationDate":null,"details":[]}` (nada a expirar).

Aplicadas as regras já cadastradas no app: **parceiro 12 meses**, assinatura/promoção
**24 meses** (fallback de `programas.validade_meses`).

### 6.6 Assinatura (Clube Livelo)

| Campo | Valor |
|---|---|
| Plano | **Clube Classic** (`Clube_1000_anual`) |
| Valor | R$ 538,80/ano → **R$ 44,90/mês** (12x) |
| Pontos | 1.000/mês + bônus variável (250 ou 500) |
| Cobrança | dia **24** · próxima 24/04/2027 |
| Início | 24/04/2026 |

São 7 créditos de 1.000 (24/04 a 24/10/2026), todos vinculados à assinatura. Os bônus
ficam como crédito de promoção, sem vínculo — se virassem `tipo='assinatura'`, o
"Gerar créditos do mês" deixaria de gerar a mensalidade.

## 7. Esfera (implementado)

### 7.1 Telas e API

| O quê | URL |
|---|---|
| Extrato de pontos | `https://www.esfera.com.vc/meu-extrato` |
| Perfil | `https://www.esfera.com.vc/meu-perfil` |
| Login | `https://auth.esfera.com.vc/auth/realms/Esfera_Prod` (Keycloak, SAML) |

> Cuidado: **`esferabrasil.com.br` é um site de notícias**. O programa é do **Santander**
> e vive em `esfera.com.vc`.

O site é Next.js + Module Federation (`mfe-extract`, `mfe-store`, `mfe-cart`…). Os dados
vêm do gateway:

```
GET https://apigw.esfera.com.vc/bff-extract/ehis/customer/sum-transactions?period=MM/AAAA
GET https://apigw.esfera.com.vc/bff-extract/ehis/customer/expired-points?dateFrom=DD/MM/AAAA&dateTo=DD/MM/AAAA
GET https://apigw.esfera.com.vc/bff-extract/ehis/customer/sum-monthly-expiration-forecast?dateFrom=…&dateTo=…
POST https://apigw.esfera.com.vc/bff-profile/ehcs/inquire/balance
headers: authorization: Bearer <JWT RS256>, siteId: esfera, visitorId: <cookie visitorId>
```

Chamar a API **de dentro da página com header extra** (`X-OCStateData`) devolve
`403 MessageBlocked`; o request real **não** manda esse header. Usar o `authorization`
capturado e repetir do Node funciona (`siteid` + `visitorid` bastam).

### 7.2 Captura

```powershell
cd "$env:TEMP\smiles-automation"
node capture.mjs 'esfera\.com\.vc|apigw' 'C:\...\backups\esfera-capture.json' `
  --navigate 'https://www.esfera.com.vc/meu-extrato' --seconds 40
```

Depois, varrer os meses com o Bearer capturado (`backups/esfera-varredura.mjs`).

### 7.3 Mapeamento campo → tabela

| Origem (API) | Destino | Regra |
|---|---|---|
| `transactions[].date` | `data` | ISO com hora; cortar em 10 |
| `transactions[].total` | `quantidade` | pontos (positivo no crédito) |
| `occType = club` | `assinatura` + `assinatura_id` | "Clube Esfera" |
| `occType = redemption` | `transferencia_saida` (se for troca para programa) | quantidade negativa |
| `detail.basicRule.points` + `additionalRules[].points` | — | composição do crédito (1.000 + 167 de campanha) |

Linha com `total = 0` (ex.: "Esfera Produtos") é descartada.

### 7.4 Checksum e o ajuste

| Item | Pontos |
|---|---:|
| Créditos visíveis (5 meses de clube) | +5.835 |
| Transferência para o Accor (29/05) | −52.500 |
| **Soma visível** | **−46.665** |
| **Saldo no site** | **+5.310** |
| **Ajuste de saldo anterior** | **+51.975** |

A API devolve **só ~6 meses** (`period`), então o histórico anterior a 05/2026 não
existe mais na fonte. O `ajuste` de 30/04/2026 é reconciliação explícita — o runbook
(§0) admite isso só depois de esgotar a investigação, que foi o caso.

O saldo do site é **5.310** (todo no balde `CLUB`), não os 1.809 do doc antigo.

### 7.5 Cruzamento com o All Accor

A troca de **52.500 pontos Esfera em 29/05/2026** é a origem do crédito
`Earn Partner: ESFERA +15.000` (e do bônus `+1.500`) no extrato do All Accor, na mesma
data. Os dois ledgers contam a mesma transferência por lados opostos.

### 7.6 Validade

O extrato não informa validade por linha (`expirationDate: null`) e o site mostra
"a expirar 0 pts" e "expirados 0 pts". Foi aplicado `programas.validade_meses` = **24
meses** nos créditos do clube.

### 7.7 Assinatura (Clube Esfera)

| Campo | Valor |
|---|---|
| Plano | **Clube Esfera 1.000** (anual, pago à vista) |
| Valor | R$ 474,12/ano → **R$ 39,51/mês** |
| Pontos | 1.000/mês + 167 de campanha = **1.167** |
| Crédito | dia **29** |
| Início | 29/05/2026 · ativa |

Os 5 créditos estão vinculados à assinatura. Se a campanha de +167 acabar, o valor de
`milhas_mensais` precisa voltar para 1.000.

## 8. Cadastro mínimo (contas)

A movimentação precisa de `conta_id`. Contas existentes (Smiles):

```sql
select c.id as conta_id, p.nome as programa
  from public.contas c join public.programas p on p.id = c.programa_id;
```

`conta_id` do Smiles do Rafael: `52f93b89-5ffa-4a50-9d1c-9668734812d8`.

---

## 9. Gravação e deduplicação

Enquanto não existe coluna `external_id`, a regra é:

> **Chave de dedupe** = `conta_id + data + quantidade + tipo + descricao`

Antes de inserir, buscar o que já existe e filtrar:

```sql
select data, tipo, quantidade, descricao
  from public.movimentacoes
 where conta_id = '<conta>'
   and data >= '2026-01-01'
 order by data;
```

Para créditos de clube há uma regra extra: **um por mês por `assinatura_id`** —
se o mês já tem `tipo='assinatura'` com aquele `assinatura_id`, não inserir.

> **Armadilha:** gerar crédito pelo botão *antes* da sincronização cria a linha
> "Crédito mensal de assinatura"; depois a sincronização traria a linha real do
> extrato → duplicidade. Sincronize primeiro, gere depois.

Inserção em lote (PostgREST):

```js
const SB_URL = process.env.SUPABASE_URL;          // https://<ref>.supabase.co
const SB_KEY = process.env.SUPABASE_ANON_KEY;     // anon key do .env.local

await fetch(`${SB_URL}/rest/v1/movimentacoes`, {
  method: "POST",
  headers: {
    apikey: SB_KEY,
    authorization: `Bearer ${SB_KEY}`,
    "content-type": "application/json",
    prefer: "return=representation",
  },
  body: JSON.stringify(movs.map((m) => ({ ...m, conta_id: "<conta>" }))),
});
```

---

## 10. Verificação pós-gravação

```sql
-- 1) saldo por programa (deve bater com o site)
select p.nome, v.saldo, count(m.id) as movs
  from public.contas c
  join public.programas p on p.id = c.programa_id
  left join public.v_saldos_contas v on v.conta_id = c.id
  left join public.movimentacoes m on m.conta_id = c.id
 group by p.nome, v.saldo order by p.nome;

-- 2) totais por tipo (sanidade dos sinais)
select tipo, count(*), sum(quantidade)
  from public.movimentacoes group by tipo order by tipo;

-- 3) duplicatas suspeitas
select conta_id, data, tipo, quantidade, descricao, count(*)
  from public.movimentacoes
 group by 1,2,3,4,5 having count(*) > 1;
```

Depois abrir `http://localhost:3000` e conferir **Dashboard** (total), **Movimentações**
(linhas) e **Assinaturas** (plano, R$/milheiro).

---

## 11. Problemas conhecidos

| Sintoma | Causa | Solução |
|---|---|---|
| `406` + CORS em `validate-doc` no login | proxy do navegador embutido | usar o Chrome CDP (§1) |
| `ERR_TUNNEL_CONNECTION_FAILED` em `universal-login-green` | instável; costuma passar | recarregar a página |
| `401 Unauthorized` na `transaction-search` | usou o JWT do `localStorage` | capturar o bearer do header (§3.2) |
| `Failed to fetch` ao chamar a API de dentro da página | CORS | chamar do Node com o token capturado |
| Saldo do app > site | movimentos duplicados | checar query 3 do §10 |
| Saldo do app < site | crédito faltando no extrato | ampliar o período; se persistir, `ajuste` com descrição |
| `/portal/restrito/minha-conta` → "Erro: Não encontrado" | URL antiga | usar `/minha-conta/extrato` |

---

## 12. Próximos programas (checklist)

Para cada um: login → achar extrato → capturar XHR → mapear → checksum → gravar.

| Programa | Saldo no site (27/10/2026) | Status | Observação |
|---|---:|---|---|
| Smiles | 25.195 | ✅ sincronizado | API `transaction-search` |
| All Accor | 32.148 | ✅ sincronizado | API `contacts/me` (43 operações, 35 movimentos) |
| TudoAzul | 13.033 | ✅ sincronizado | Server Action `/perfil/br/pt/extract` (65 operações, 49 movimentos) |
| Livelo | 10.866 | ✅ sincronizado | API `bff-liv-customer-account-site` (17 movimentos) |
| Esfera | 5.310 | ✅ sincronizado | API `bff-extract` (7 movimentos + ajuste de saldo anterior) |

---

## 13. Backups

`/backups/` está no `.gitignore` (dados pessoais). Guardar antes de qualquer escrita
em massa:

```
backups/movimentacoes-backup-2026-10-27.csv      # 54 linhas pré-limpeza
backups/smiles-transacoes-api-2026-10-27.json    # retorno cru da API
backups/smiles-movimentacoes-mapeadas-2026-10-27.json
backups/accor-capture.json                       # XHR cru do ALL (contacts/me)
backups/accor-operations.json                    # só loyalty.operations.operation
backups/accor-movimentacoes-mapeadas.json        # 35 linhas propostas
backups/movimentacoes-backup-pre-accor-2026-10-27.json
backups/azul-capture.json                        # XHR cru do extrato (Server Action)
backups/azul-extracts.json                       # página 1 (+ p2/p3/p4)
backups/azul-operations.json                     # 65 operações mescladas
backups/azul-movimentacoes-mapeadas.json         # 49 linhas propostas
backups/movimentacoes-backup-pre-azul-2026-10-27.json
backups/livelo-capture.json                      # XHR cru (balance/transactions/subscriptions)
backups/livelo-transactions.json                 # 17 lançamentos
backups/livelo-movimentacoes-mapeadas.json       # 17 linhas propostas
backups/movimentacoes-backup-pre-livelo-2026-10-27.json
backups/esfera-capture.json                      # XHR cru do /meu-extrato
backups/esfera-meses.json                        # sum-transactions por mês
backups/esfera-movimentacoes-mapeadas.json       # 7 linhas (inclui o ajuste)
backups/movimentacoes-backup-pre-esfera-2026-10-27.json
```

---

## 14. Pendências / evoluções

- [ ] Coluna `external_id` em `movimentacoes` (migration) → dedupe por ID do site,
      sem depender de `data+quantidade+descricao`.
- [ ] Dedupe por **contagem** por chave (hoje "existe/não existe" perde multiplicidade:
      4 transferências idênticas de 01/07 no All Accor colapsariam em uma).
- [ ] **Validade rolante do saldo**: All Accor expira 12 meses após a última
      movimentação e não tem validade por lote. Hoje as linhas ficam com
      `data_expiracao` NULL e o programa desaparece de "Próximas expirações".
      Implementar regra por programa (ex.: `programas.validade_rolante_meses`) e
      calcular na query, em vez de gravar data por linha.
- [ ] Script único `sync-<programa>.mjs`: captura token → busca → mapeia → dedupe → grava → checksum.
- [ ] Empacotar como página **"Sincronizar"** no app (hoje é operação do agente).
- [x] Detalhe dos voos resgatados (destino/trecho/passageiro) - feito em 27/10/2026 via
      `member-flight-green.smiles.com.br/v1/flights/internal` (ver §3.7 e `docs/VOOS-SMILES.md`).
- [x] All Accor sincronizado em 27/10/2026 — 35 movimentos, saldo 32.148, assinatura R$ 76,00 (§4).
- [x] TudoAzul sincronizado em 27/10/2026 — 49 movimentos, saldo 13.033, Clube Azul R$ 74,00 (§5).
- [x] Livelo sincronizado em 27/10/2026 — 17 movimentos, saldo 10.866, Clube Classic R$ 44,90 (§6).
- [x] Esfera sincronizado em 27/10/2026 — 7 movimentos, saldo 5.310, Clube Esfera R$ 39,51/mês (§7).
- [ ] Coluna para número do bilhete / PNR (`Ticket Number` já vem na API do extrato).
