"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "D" },
  { href: "/depenses", label: "Depenses", icon: "-" },
  { href: "/revenus", label: "Revenus", icon: "+" },
  { href: "/caisse", label: "Caisse", icon: "CA" },
  { href: "/besoins", label: "Besoins", icon: "BE" },
  { href: "/frigo", label: "Mon Frigo", icon: "FR" },
  { href: "/comparateur", label: "Comparateur", icon: "CP" },
  { href: "/recettes", label: "Recettes", icon: "RE" },
  { href: "/integrations/marjane", label: "Marjane Connect", icon: "MJ" },
  { href: "/scan", label: "Scan facture", icon: "SC" },
  { href: "/factures", label: "Factures", icon: "F" },
  { href: "/patrimoine", label: "Patrimoine", icon: "P" },
  { href: "/assistant", label: "Assistant IA", icon: "IA" },
  { href: "/rapports", label: "Rapports", icon: "R" },
  { href: "/parametres", label: "Parametres", icon: "S" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 border-r border-blue-100 bg-white/90 px-4 py-6 shadow-sm lg:sticky lg:top-0 lg:block">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-lg bg-emerald-400 text-sm font-black text-black">F</span>
        <div>
          <p className="text-lg font-semibold text-zinc-950">Financiero</p>
          <p className="text-xs text-zinc-500">Application personnelle</p>
        </div>
      </Link>
      <nav className="space-y-1">
        {appLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition",
                active ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-blue-50 hover:text-blue-800",
              )}
            >
              <span className="grid size-7 place-items-center rounded-lg border border-current/20 text-[11px] font-bold">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
      <div className="scrollbar-none mx-auto flex max-w-full gap-1 overflow-x-auto px-1">
        {appLinks.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-h-14 min-w-20 shrink-0 flex-col items-center justify-center rounded-lg px-1 text-[11px] font-black transition active:scale-[0.97]",
                active ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-blue-50 hover:text-blue-800",
              )}
            >
              <span className="grid size-6 place-items-center rounded-md border border-current/20 text-[10px]">{link.icon}</span>
              <span className="mt-1 max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
