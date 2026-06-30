"use client";

import Link from "next/link";
import { formatCaissePrice } from "@/lib/caisse-config";
import { useCaisseCart } from "@/components/caisse/CaisseCartProvider";

export function CaisseCartButton() {
  const { itemCount, total } = useCaisseCart();

  return (
    <Link href="/caisse/panier" className="inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-blue-200 bg-white px-5 text-sm font-black text-blue-900 shadow-sm transition hover:border-blue-400 hover:shadow-md">
      <span>Panier</span>
      <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">{itemCount}</span>
      <span className="hidden text-zinc-500 sm:inline">{formatCaissePrice(total)}</span>
    </Link>
  );
}
