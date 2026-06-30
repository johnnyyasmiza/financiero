"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CART_STORAGE_KEY, type CaisseCartItem } from "@/components/caisse/CaisseCartProvider";
import { formatCaissePrice, normalizeCaisseKey } from "@/lib/caisse-config";
import { normalizeProductName } from "@/lib/price-comparison";
import { deleteNeed, getNeeds, markNeedAsTaken, subscribeToNeeds, type Need } from "@/lib/shopping-catalog";
import { cn } from "@/lib/utils";

const filters = [
  "Tous",
  "Marjane",
  "Carrefour",
  "Boucherie Amsterdam",
  "HRI",
  "Swika",
  "Viande",
  "Legumes",
  "Fruits",
  "Bebe",
  "Epicerie",
];

function readCart() {
  try {
    return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CaisseCartItem[];
  } catch {
    return [];
  }
}

function addNeedToCart(need: Need) {
  const cart = readCart();
  const product = {
    id: need.productId ?? need.id,
    store: need.store,
    name: need.name,
    normalizedName: normalizeProductName(need.name),
    category: need.category,
    price: need.unitPrice,
    unit: need.unit,
    unitQuantity: null,
    unitBase: null,
    pricePerBaseUnit: null,
    imageUrl: need.imageUrl,
    sourceUrl: null,
    updatedAt: need.updatedAt,
    createdAt: need.createdAt,
  };
  const existing = cart.find((item) => item.product.id === product.id);

  if (existing) {
    existing.quantity += need.quantity;
  } else {
    cart.push({ product, quantity: need.quantity });
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function matchesFilter(need: Need, filter: string) {
  if (filter === "Tous") {
    return true;
  }

  const normalizedFilter = normalizeCaisseKey(filter);
  return normalizeCaisseKey(need.store) === normalizedFilter || normalizeCaisseKey(need.category) === normalizedFilter;
}

export function NeedsClient({ initialMessage = "" }: { initialMessage?: string }) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [filter, setFilter] = useState("Tous");
  const [isLoading, setIsLoading] = useState(true);
  const [takingId, setTakingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(initialMessage);

  const loadNeeds = useMemo(
    () => () => {
      getNeeds()
        .then((nextNeeds) => {
          setNeeds(nextNeeds);
          setError("");
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les besoins."))
        .finally(() => setIsLoading(false));
    },
    [],
  );

  useEffect(() => {
    loadNeeds();
    return subscribeToNeeds(loadNeeds);
  }, [loadNeeds]);

  const visibleNeeds = needs.filter((need) => matchesFilter(need, filter));
  const total = visibleNeeds.reduce((sum, need) => sum + (need.total ?? 0), 0);
  const count = visibleNeeds.reduce((sum, need) => sum + need.quantity, 0);

  async function takeNeed(need: Need) {
    setTakingId(need.id);
    setError("");
    setMessage("");

    try {
      addNeedToCart(need);
      await markNeedAsTaken(need.id);
      setNeeds((current) => current.filter((item) => item.id !== need.id));
      setMessage("Produit ajoute au panier");
    } catch (takeError) {
      setError(takeError instanceof Error ? takeError.message : "Impossible de marquer ce produit comme pris.");
    } finally {
      setTakingId("");
    }
  }

  async function removeNeed(id: string) {
    setError("");
    setMessage("");

    try {
      await deleteNeed(id);
      setNeeds((current) => current.filter((item) => item.id !== id));
      setMessage("Besoin supprime.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Impossible de supprimer ce besoin.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Liste de courses</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-950">Besoins</h2>
            <p className="mt-2 text-sm text-zinc-500">{count} produit(s) a acheter - estimation {formatCaissePrice(total)}</p>
          </div>
          <Link href="/caisse" className="inline-flex h-12 items-center justify-center rounded-lg bg-blue-600 px-5 font-black text-white transition hover:bg-blue-700">
            Ajouter depuis la caisse
          </Link>
        </div>
      </section>

      {error ? <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "h-11 shrink-0 rounded-lg border px-4 text-sm font-black transition",
                filter === item ? "border-blue-600 bg-blue-600 text-white" : "border-blue-100 bg-white text-zinc-700 hover:border-blue-400",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {isLoading ? <p className="rounded-lg border border-blue-100 bg-white p-5 text-sm font-semibold text-zinc-500 shadow-sm">Chargement des besoins...</p> : null}
        {!isLoading && visibleNeeds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-black text-zinc-950">Aucun besoin a acheter</p>
            <p className="mt-2 text-sm text-zinc-500">Ajoutez des produits depuis le panier de la Caisse.</p>
          </div>
        ) : null}
        {visibleNeeds.map((need) => (
          <article
            key={need.id}
            className={cn(
              "rounded-lg border border-blue-100 bg-white p-4 shadow-sm transition duration-300 hover:border-blue-300 hover:shadow-md",
              takingId === need.id && "scale-[0.98] opacity-30",
            )}
          >
            <div className="grid gap-4 md:grid-cols-[80px_1fr_auto] md:items-center">
              <button type="button" onClick={() => void takeNeed(need)} className="overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
                {need.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={need.imageUrl} alt={need.name} className="size-20 object-contain p-1" />
                ) : (
                  <span className="grid size-20 place-items-center text-xs font-black text-zinc-400">Image</span>
                )}
              </button>
              <button type="button" onClick={() => void takeNeed(need)} className="text-left">
                <p className="text-lg font-black text-zinc-950">{need.name}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {need.quantity} {need.unit} - {formatCaissePrice(need.unitPrice)} - {need.store}
                </p>
                <p className="mt-1 text-xs font-bold text-blue-700">{need.category}</p>
              </button>
              <div className="flex gap-2 md:justify-end">
                <button type="button" onClick={() => void takeNeed(need)} disabled={takingId === need.id} className="h-12 rounded-lg bg-emerald-500 px-5 font-black text-black transition hover:bg-emerald-400 disabled:bg-zinc-200">
                  Pris
                </button>
                <button type="button" onClick={() => void removeNeed(need.id)} className="h-12 rounded-lg bg-red-50 px-5 font-black text-red-700 transition hover:bg-red-100">
                  Supprimer
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
