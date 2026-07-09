import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'fs';

// IDs do banco
const TITULAR_ID = '1b423f61-d26a-44f6-a9cf-34564c431641'; // Rafael

const PROGRAMAS = {
  'Azul Fidelidade': 'a0705232-1088-4a08-925d-7c5398a2de52',
  'GOL Smiles':      'b0bb3d55-5b1c-4901-969d-ed8f3c85d5c7',
  'Livelo':          '5c77d1be-50bd-4a76-9343-72113a3b55bd',
  'Esfera':          '574cddc1-ba19-42df-a046-a4ab712db448',
  'All Accor':       'd335753c-4ac6-4549-8fa1-fb07e82829df',
};

const CONTAS_EXISTENTES = {
  'a0705232-1088-4a08-925d-7c5398a2de52': '96127c1c-36c6-48d6-90a9-d85e6ba25287', // Azul
  'b0bb3d55-5b1c-4901-969d-ed8f3c85d5c7': 'de06ec1f-96c8-420f-83b5-1843f2fdc68b', // GOL Smiles
  '5c77d1be-50bd-4a76-9343-72113a3b55bd': '777248d6-beee-4826-8ef0-5a5c63c670e0', // Livelo
  '574cddc1-ba19-42df-a046-a4ab712db448': 'ffa9df98-adbf-4302-abb1-7a4c9974a0c7', // Esfera
  'd335753c-4ac6-4549-8fa1-fb07e82829df': '09cd660c-4edf-43d2-9740-7785971556ec', // All Accor
};

// Validade em meses por programa
const VALIDADE = {
  'Azul Fidelidade': 24,
  'GOL Smiles':      24,
  'Livelo':          24,
  'Esfera':          24,
  'All Accor':       24,
};

function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(str.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function parseQtd(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function parseDateBR(str) {
  // DD/MM/YYYY -> YYYY-MM-DD
  if (!str) return null;
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const year = y.length === 2 ? '20' + y : y;
  return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Tipos válidos: 'credito','debito','transferencia_saida','transferencia_entrada','expiracao','assinatura','ajuste'
function mapTipo(tipo) {
  const t = tipo.toLowerCase().trim();
  if (t === 'assinatura') return 'assinatura';
  if (t.includes('bonus') || t.includes('bônus') || t.includes('reativação') || t.includes('reativacao') || t.includes('compra')) return 'credito';
  if (t === 'transferencia' || t === 'transferência') return 'transferencia_entrada';
  if (t.includes('resgate')) return 'debito';
  return 'credito';
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const contasPorPrograma = { ...CONTAS_EXISTENTES };

  // Ler CSV
  const csv = readFileSync('/tmp/milhas.csv', 'utf-8');
  const lines = csv.split('\n').filter(l => l.trim());
  // Header: Programa de fidelidade,Tipo,Valor Pago,Quantidade,Data
  const rows = lines.slice(1);

  let ok = 0, skip = 0, erros = [];

  for (const line of rows) {
    // Parse respeitando campos entre aspas
    const parts = [];
    let inQuotes = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur.trim());

    const [programaNome, tipoRaw, valorStr, qtdStr, dataStr] = parts;
    if (!programaNome || !tipoRaw || !dataStr) { skip++; continue; }

    const programaId = PROGRAMAS[programaNome.trim()];
    if (!programaId) { console.warn(`Programa desconhecido: "${programaNome}"`); skip++; continue; }

    const contaId = contasPorPrograma[programaId];
    if (!contaId) { console.warn(`Sem conta para programa: "${programaNome}"`); skip++; continue; }

    const tipo = mapTipo(tipoRaw);
    const valor = parseBRL(valorStr);
    let qtd = parseQtd(qtdStr);
    const data = parseDateBR(dataStr);
    if (!data) { console.warn(`Data inválida: "${dataStr}"`); skip++; continue; }

    // Débitos (resgates) são negativos
    if (tipo === 'debito') qtd = -Math.abs(qtd);
    else qtd = Math.abs(qtd);

    const validade = VALIDADE[programaNome.trim()] ?? 24;
    const dataExpiracao = new Date(data);
    dataExpiracao.setMonth(dataExpiracao.getMonth() + validade);
    const dataExpiracaoStr = dataExpiracao.toISOString().slice(0, 10);

    const { error } = await sb.from('movimentacoes').insert({
      conta_id: contaId,
      tipo,
      quantidade: qtd,
      data,
      data_expiracao: tipo === 'debito' ? null : dataExpiracaoStr,
      descricao: tipoRaw.trim(),
    });

    if (error) {
      erros.push(`Linha "${programaNome} / ${tipoRaw} / ${data}": ${error.message}`);
    } else {
      ok++;
      console.log(`OK: ${programaNome} | ${tipoRaw} | ${qtd} | ${data}`);
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log(`Importadas: ${ok}`);
  console.log(`Puladas:    ${skip}`);
  console.log(`Erros:      ${erros.length}`);
  if (erros.length) erros.forEach(e => console.error(' -', e));
}

main().catch(console.error);
