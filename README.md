# Miles Dashboard

Dashboard pessoal para controle de milhas e transferências entre programas de fidelidade brasileiros.

Construído com **Next.js 16** + **TypeScript** + **Tailwind CSS** + **Supabase**.

> Visão completa do produto, escopo, modelo de dados e roadmap: **[docs/VISAO-PRODUTO.md](docs/VISAO-PRODUTO.md)**
>
> Sincronização de extratos e assinaturas dos programas (runbook): **[docs/SINCRONIZACAO-PROGRAMAS.md](docs/SINCRONIZACAO-PROGRAMAS.md)**

## Setup

### 1. Crie um projeto Supabase

Vá em [app.supabase.com](https://app.supabase.com) e crie um projeto.

### 2. Aplique as migrations

**Opção A — Supabase CLI (recomendado para cloud):**

```bash
supabase login
export SUPABASE_PROJECT_REF=seu-project-ref   # Settings → General → Reference ID
./scripts/push-supabase-cloud.sh
```

**Opção B — SQL Editor (manual):**

No SQL Editor do Supabase, execute na ordem:

1. `supabase/migrations/0001_init.sql` — cria todas as tabelas, views e RPCs.
2. `supabase/migrations/0002_seed_programas.sql` — popula o catálogo de programas brasileiros.
3. `supabase/migrations/0003_assinaturas_bonus.sql` — colunas de bônus e RPCs de assinatura.
4. `supabase/migrations/0004_rpcs_faltantes.sql` — RPCs de crédito retroativo e compra de pontos.
5. `supabase/migrations/0005_programas_unidade.sql` — coluna `unidade` (milhas/pontos).
6. `supabase/migrations/0006_seed_all_accor.sql` — programa All Accor no catálogo.
7. `supabase/migrations/0007_regras_validade.sql` — validade por origem + RPCs atualizadas.
8. `supabase/migrations/0008_fifo_quantidade_restante.sql` — consumo FIFO de créditos + RPC de milhas a expirar.
9. `supabase/migrations/0010_movimentacoes_valor_pago.sql` — coluna `valor_pago` (taxas de resgate de voo).
10. `supabase/migrations/0011_voos.sql` — tabela `voos` (trechos, passageiros, localizador).
11. `supabase/migrations/0012_seed_voos_smiles.sql` — trechos Smiles de 2026 (idempotente).
12. `supabase/migrations/0013_voos_por_passageiro.sql` — uma linha por passageiro + rateio de milhas/R$.
13. `supabase/migrations/0014_seed_all_accor.sql` — extrato All Accor de 2026 (35 movimentos) + valor do plano.
14. `supabase/migrations/0015_hospedagens.sql` — tabela `hospedagens` (estadias).
15. `supabase/migrations/0016_seed_hospedagens_accor.sql` — estadias All Accor de 2026.
16. `supabase/migrations/0017_seed_azul.sql` — extrato TudoAzul + planos do Clube Azul.
17. `supabase/migrations/0018_voos_realizados.sql` — tabela `voos_realizados` (trechos voados).
18. `supabase/migrations/0019_seed_voos_realizados_azul.sql` — trechos Azul de 2023–2025.
19. `supabase/migrations/0020_seed_livelo.sql` — extrato Livelo + Clube Classic.
20. `supabase/migrations/0021_seed_esfera.sql` — extrato Esfera + Clube Esfera.
21. `supabase/migrations/0022_seed_smiles.sql` — extrato Smiles de 2026 + Clube Smiles + bilhetes.
22. `supabase/migrations/0023_movimentacoes_transferencia_index.sql` — índice da FK `transferencia_id`.

> Se o banco cloud **já tem** as migrations 0001–0004, aplique apenas **0005–0008**. Se já tem até 0007, aplique só **0008**. Se já tem até 0008, aplique **0010–0023**.
>
> Um `db reset` recria o **schema** e roda os seeds de cada programa. Os seeds dependem da conta do programa já existir (`numero_conta`), então em banco vazio eles são ignorados com `raise notice` — `titulares` e `contas` são dados do usuário e não estão em migration.
>
> `0011` desliga RLS na tabela `voos`: o Supabase liga RLS por padrão em tabelas novas e, sem isso, a anon key recebe `200` com lista vazia.

### 3. Configure variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Os valores estão em **Project Settings → API** no painel do Supabase.

> **Nota de segurança:** este projeto foi pensado para uso pessoal com banco compartilhado e RLS desligado. **Não publique em domínio público sem habilitar autenticação ou políticas RLS no Supabase.**

### 4. Instale dependências e rode

```bash
pnpm install
pnpm dev
```

Acesse http://localhost:3000.

## Cursor Cloud Agent

Se você usa **Cloud Agents** no Cursor, configure o script de instalação/atualização do
ambiente para rodar na **raiz do repositório** (não existe mais a pasta `miles-dashboard/`):

```bash
pnpm install --frozen-lockfile
```

Detalhes e gotchas do ambiente VM: **[AGENTS.md](AGENTS.md)**.

## Scripts

```bash
pnpm dev      # desenvolvimento
pnpm build    # build de produção
pnpm start    # servir build
pnpm lint     # ESLint
```
