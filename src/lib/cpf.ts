/** Remove tudo que não for dígito, limitando a 11 caracteres. */
export function stripCpfDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Formata CPF como 000.000.000-00 (parcial permitido durante a digitação). */
export function formatCpf(value: string): string {
  const digits = stripCpfDigits(value);
  if (!digits) return "";

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Normaliza para o formato completo ou null se vazio. */
export function normalizeCpf(value: string | null | undefined): string | null {
  const digits = stripCpfDigits(value ?? "");
  if (!digits) return null;
  return formatCpf(digits);
}

export function isCompleteCpf(value: string): boolean {
  return stripCpfDigits(value).length === 11;
}
