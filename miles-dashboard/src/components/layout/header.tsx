"use client";

import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

export function Header({ title }: { title?: string }) {
  return (
    <header className="h-14 border-b bg-card/50 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <MobileNav />
        {title && <h1 className="text-lg font-semibold">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
