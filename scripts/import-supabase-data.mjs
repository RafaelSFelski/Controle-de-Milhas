#!/usr/bin/env node
// Importa JSONs exportados pelo export-supabase-data.mjs para o Supabase destino.
// Uso: node scripts/import-supabase-data.mjs <SUPABASE_URL> <ANON_KEY> <IN_DIR>
// Usa upsert on_conflict=id — re-rodar não duplica dados.

const [url, apiKey, inDir] = process.argv.slice(2);
if (!url || !apiKey || !inDir) {
  console.error('Uso: node scripts/import-supabase-data.mjs <SUPABASE_URL> <ANON_KEY> <IN_DIR>');
  process.exit(1);
}

// Ordem respeita FKs (dependências primeiro).
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
  const rows = JSON.parse(await fs.readFile(`${inDir}/${table}.json`, 'utf8'));
  if (!rows.length) {
    console.log(`OK  ${table}: nenhum dado para importar`);
    continue;
  }
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'id', count: 'exact' });
  if (error) {
    console.log(`ERR ${table}: ${error.message} ${error.details ?? ''}`);
    continue;
  }
  console.log(`OK  ${table}: ${rows.length} linhas enviadas (upsert)`);
}
