# Visão do Produto — Miles Dashboard

Documento unificado de visão, escopo e arquitetura do **Miles Dashboard**. Consolida o plano original de produto com a documentação operacional do repositório.

## Visão Geral

Aplicação web para controle pessoal de milhas e pontos em programas de fidelidade brasileiros, com gestão de transferências entre programas (incluindo bônus), assinaturas de fidelidade, alertas de expiração, metas, cotação e estatísticas.

O uso previsto é **pessoal**: banco compartilhado no Supabase, sem autenticação multi-usuário no setup atual.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilização | Tailwind CSS v4 + componentes estilo shadcn/ui |
| Backend/DB | Supabase (PostgreSQL + PostgREST + RPCs) |
| Cliente Supabase | `@supabase/supabase-js` |
| Estado/cache | TanStack Query (React Query) |
| Tabelas | TanStack Table |
| Gráficos | Recharts |
| Forms/validação | React Hook Form + Zod |
| Ícones | lucide-react |
| Datas | date-fns |
| Feedback | sonner (toasts) |
| Tema | next-themes (claro/escuro) |
| Gerenciador de pacotes | pnpm |

## Estrutura do Projeto

```
miles-dashboard/
├── supabase/
│   ├── migrations/              # SQL: schema, seed e RPCs
│   └── config.toml
├── docs/
│   └── VISAO-PRODUTO.md           # este documento
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Layout raiz + sidebar
│   │   ├── page.tsx               # Dashboard (home)
│   │   ├── titulares/page.tsx
│   │   ├── programas/page.tsx
│   │   ├── contas/page.tsx
│   │   ├── movimentacoes/page.tsx
│   │   ├── transferencias/page.tsx
│   │   ├── assinaturas/page.tsx
│   │   ├── metas/page.tsx
│   │   ├── cotacoes/page.tsx
│   │   ├── relatorios/page.tsx
│   │   └── importar/page.tsx
│   ├── components/
│   │   ├── ui/                    # primitivos shadcn-style
│   │   ├── layout/                # Sidebar, Header, ThemeToggle
│   │   ├── shared/                # PageHeader, EmptyState, ConfigWarning
│   │   ├── dashboard/             # Cards e gráficos
│   │   └── <feature>/             # uma pasta por feature
│   ├── lib/
│   │   ├── supabase/              # cliente lazy
│   │   ├── queries/               # hooks TanStack Query
│   │   ├── calculations.ts        # bônus, ROI, expirações, projeções
│   │   └── utils.ts               # cn(), formatters BR
│   └── types/database.ts          # tipos manuais do schema
├── .env.local                     # SUPABASE_URL e ANON_KEY (gitignored)
├── README.md                      # setup e comandos
└── package.json
```

## Modelo de Dados (Supabase / PostgreSQL)

### `titulares`

- `id` uuid PK
- `nome` text
- `cpf` text (opcional)
- `email` text (opcional)
- `created_at` timestamptz

### `programas` (catálogo: pré-cadastrados + customizados)

- `id` uuid PK
- `nome` text (ex.: Smiles, Latam Pass)
- `categoria` text (`aerea` | `cartao` | `bancario` | `varejo` | `hotel` | `outro`)
- `cor` text (hex para UI)
- `logo_url` text (opcional)
- `validade_meses` int (validade padrão das milhas)
- `is_default` boolean (pré-cadastrado)
- `created_at` timestamptz

**Seed inicial:** Smiles, Latam Pass, TudoAzul, Livelo, Esfera, Iupp, LifeMiles, Membership Rewards (Amex), Pontos Itaú, Atacadão Pontos, Hilton Honors, Marriott Bonvoy.

### `contas` (instância de programa para um titular)

- `id` uuid PK
- `titular_id` uuid FK → titulares
- `programa_id` uuid FK → programas
- `numero_conta` text (opcional)
- `created_at` timestamptz
- UNIQUE(`titular_id`, `programa_id`)

O saldo **não** é coluna fixa — é calculado dinamicamente via `SUM(movimentacoes.quantidade)` (view `v_saldos_contas`).

### `movimentacoes` (todo crédito/débito gera linha)

- `id` uuid PK
- `conta_id` uuid FK → contas
- `tipo` text (`credito` | `debito` | `transferencia_saida` | `transferencia_entrada` | `expiracao` | `assinatura` | `ajuste`)
- `quantidade` numeric (positivo = crédito, negativo = débito)
- `data` date
- `data_expiracao` date (NULL se não expira)
- `descricao` text
- `transferencia_id` uuid FK → transferencias (nullable)
- `assinatura_id` uuid FK → assinaturas (nullable)
- `created_at` timestamptz

### `transferencias`

- `id` uuid PK
- `conta_origem_id` uuid FK → contas
- `conta_destino_id` uuid FK → contas
- `quantidade_origem` numeric
- `quantidade_destino` numeric (após bônus/conversão)
- `bonus_percentual` numeric (ex.: 100 = 100%)
- `taxa_conversao` numeric (ex.: 1.0 = 1:1)
- `custo_reais` numeric (taxas em R$, opcional)
- `data` date
- `observacao` text
- `created_at` timestamptz

### `assinaturas` (clubes de fidelidade)

- `id` uuid PK
- `conta_id` uuid FK → contas
- `nome_plano` text (ex.: Smiles Clube 5000)
- `valor_mensal` numeric
- `dia_cobranca` int (1–31)
- `milhas_mensais` numeric (creditadas todo mês)
- `data_inicio` date
- `data_fim` date (nullable; ativa enquanto NULL)
- `status` text (`ativa` | `pausada` | `cancelada`)
- `created_at` timestamptz

### `metas`

- `id` uuid PK
- `conta_id` uuid FK → contas (nullable se meta global)
- `titular_id` uuid FK → titulares (nullable)
- `descricao` text
- `quantidade_alvo` numeric
- `data_alvo` date
- `concluida` boolean
- `created_at` timestamptz

### `cotacoes` (histórico de R$/milha por programa)

- `id` uuid PK
- `programa_id` uuid FK → programas
- `valor_milheiro` numeric (R$ por 1.000 milhas)
- `data` date
- `fonte` text (opcional)

### Views e RPCs

- **`v_saldos_contas`** — saldo atual calculado dinamicamente por conta
- **`criar_transferencia(...)`** — cria transferência + 2 movimentações atomicamente
- **`gerar_creditos_assinaturas_mes()`** — gera créditos das assinaturas ativas do mês (idempotente)

Migrations em `supabase/migrations/`:

1. `0001_init.sql` — tabelas, views e RPCs base
2. `0002_seed_programas.sql` — catálogo de programas brasileiros
3. `0003_assinaturas_bonus.sql` — colunas de bônus e RPCs de assinatura
4. `0004_rpcs_faltantes.sql` — RPCs de crédito retroativo e compra de pontos

## Funcionalidades

### 1. Dashboard (Home)

- Cards de resumo: total de milhas consolidado, valor estimado em R$, milhas a expirar nos próximos 90 dias, transferências do mês
- Gráfico de pizza: distribuição de milhas por programa
- Gráfico de linha: evolução de saldo total nos últimos 12 meses
- Lista das próximas expirações
- Lista de assinaturas ativas com próxima cobrança

### 2. Titulares

- CRUD simples (nome, CPF, email)
- Filtro do dashboard por titular

### 3. Programas e Contas

- Lista de programas (pré-cadastrados + customizados)
- Adicionar programa customizado
- Vincular titular ao programa (criar `conta`) e definir saldo inicial (gera movimentação de ajuste)

### 4. Movimentações

- Créditos, débitos, ajustes e expirações
- Cálculo automático de validade com base em `validade_meses` do programa

### 5. Transferências

- Formulário: conta origem, conta destino, quantidade origem, % bônus, taxa de conversão (default 1:1), custo em R$
- Cálculo automático: `quantidade_destino = quantidade_origem × taxa_conversao × (1 + bonus/100)`
- Ao salvar: gera 2 movimentações (saída e entrada) + linha em `transferencias` via RPC
- Histórico com filtros (programa, período, titular)

### 6. Assinaturas

- CRUD de planos de fidelidade
- Cálculo de ROI: custo por milha = `valor_mensal / milhas_mensais`
- Botão "Gerar créditos do mês" — cria movimentações para assinaturas ativas no dia de cobrança (idempotente)
- Próximas cobranças no dashboard

### 7. Alertas de Expiração

- Movimentações de crédito carregam `data_expiracao` (calculada via `validade_meses` do programa, configurável por movimentação)
- Agregação por janela de expiração (30/60/90/180 dias)
- Badge visual no dashboard

### 8. Cotações (R$/milha)

- Cadastro manual de cotação atual por programa
- Histórico de cotações com gráfico
- Valor estimado da carteira = soma de `saldo × cotacao_atual` por programa

### 9. Metas

- Meta por conta, titular ou global
- Barra de progresso (saldo atual / quantidade_alvo)
- Projeção com base na média de acúmulo dos últimos 3 meses

### 10. Relatórios

- Gráfico de barras: acúmulo vs gasto por mês
- Gráfico de linha: evolução por programa
- Tabela de transferências com totais
- Export CSV

### 11. Importação

- Página dedicada para importação de dados (extratos/planilhas)

## Cálculos Centrais

Implementados em `src/lib/calculations.ts`:

| Função | Descrição |
|--------|-----------|
| `calcularTransferencia(qtdOrigem, taxa, bonus%)` | Quantidade no destino após conversão e bônus |
| `custoPorMilha(R$/mês, milhas/mês)` | Custo unitário por milha |
| `custoPorMilheiro(...)` | Custo por 1.000 milhas (padrão de mercado) |
| `valorEstimadoCarteira(saldos, cotações)` | Valor total estimado em R$ |
| `milhasExpirandoEmDias(movimentacoes, dias)` | Soma na janela de expiração |
| `projecaoMeta(saldoAtual, alvo, mediaMensal)` | Meses restantes para atingir meta |
| `calcularDataExpiracao(dataCredito, validadeMeses)` | Data limite do crédito |

## Pontos de Atenção

- **Sem autenticação:** o banco é compartilhado e o uso é pessoal. Não publique em domínio público sem habilitar autenticação ou políticas RLS no Supabase.
- **Saldo da conta:** cálculo dinâmico via `SUM(movimentacoes.quantidade)` agrupado por `conta_id` (view `v_saldos_contas`). Não há coluna `saldo_atual` em `contas`.
- **Expirações:** cada crédito pode ter sua própria `data_expiracao`. Débitos devem consumir créditos pelo método FIFO (consumo automático ainda pendente).
- **Créditos de assinatura:** geração mensal via botão manual ou RPC; cron automático (Edge Function) é evolução futura.
- **Supabase local:** `supabase/config.toml` exige `auto_expose_new_tables = true` para o role `anon` acessar tabelas públicas (RLS desligado intencionalmente).

## Status de Implementação

| Área | Status |
|------|--------|
| Setup Next.js + Supabase + migrations | Concluído |
| CRUD titulares, programas, contas | Concluído |
| Movimentações e transferências (RPC atômica) | Concluído |
| Assinaturas + créditos mensais idempotentes | Concluído |
| Dashboard, gráficos, cotações, metas | Concluído |
| Alertas de expiração e relatórios (CSV) | Concluído |
| Tema claro/escuro, toasts, estados empty/loading | Concluído |
| Importação de extratos | Parcial (página existe) |
| FIFO automático para débitos | Pendente |
| Auth multi-usuário | Pendente |
| Cron automático de créditos de assinatura | Pendente |
| Notificações push de expiração | Pendente |

## Roadmap (Próximos Passos)

1. Edge Function no Supabase para gerar créditos automaticamente todo dia 1
2. Importação CSV completa de extratos de programas
3. Login com Supabase Auth para uso multi-usuário
4. Cálculo FIFO automático para débitos consumirem créditos mais antigos
5. Notificações push para milhas próximas de expirar

## Entregáveis do Produto

- Repositório Next.js funcional rodando localmente
- Migrations SQL para subir schema no Supabase
- Seed de programas brasileiros
- Dashboard navegável com as funcionalidades descritas acima
- Documentação de setup em [README.md](../README.md)
