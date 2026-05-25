"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Plane,
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

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r bg-card hidden md:flex flex-col">
      <div className="h-14 flex items-center px-4 border-b">
        <Link href="/" className="font-semibold text-lg flex items-center gap-2">
          <Plane className="h-5 w-5 text-sky-500" />
          Miles Dashboard
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t text-xs text-muted-foreground">
        Uso pessoal · v0.1
      </div>
    </aside>
  );
}
