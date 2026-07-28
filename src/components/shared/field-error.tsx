"use client";

import type { FieldError as RHFFieldError } from "react-hook-form";

export function FieldError({
  error,
}: {
  error?: RHFFieldError | string;
}) {
  const message = typeof error === "string" ? error : error?.message;
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}
