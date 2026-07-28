import { z } from "zod";
import {
  dateString,
  nonNegativeNumber,
  optionalCpf,
  optionalEmail,
  optionalNonNegativeNumber,
  positiveNumber,
  requiredId,
  requiredText,
} from "./common";

export const titularSchema = z.object({
  nome: requiredText("Informe o nome"),
  cpf: optionalCpf,
  email: optionalEmail,
});
export type TitularFormValues = z.infer<typeof titularSchema>;

export const contaSchema = z.object({
  titular_id: requiredId("Selecione o titular"),
  programa_id: requiredId("Selecione o programa"),
  numero_conta: z.string().optional(),
  saldo_inicial: optionalNonNegativeNumber,
});
export type ContaFormValues = z.infer<typeof contaSchema>;

export const programaSchema = z.object({
  nome: requiredText("Informe o nome do programa"),
  categoria: z.enum(["aerea", "cartao", "bancario", "varejo", "hotel", "outro"]),
  unidade: z.enum(["milhas", "pontos"]),
  validade_meses: z.preprocess(
    (v) =>
      v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))
        ? undefined
        : v,
    z
      .number({ error: "Informe a validade" })
      .int("Use um número inteiro")
      .positive("Validade deve ser maior que zero")
      .optional()
  ),
  cor: z.string().optional(),
});
export type ProgramaFormValues = z.infer<typeof programaSchema>;

export const cotacaoSchema = z.object({
  programa_id: requiredId("Selecione o programa"),
  valor_milheiro: positiveNumber("Informe o valor do milheiro"),
  data: dateString,
  fonte: z.string().optional(),
});
export type CotacaoFormValues = z.infer<typeof cotacaoSchema>;

export const metaSchema = z
  .object({
    escopo: z.enum(["conta", "titular", "global"]),
    conta_id: z.string().optional(),
    titular_id: z.string().optional(),
    descricao: requiredText("Informe a descrição"),
    quantidade_alvo: positiveNumber("Informe o alvo em milhas"),
    data_alvo: dateString,
  })
  .superRefine((data, ctx) => {
    if (data.escopo === "conta" && !data.conta_id) {
      ctx.addIssue({
        code: "custom",
        path: ["conta_id"],
        message: "Selecione a conta",
      });
    }
    if (data.escopo === "titular" && !data.titular_id) {
      ctx.addIssue({
        code: "custom",
        path: ["titular_id"],
        message: "Selecione o titular",
      });
    }
  });
export type MetaFormValues = z.infer<typeof metaSchema>;

export const movimentacaoSchema = z.object({
  conta_id: requiredId("Selecione a conta"),
  tipo: z.enum(["credito", "debito", "ajuste", "expiracao"]),
  quantidade: positiveNumber("Informe a quantidade"),
  data: dateString,
  data_expiracao: z.string().optional(),
  origem: z
    .enum([
      "cartao",
      "compra",
      "transferencia",
      "assinatura",
      "promocao",
      "parceiro",
      "ajuste",
      "outro",
    ])
    .optional(),
  descricao: z.string().optional(),
  calcular_expiracao_auto: z.boolean().optional(),
});
export type MovimentacaoFormValues = z.infer<typeof movimentacaoSchema>;

export const transferenciaSchema = z
  .object({
    conta_origem_id: requiredId("Selecione a conta de origem"),
    conta_destino_id: requiredId("Selecione a conta de destino"),
    quantidade_origem: positiveNumber("Informe a quantidade"),
    taxa_conversao: positiveNumber("Informe a taxa de conversão"),
    bonus_percentual: nonNegativeNumber(),
    custo_reais: nonNegativeNumber(),
    data: dateString,
    observacao: z.string().optional(),
    comprar_pontos: z.boolean(),
    pontos_comprados: nonNegativeNumber(),
    valor_total_compra: nonNegativeNumber(),
  })
  .superRefine((data, ctx) => {
    if (data.conta_origem_id === data.conta_destino_id) {
      ctx.addIssue({
        code: "custom",
        path: ["conta_destino_id"],
        message: "Origem e destino devem ser diferentes",
      });
    }
    if (data.comprar_pontos && data.pontos_comprados <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["pontos_comprados"],
        message: "Informe quantos pontos serão comprados",
      });
    }
  });
export type TransferenciaFormValues = z.infer<typeof transferenciaSchema>;

export const assinaturaSchema = z.object({
  conta_id: requiredId("Selecione a conta"),
  nome_plano: requiredText("Informe o nome do plano"),
  valor_mensal: nonNegativeNumber("Informe o valor mensal"),
  dia_cobranca: z.preprocess(
    (v) =>
      v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))
        ? undefined
        : v,
    z
      .number({ error: "Informe o dia de cobrança" })
      .int("Use um dia inteiro")
      .min(1, "Dia entre 1 e 31")
      .max(31, "Dia entre 1 e 31")
  ),
  milhas_mensais: positiveNumber("Informe as milhas mensais"),
  data_inicio: dateString,
  bonus_percentual: nonNegativeNumber(),
  bonus_fixo: nonNegativeNumber(),
  bonus_adesao: nonNegativeNumber(),
  aplicar_bonus_adesao: z.boolean().optional(),
});
export type AssinaturaFormValues = z.infer<typeof assinaturaSchema>;

/** Edição não exige conta (já vinculada). */
export const assinaturaEditSchema = assinaturaSchema.omit({
  conta_id: true,
  aplicar_bonus_adesao: true,
});
export type AssinaturaEditFormValues = z.infer<typeof assinaturaEditSchema>;

export const assinaturaUpgradeSchema = assinaturaSchema;
export type AssinaturaUpgradeFormValues = z.infer<typeof assinaturaUpgradeSchema>;
