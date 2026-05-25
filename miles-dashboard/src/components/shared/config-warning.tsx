"use client";

import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";

export function ConfigWarning() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 mb-4 flex items-start gap-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Supabase não configurado
        </p>
        <p className="text-amber-800 dark:text-amber-300 mt-1">
          Crie um arquivo <code>.env.local</code> com{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para conectar ao banco. Veja{" "}
          <code>.env.local.example</code> e <code>supabase/migrations/</code>.
        </p>
      </div>
    </div>
  );
}
