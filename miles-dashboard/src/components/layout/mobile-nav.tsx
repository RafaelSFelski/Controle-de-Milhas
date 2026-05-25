"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Plane, X } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Activity,
  ArrowLeftRight,
  Repeat,
  Target,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/titulares", label: "Titulares", icon: Users },
  { href: "/programas", label: "Programas", icon: Plane },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/movimentacoes", label: "Movimentações", icon: Activity },
  { href: "/transferencias", label: "Transferências", icon: ArrowLeftRight },
  { href: "/assinaturas", label: "Assinaturas", icon: Repeat },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/cotacoes", label: "Cotações", icon: TrendingUp },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        className="md:hidden p-2 rounded-md hover:bg-accent"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold flex items-center gap-2">
                <Plane className="h-5 w-5 text-sky-500" /> Miles
              </span>
              <button onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      active
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
