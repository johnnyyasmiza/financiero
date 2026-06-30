"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBaseUnitPrice, getBestPrice } from "@/lib/price-comparison";
import { getProducts, subscribeToProducts, type ShoppingProduct } from "@/lib/shopping-catalog";
import { cn } from "@/lib/utils";

function priceLabel(price: number | null) {
  return price && price > 0 ? `${price.toFixed(2)} DH` : "Prix à définir";
}

export function ComparateurClient() {
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function loadProducts() {
      getProducts()
        .then((nextProducts) => {
          setProducts(nextProducts);
          setError("");
        })
        .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger le comparateur."))
        .finally(() => setIsLoading(false));
    }

    loadProducts();
    return subscribeToProducts(loadProducts);
  }, []);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const candidates = products.filter((product) => {
      if (!normalizedQuery) {
        return true;
      }

      return product.name.toLowerCase().includes(normalizedQuery) || product.normalizedName.includes(normalizedQuery);
    });

    return candidates.map((product) => ({ product, comparison: getBestPrice(product, products) }));
  }, [products, query]);

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Comparaison des prix</h2>
          <p className="mt-1 text-sm text-zinc-500">Recherchez un produit et comparez les magasins saisis manuellement.</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher viande hachée, patate..."
          className="h-12 w-full rounded-lg border border-white/10 bg-black px-4 text-zinc-100 outline-none ring-emerald-400/30 placeholder:text-zinc-600 focus:ring-4 md:max-w-md"
        />
      </div>

      {error ? <p className="mt-4 whitespace-pre-line rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
        {isLoading ? (
          <p className="bg-black/40 p-4 text-sm text-zinc-300">Chargement des prix...</p>
        ) : rows.length === 0 ? (
          <div className="bg-black/40 p-6 text-center">
            <p className="font-medium text-white">Aucun produit à comparer</p>
            <p className="mt-2 text-sm text-zinc-500">Importez les produits Marjane depuis la Caisse.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-black text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Magasin</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Unité</th>
                  <th className="px-4 py-3">Économie possible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map(({ product, comparison }) => (
                  <tr key={product.id} className={cn(comparison.status === "best" ? "bg-emerald-400/10" : "bg-zinc-950")}>
                    <td className="px-4 py-4 font-semibold text-white">{product.name}</td>
                    <td className="px-4 py-4 text-zinc-300">{product.store}</td>
                    <td className="px-4 py-4 text-zinc-100">{priceLabel(product.price)}</td>
                    <td className="px-4 py-4 text-zinc-400">{product.unit} - {formatBaseUnitPrice(product)}</td>
                    <td className="px-4 py-4">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-bold", comparison.status === "cheaper" ? "bg-amber-400/10 text-amber-100" : "bg-emerald-400/10 text-emerald-100")}>
                        {comparison.message}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
