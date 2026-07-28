import { z } from "zod";
import { isCompleteCpf } from "@/lib/cpf";

/** Normaliza vazio/NaN de inputs HTML + valueAsNumber do RHF. */
export function emptyToUndef(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isNaN(value)) return undefined;
  return value;
}

export const requiredText = (message = "Campo obrigatório") =>
  z.string().trim().min(1, message);

export const requiredId = (message = "Selecione uma opção") =>
  z.string().min(1, message);

export const dateString = z.string().min(1, "Informe a data");

export const optionalEmail = z
  .union([z.literal(""), z.email("Email inválido")])
  .optional();

export const optionalCpf = z
  .string()
  .optional()
  .refine(
    (value) => !value?.trim() || isCompleteCpf(value),
    "Informe um CPF completo (000.000.000-00)"
  );

export const requiredNumber = (message = "Informe um número") =>
  z.preprocess(emptyToUndef, z.number({ error: message }));

export const positiveNumber = (message = "Deve ser maior que zero") =>
  z.preprocess(
    emptyToUndef,
    z.number({ error: "Informe um número" }).positive(message)
  );

export const nonNegativeNumber = (message = "Não pode ser negativo") =>
  z.preprocess(
    emptyToUndef,
    z.number({ error: "Informe um número" }).min(0, message)
  );

export const optionalNonNegativeNumber = z.preprocess(
  emptyToUndef,
  z.number({ error: "Informe um número" }).min(0, "Não pode ser negativo").optional()
);
