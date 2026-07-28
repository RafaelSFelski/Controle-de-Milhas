import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Variáveis de ambiente não configuradas");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  try {
    console.log("🌱 Iniciando seed do banco de dados...\n");



    // 1. Inserir Titulares
    console.log("📝 Inserindo titulares...");
    const { data: titulares, error: titError } = await supabase
      .from("titulares")
      .insert([
        {
          nome: "João Silva",
          cpf: "12345678901",
          email: "joao@example.com",
        },
        {
          nome: "Maria Santos",
          cpf: "98765432101",
          email: "maria@example.com",
        },
      ])
      .select();

    if (titError) throw titError;
    console.log(`✓ ${titulares.length} titular(es) criado(s)\n`);

    // 2. Inserir Programas
    console.log("🎫 Inserindo programas de milhas...");
    const randomSuffix = Math.random().toString(36).substring(7);
    const { data: programas, error: progError } = await supabase
      .from("programas")
      .insert([
        {
          nome: `LATAM Pass ${randomSuffix}`,
          categoria: "aerea",
          cor: "#ffc72c",
          validade_meses: 36,
          is_default: true,
          logo_url: null,
        },
        {
          nome: `Smiles ${randomSuffix}`,
          categoria: "aerea",
          cor: "#0066cc",
          validade_meses: 24,
          is_default: false,
          logo_url: null,
        },
        {
          nome: `Nubank Rewards ${randomSuffix}`,
          categoria: "cartao",
          cor: "#6c0cc4",
          validade_meses: 12,
          is_default: false,
          logo_url: null,
        },
        {
          nome: `Bradesco Recompensas ${randomSuffix}`,
          categoria: "bancario",
          cor: "#ffc72c",
          validade_meses: 60,
          is_default: false,
          logo_url: null,
        },
      ])
      .select();

    if (progError) throw progError;
    console.log(`✓ ${programas.length} programa(s) criado(s)\n`);

    // 3. Inserir Contas
    console.log("💳 Inserindo contas...");
    const { data: contas, error: contError } = await supabase
      .from("contas")
      .insert([
        {
          titular_id: titulares[0].id,
          programa_id: programas[0].id,
          numero_conta: "LATAM-001",
        },
        {
          titular_id: titulares[0].id,
          programa_id: programas[1].id,
          numero_conta: "SMILES-001",
        },
        {
          titular_id: titulares[0].id,
          programa_id: programas[2].id,
          numero_conta: "NUBANK-001",
        },
        {
          titular_id: titulares[1].id,
          programa_id: programas[0].id,
          numero_conta: "LATAM-002",
        },
        {
          titular_id: titulares[1].id,
          programa_id: programas[3].id,
          numero_conta: "BRADESCO-001",
        },
      ])
      .select();

    if (contError) throw contError;
    console.log(`✓ ${contas.length} conta(s) criada(s)\n`);

    // 4. Inserir Movimentações (milhas)
    console.log("📊 Inserindo movimentações...");
    const hoje = new Date();
    const proximoAno = new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate())
      .toISOString()
      .split("T")[0];

    const { data: movs, error: movError } = await supabase
      .from("movimentacoes")
      .insert([
        {
          conta_id: contas[0].id,
          tipo: "credito",
          quantidade: 50000,
          data: hoje.toISOString().split("T")[0],
          data_expiracao: proximoAno,
          descricao: "Bônus inicial",
        },
        {
          conta_id: contas[0].id,
          tipo: "debito",
          quantidade: -5000,
          data: hoje.toISOString().split("T")[0],
          data_expiracao: null,
          descricao: "Passagem aérea SP-RJ",
        },
        {
          conta_id: contas[1].id,
          tipo: "credito",
          quantidade: 35000,
          data: hoje.toISOString().split("T")[0],
          data_expiracao: new Date(hoje.getFullYear(), hoje.getMonth() + 3, hoje.getDate())
            .toISOString()
            .split("T")[0],
          descricao: "Compras no mês",
        },
        {
          conta_id: contas[2].id,
          tipo: "credito",
          quantidade: 15000,
          data: hoje.toISOString().split("T")[0],
          data_expiracao: new Date(hoje.getFullYear(), hoje.getMonth() + 2, hoje.getDate())
            .toISOString()
            .split("T")[0],
          descricao: "Cashback",
        },
        {
          conta_id: contas[3].id,
          tipo: "credito",
          quantidade: 80000,
          data: hoje.toISOString().split("T")[0],
          data_expiracao: proximoAno,
          descricao: "Bônus signup",
        },
        {
          conta_id: contas[4].id,
          tipo: "credito",
          quantidade: 25000,
          data: hoje.toISOString().split("T")[0],
          data_expiracao: null,
          descricao: "Compras automaticamente",
        },
      ])
      .select();

    if (movError) throw movError;
    console.log(`✓ ${movs.length} movimentação(ões) criada(s)\n`);

    // 5. Inserir Cotações
    console.log("💹 Inserindo cotações...");
    const { data: cotacoes, error: cotError } = await supabase
      .from("cotacoes")
      .insert([
        {
          programa_id: programas[0].id,
          valor_milheiro: 1.2,
          data: hoje.toISOString().split("T")[0],
        },
        {
          programa_id: programas[1].id,
          valor_milheiro: 1.15,
          data: hoje.toISOString().split("T")[0],
        },
        {
          programa_id: programas[2].id,
          valor_milheiro: 0.85,
          data: hoje.toISOString().split("T")[0],
        },
        {
          programa_id: programas[3].id,
          valor_milheiro: 0.95,
          data: hoje.toISOString().split("T")[0],
        },
      ])
      .select();

    if (cotError) throw cotError;
    console.log(`✓ ${cotacoes.length} cotação(ões) criada(s)\n`);

    // 6. Inserir Assinaturas
    console.log("🔄 Inserindo assinaturas...");
    const { data: assinaturas, error: assError } = await supabase
      .from("assinaturas")
      .insert([
        {
          conta_id: contas[0].id,
          nome_plano: "LATAM Pass Premium",
          valor_mensal: 19.9,
          dia_cobranca: 15,
          status: "ativa",
          milhas_mensais: 1000,
          data_inicio: hoje.toISOString().split("T")[0],
          bonus_percentual: 5,
          bonus_fixo: 100,
          bonus_adesao: 5000,
          bonus_adesao_creditado: true,
        },
        {
          conta_id: contas[3].id,
          nome_plano: "Smiles+",
          valor_mensal: 29.9,
          dia_cobranca: 10,
          status: "ativa",
          milhas_mensais: 1500,
          data_inicio: hoje.toISOString().split("T")[0],
          bonus_percentual: 10,
          bonus_fixo: 200,
          bonus_adesao: 7500,
          bonus_adesao_creditado: true,
        },
      ])
      .select();

    if (assError) throw assError;
    console.log(`✓ ${assinaturas.length} assinatura(s) criada(s)\n`);

    // 7. Inserir Metas
    console.log("🎯 Inserindo metas...");
    const { data: metas, error: metError } = await supabase
      .from("metas")
      .insert([
        {
          titular_id: titulares[0].id,
          descricao: "Acumular 100k milhas LATAM",
          quantidade_alvo: 100000,
          conta_id: null,
          data_alvo: new Date(hoje.getFullYear() + 1, 11, 31).toISOString().split("T")[0],
        },
        {
          titular_id: titulares[1].id,
          descricao: "Viajar 3x internacionalmente",
          quantidade_alvo: 300000,
          conta_id: null,
          data_alvo: new Date(hoje.getFullYear(), 11, 31).toISOString().split("T")[0],
        },
      ])
      .select();

    if (metError) throw metError;
    console.log(`✓ ${metas.length} meta(s) criada(s)\n`);

    console.log("✅ Seed concluído com sucesso!\n");
    console.log("📊 Resumo:");
    console.log(`  - Titulares: ${titulares.length}`);
    console.log(`  - Programas: ${programas.length}`);
    console.log(`  - Contas: ${contas.length}`);
    console.log(`  - Movimentações: ${movs.length}`);
    console.log(`  - Cotações: ${cotacoes.length}`);
    console.log(`  - Assinaturas: ${assinaturas.length}`);
    console.log(`  - Metas: ${metas.length}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro durante seed:", error.message);
    process.exit(1);
  }
}

seed();
