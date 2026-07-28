# Miles Dashboard

Dashboard pessoal para controle de milhas e transferências entre programas de fidelidade brasileiros.

Construído com **Next.js 16** + **TypeScript** + **Tailwind CSS** + **Supabase**.

> Visão completa do produto, escopo, modelo de dados e roadmap: **[docs/VISAO-PRODUTO.md](docs/VISAO-PRODUTO.md)**

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

> Se o banco cloud **já tem** as migrations 0001–0004, aplique apenas **0005, 0006 e 0007**.

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

## Scripts

```bash
pnpm dev      # desenvolvimento
pnpm build    # build de produção
pnpm start    # servir build
pnpm lint     # ESLint
```
