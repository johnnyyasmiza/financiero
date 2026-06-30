"use client";

import Link from "next/link";
import { formatBaseUnitPrice, getBestPrice } from "@/lib/price-comparison";
import { formatCaissePrice, getCategoryByKey, getStoreByKey, productMatchesRoute } from "@/lib/caisse-config";
import { cn } from "@/lib/utils";
import { useCaisseCart } from "@/components/caisse/CaisseCartProvider";

export function CaisseProductsPage({ storeKey, categoryKey }: { storeKey: string; categoryKey: string }) {
  const store = getStoreByKey(storeKey);
  const category = getCategoryByKey(categoryKey);
  const { products, isLoadingProducts, addToCart, success } = useCaisseCart();

  if (!store || !category) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
        <p className="font-black text-red-700">Magasin ou catégorie inconnue.</p>
        <Link href="/caisse" className="mt-4 inline-flex h-12 items-center rounded-lg bg-blue-600 px-5 font-black text-white">Retour magasins</Link>
      </div>
    );
  }

  const visibleProducts = products.filter((product) => productMatchesRoute(product, store.key, category.key));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-20 place-items-center rounded-lg bg-white shadow-inner ring-1 ring-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={category.logo} alt={category.name} className="max-h-16 max-w-16 object-contain" />
          </div>
          <div>
            <p className="text-sm font-black uppercase text-blue-600">{store.name}</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-950">{category.name}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/caisse/categories?store=${store.key}`} className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-200 bg-white px-5 font-black text-blue-800 transition hover:border-blue-500">
            Retour catégories
          </Link>
          <Link href="/caisse" className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 font-black text-zinc-700 transition hover:border-zinc-400">
            Retour magasins
          </Link>
        </div>
      </div>

      {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</p> : null}

      {isLoadingProducts ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-zinc-600 shadow-sm">Chargement des produits...</p>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black text-zinc-950">Aucun produit pour ce choix</p>
          <p className="mt-2 text-sm text-zinc-500">Retournez aux magasins puis synchronisez les imports.</p>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => {
            const comparison = getBestPrice(product, products);
            const best = comparison.bestProduct;
            const cheaper = comparison.status === "cheaper" && best;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl active:scale-[0.99]"
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} className="h-60 w-full bg-white object-contain p-4" />
                ) : (
                  <div className="grid h-60 place-items-center bg-zinc-50 text-sm font-semibold text-zinc-500">{product.category}</div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-h-14 text-base font-black text-zinc-950">{product.name}</h3>
                    <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{product.store}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className={cn("text-2xl font-black", product.price ? "text-emerald-700" : "text-yellow-700")}>{formatCaissePrice(product.price)}</p>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">{formatBaseUnitPrice(product)}</p>
                    </div>
                    <span className={cn("rounded-lg px-5 py-3 text-sm font-black shadow-sm", store.button)}>Ajouter</span>
                  </div>
                  <div className={cn("mt-4 rounded-lg border p-3 text-xs font-bold", cheaper ? "border-yellow-200 bg-yellow-50 text-yellow-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                    {cheaper ? comparison.message : comparison.message}
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
