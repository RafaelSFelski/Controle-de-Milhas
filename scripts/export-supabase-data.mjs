#!/usr/bin/env node
// Exporta tabelas do Supabase atual via REST (anon key) para JSON.
// Uso: node scripts/export-supabase-data.mjs <SUPABASE_URL> <ANON_KEY> <OUT_DIR>

const [url, apiKey, outDir] = process.argv.slice(2);
if (!url || !apiKey || !outDir) {
  console.error('Uso: node scripts/export-supabase-data.mjs <SUPABASE_URL> <ANON_KEY> <OUT_DIR>');
  process.exit(1);
}

const TABLES = [
  'titulares',
  'programas',
  'programas_regras_validade',
  'contas',
  'transferencias',
  'assinaturas',
  'movimentacoes',
  'metas',
  'cotacoes',
];

const { createClient } = await import('@supabase/supabase-js');
const fs = await import('node:fs/promises');

const supabase = createClient(url, apiKey, { auth: { persistSession: false } });

for (const table of TABLES) {
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact' })
    .limit(100000);
  if (error) {
    console.log(`ERR ${table}: ${error.message}`);
    continue;
  }
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    `${outDir}/${table}.json`,
    JSON.stringify(data, null, 2),
    'utf8'
  );
  console.log(`OK  ${table}: ${count ?? data.length} linhas`);
}
