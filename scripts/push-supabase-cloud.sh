#!/usr/bin/env bash
# Aplica migrations pendentes no Supabase Cloud via CLI.
#
# Pré-requisitos:
#   1. supabase login   (ou export SUPABASE_ACCESS_TOKEN=...)
#   2. export SUPABASE_PROJECT_REF=seu-project-ref
#
# Uso:
#   ./scripts/push-supabase-cloud.sh
#
# Alternativa manual (SQL Editor no dashboard):
#   Execute na ordem: 0005 → 0006 → 0007 em supabase/migrations/

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"

if [[ -z "$PROJECT_REF" ]]; then
  echo "Erro: defina SUPABASE_PROJECT_REF (ex.: qwosyetmimomdlztihrw)"
  echo "Encontre em: Supabase Dashboard → Project Settings → General → Reference ID"
  exit 1
fi

echo "→ Linkando projeto $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

echo "→ Enviando migrations para o cloud..."
supabase db push

echo "✓ Migrations aplicadas. Verifique em:"
echo "  https://supabase.com/dashboard/project/$PROJECT_REF/database/migrations"
