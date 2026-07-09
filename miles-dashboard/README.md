# Miles Dashboard

Dashboard pessoal para controle de milhas e transferências entre programas de fidelidade brasileiros.

Construído com **Next.js 16** + **TypeScript** + **Tailwind CSS** + **Supabase**.

## Funcionalidades

- **Titulares**: cadastro de pessoas (CPF, email).
- **Programas**: catálogo pré-cadastrado (Smiles, Latam Pass, TudoAzul, Livelo, Esfera, Iupp, Membership Rewards, Hilton, Marriott, etc.) + adição de programas customizados.
- **Contas**: vínculo titular × programa com saldo inicial.
- **Movimentações**: créditos, débitos, ajustes e expirações com cálculo automático de validade.
- **Transferências**: cálculo automático de bônus e taxa de conversão entre programas, geração atômica das movimentações via RPC SQL.
- **Assinaturas**: clubes de fidelidade com cálculo de R$/milheiro e geração mensal idempotente de créditos.
- **Cotações**: registro de R$/milheiro por programa e cálculo do valor estimado da carteira.
- **Metas**: por conta, titular ou globais, com barra de progresso e projeção em meses.
- **Alertas de expiração**: agregação por janela e lista das próximas expirações.
- **Relatórios**: gráfico de acúmulo vs gasto e exportação de transferências em CSV.
- **Tema claro/escuro** automático.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + componentes estilo shadcn/ui
- Supabase (PostgreSQL + RPC)
- TanStack Query para cache/mutations
- React Hook Form + Zod para forms
- Recharts para gráficos
- date-fns para manipulação de datas
- sonner para toasts
- next-themes para dark mode

## Setup

### 1. Crie um projeto Supabase

Vá em [app.supabase.com](https://app.supabase.com) e crie um projeto.

### 2. Aplique as migrations

No SQL Editor do Supabase, execute na ordem:

1. `supabase/migrations/0001_init.sql` — cria todas as tabelas, views e RPCs.
2. `supabase/migrations/0002_seed_programas.sql` — popula o catálogo de programas brasileiros.
3. `supabase/migrations/0003_assinaturas_bonus.sql` — colunas de bônus e RPCs de assinatura.
4. `supabase/migrations/0004_rpcs_faltantes.sql` — RPCs de crédito retroativo e compra de pontos.

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
npm install
npm run dev
```

Acesse http://localhost:3000.

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run start    # servir build
npm run lint     # ESLint
```

## Estrutura do projeto

```
miles-dashboard/
├── supabase/migrations/    # SQL: schema + seed
├── src/
│   ├── app/                # rotas (App Router)
│   ├── components/
│   │   ├── ui/             # primitivos shadcn-style
│   │   ├── layout/         # Sidebar, Header, ThemeToggle
│   │   ├── shared/         # PageHeader, EmptyState, ConfigWarning
│   │   ├── dashboard/      # Cards e gráficos
│   │   └── <feature>/      # uma pasta por feature (titulares, programas, ...)
│   ├── lib/
│   │   ├── supabase/       # cliente lazy
│   │   ├── queries/        # hooks TanStack Query
│   │   ├── calculations.ts # bônus, ROI, expirações, projeções
│   │   └── utils.ts        # cn(), formatters BR
│   └── types/database.ts   # tipos manuais do schema
└── README.md
```

## Modelo de dados

- `titulares` — pessoas físicas
- `programas` — catálogo (com cor, validade padrão e categoria)
- `contas` — vínculo `titular × programa`
- `movimentacoes` — créditos, débitos, ajustes, expirações, créditos de assinatura, transferências
- `transferencias` — registro consolidado da operação (com bônus, taxa, custo)
- `assinaturas` — clubes de fidelidade ativos
- `metas` — alvos por conta/titular/global
- `cotacoes` — R$ por milheiro com histórico
- `v_saldos_contas` (view) — saldo atual calculado dinamicamente
- `criar_transferencia(...)` (RPC) — cria transferência + 2 movimentações atomicamente
- `gerar_creditos_assinaturas_mes()` (RPC) — gera créditos das assinaturas ativas do mês (idempotente)

## Cálculos centrais

`src/lib/calculations.ts`:

- `calcularTransferencia(qtdOrigem, taxa, bonus%)` — quantidade no destino
- `custoPorMilha(R$/mês, milhas/mês)` — custo unitário
- `custoPorMilheiro(...)` — custo por 1.000 milhas (mais comum no mercado)
- `valorEstimadoCarteira(saldos, cotações)` — valor em R$
- `milhasExpirandoEmDias(movimentacoes, dias)` — soma na janela
- `projecaoMeta(saldoAtual, alvo, mediaMensal)` — meses restantes
- `calcularDataExpiracao(dataCredito, validadeMeses)` — data limite

## Próximos passos sugeridos

- Edge Function no Supabase para gerar créditos automaticamente todo dia 1.
- Importação CSV de extratos de programas.
- Login com Supabase Auth para uso multi-usuário.
- Cálculo de FIFO automático para débitos consumirem créditos mais antigos.
- Notificações push para milhas próximas de expirar.
