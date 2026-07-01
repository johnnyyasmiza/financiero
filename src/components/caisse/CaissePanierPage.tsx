"use client";

import Link from "next/link";
import { formatCaissePrice, getStoreByName, normalizeCaisseKey } from "@/lib/caisse-config";
import { getBestPrice } from "@/lib/price-comparison";
import { useCaisseCart } from "@/components/caisse/CaisseCartProvider";

export function CaissePanierPage() {
  const { cart, products, total, error, success, isSaving, updateQuantity, removeFromCart, validateNow, saveForLater } = useCaisseCart();
  const lastProduct = cart[cart.length - 1]?.product;
  const lastStoreKey = getStoreByName(lastProduct?.store)?.key;
  const lastCategoryKey = lastProduct ? normalizeCaisseKey(lastProduct.category) : null;
  const backToProductsHref = lastStoreKey && lastCategoryKey ? `/caisse/produits?store=${lastStoreKey}&category=${lastCategoryKey}` : "/caisse";
  const optimizedTotal = cart.reduce((sum, item) => {
    const best = getBestPrice(item.product, products);
    const currentBase = item.product.pricePerBaseUnit;

    if (best.status !== "cheaper" || !best.bestProduct?.pricePerBaseUnit || !currentBase || !item.product.price) {
      return sum + (item.product.price ?? 0) * item.quantity;
    }

    const ratio = best.bestProduct.pricePerBaseUnit / currentBase;
    return sum + item.product.price * ratio * item.quantity;
  }, 0);
  const possibleSaving = Math.max(total - optimizedTotal, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-blue-600">Panier final</p>
          <h2 className="mt-1 text-3xl font-black text-zinc-950">Vos courses</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={backToProductsHref} className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-200 bg-white px-5 font-black text-blue-800 transition hover:border-blue-500">
            Retour produits
          </Link>
          <Link href="/caisse" className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 font-black text-zinc-700 transition hover:border-zinc-400">
            Retour magasins
          </Link>
        </div>
      </div>

      {error ? <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{success}</p>
          <Link href="/frigo" className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700">
            Voir mon frigo
          </Link>
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        {cart.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
            <p className="text-lg font-black text-zinc-950">Panier vide</p>
            <Link href="/caisse" className="mt-4 inline-flex h-12 items-center rounded-lg bg-blue-600 px-5 font-black text-white">Choisir un magasin</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => {
              const lineTotal = (item.product.price ?? 0) * item.quantity;

              return (
                <div key={item.product.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-4">
                      {item.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.product.imageUrl} alt={item.product.name} className="size-20 rounded-lg border border-zinc-100 object-contain p-1" />
                      ) : null}
                      <div>
                        <p className="font-black text-zinc-950">{item.product.name}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {item.product.store} · {item.product.unit} · {formatCaissePrice(item.product.price)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-black text-zinc-950">{lineTotal.toFixed(2)} DH</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button type="button" onClick={() => updateQuantity(item.product.id, -1)} className="grid size-11 place-items-center rounded-lg border border-zinc-200 bg-white text-xl font-black text-zinc-900">-</button>
                    <span className="grid h-11 min-w-12 place-items-center rounded-lg bg-zinc-100 px-4 text-base font-black text-zinc-950">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.product.id, 1)} className="grid size-11 place-items-center rounded-lg border border-zinc-200 bg-white text-xl font-black text-zinc-900">+</button>
                    <button type="button" onClick={() => removeFromCart(item.product.id)} className="ml-auto h-11 rounded-lg bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100">
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-500">Total général</p>
            <p className="mt-1 text-4xl font-black text-zinc-950">{total.toFixed(2)} DH</p>
            <p className="mt-2 text-sm font-semibold text-emerald-700">Total optimisé : {optimizedTotal.toFixed(2)} DH</p>
            <p className="text-sm font-semibold text-yellow-700">Économie possible : {possibleSaving.toFixed(2)} DH</p>
          </div>
          <div className="grid gap-3 sm:min-w-72">
            <button type="button" onClick={() => void validateNow()} disabled={isSaving || cart.length === 0} className="h-14 rounded-lg bg-emerald-500 text-base font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500">
              {isSaving ? "Enregistrement..." : "Valider maintenant"}
            </button>
            <button type="button" onClick={() => void saveForLater()} disabled={isSaving || cart.length === 0} className="h-14 rounded-lg border border-blue-200 bg-white text-base font-black text-blue-800 transition hover:border-blue-500 disabled:cursor-not-allowed disabled:text-zinc-400">
              Ajouter aux besoins
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
