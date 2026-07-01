"use client";

import Link from "next/link";
import { caisseCategories, findLogo, getFallbackCategoryKeys, getStoreByKey, normalizeCaisseKey } from "@/lib/caisse-config";
import { cn } from "@/lib/utils";
import { useCaisseCart } from "@/components/caisse/CaisseCartProvider";

export function CaisseCategoriesPage({ storeKey }: { storeKey: string }) {
  const store = getStoreByKey(storeKey);
  const { products } = useCaisseCart();

  if (!store) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
        <p className="font-black text-red-700">Magasin inconnu.</p>
        <Link href="/caisse" className="mt-4 inline-flex h-12 items-center rounded-lg bg-blue-600 px-5 font-black text-white">Retour magasins</Link>
      </div>
    );
  }

  const availableCategoryKeys = new Set(
    products
      .filter((product) => product.store === store.name)
      .map((product) => normalizeCaisseKey(product.category)),
  );
  getFallbackCategoryKeys(store.key).forEach((categoryKey) => availableCategoryKeys.add(categoryKey));
  const fallbackCategoryKeys = getFallbackCategoryKeys(store.key);
  const orderedCategoryKeys = [
    ...fallbackCategoryKeys,
    ...caisseCategories.map((category) => category.key).filter((categoryKey) => !fallbackCategoryKeys.includes(categoryKey)),
  ];
  const visibleCategories = orderedCategoryKeys
    .map((categoryKey) => caisseCategories.find((category) => category.key === categoryKey))
    .filter((category): category is (typeof caisseCategories)[number] => Boolean(category && availableCategoryKeys.has(category.key)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-blue-600">Magasin</p>
          <h2 className="mt-1 text-3xl font-black text-zinc-950">{store.name}</h2>
        </div>
        <Link href="/caisse" className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-200 bg-white px-5 font-black text-blue-800 transition hover:border-blue-500">
          Retour magasins
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {visibleCategories.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-black text-zinc-950">Aucune catégorie importée pour {store.name}</p>
            <p className="mt-2 text-sm text-zinc-500">Retournez aux magasins puis synchronisez les imports.</p>
          </div>
        ) : null}
        {visibleCategories.map((category) => (
          <Link
            key={category.key}
            href={`/caisse/produits?store=${store.key}&category=${category.key}`}
            className={cn("min-h-52 rounded-lg border-2 bg-gradient-to-br p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]", category.accent, category.bg)}
          >
            <div className="grid h-32 place-items-center rounded-lg bg-white p-3 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={findLogo(category.key) || category.logo} alt={category.name} className="max-h-28 max-w-full object-contain" />
            </div>
            <p className="mt-4 text-lg font-black text-zinc-950">{category.name}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
