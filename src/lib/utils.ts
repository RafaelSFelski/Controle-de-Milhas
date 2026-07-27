import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Formata data em pt-BR.
 * Strings só-data (`YYYY-MM-DD`) são tratadas como calendário local — evita
 * `new Date("YYYY-MM-DD")` (UTC midnight), que no fuso BR vira o dia anterior
 * e causa mismatch de hidratação SSR vs client.
 */
export function formatDate(value: string | Date): string {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]}`;
    }
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
      new Date(value)
    );
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(value);
}

/** Converte `YYYY-MM-DD` em Date local (sem deslocamento UTC). */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}

/** Serializa Date local para `YYYY-MM-DD`. */
export function toDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
