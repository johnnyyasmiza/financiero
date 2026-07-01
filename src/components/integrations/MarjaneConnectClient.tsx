"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CART_STORAGE_KEY, type CaisseCartItem } from "@/components/caisse/CaisseCartProvider";
import { addFridgeItem, normalizeUnit } from "@/lib/fridge";
import {
  mapToFinancieroItem,
  parseMarjaneJson,
  recordMarjaneSync,
  type FinancieroDestination,
  type FinancieroImportItem,
} from "@/lib/integrations/marjane-connect";
import { addOrIncrementNeed, type ShoppingProduct } from "@/lib/shopping-catalog";
import { formatMoney, getTodayDate } from "@/lib/utils";

const destinationLabels: Record<FinancieroDestination, string> = {
  needs: "Besoins",
  cart: "Caisse",
  fridge: "Frigo",
  ignore: "Ignorer",
};

function readCart() {
  try {
    return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CaisseCartItem[];
  } catch {
    return [];
  }
}

function writeCart(items: CaisseCartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("storage"));
}

function toShoppingProduct(item: FinancieroImportItem): ShoppingProduct {
  return {
    id: `marjane-${item.sourceId}`,
    store: "Marjane",
    name: item.name,
    normalizedName: item.normalizedName,
    category: item.category,
    price: item.price,
    unit: item.unit,
    unitQuantity: item.unitQuantity,
    unitBase: item.unit,
    pricePerBaseUnit: item.price && item.unitQuantity > 0 ? item.price / item.unitQuantity : null,
    imageUrl: item.imageUrl,
    sourceUrl: "marjane-connect",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function addToCart(items: FinancieroImportItem[]) {
  const cart = readCart();

  items.forEach((item) => {
    const product = toShoppingProduct(item);
    const existing = cart.find((row) => row.product.id === product.id);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      cart.push({ product, quantity: item.quantity });
    }
  });

  writeCart(cart);
}

export function MarjaneConnectClient() {
  const [jsonInput, setJsonInput] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [items, setItems] = useState<FinancieroImportItem[]>([]);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const importableItems = useMemo(() => items.filter((item) => item.destination !== "ignore"), [items]);

  function updateItem(sourceId: string, patch: Partial<FinancieroImportItem>) {
    setItems((current) => current.map((item) => (item.sourceId === sourceId ? { ...item, ...patch } : item)));
  }

  function analyzeJson(input: string, syncType: "json" | "url" = "json") {
    try {
      const parsed = parseMarjaneJson(input);
      const nextItems = parsed.map(mapToFinancieroItem);
      setItems(nextItems);
      setMessage(`${nextItems.length} produit(s) Marjane analyses.`);
      setError("");
      void recordMarjaneSync({ syncType, rawJson: parsed, importedItems: nextItems }).catch(() => undefined);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "JSON Marjane invalide.");
    }
  }

  async function fetchApiUrl() {
    const cleanUrl = apiUrl.trim();

    if (!cleanUrl) {
      setError("Collez une URL API Marjane.");
      return;
    }

    setIsLoadingUrl(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(cleanUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setJsonInput(text);
      analyzeJson(text, "url");
    } catch {
      setError("CORS bloque. Collez la reponse JSON manuellement.");
    } finally {
      setIsLoadingUrl(false);
    }
  }

  function sendAllTo(destination: FinancieroDestination) {
    setItems((current) => current.map((item) => ({ ...item, destination })));
  }

  async function importSelection() {
    if (importableItems.length === 0) {
      setError("Aucun produit selectionne pour l'import.");
      return;
    }

    setIsImporting(true);
    setMessage("");
    setError("");

    try {
      const needsItems = importableItems.filter((item) => item.destination === "needs");
      const cartItems = importableItems.filter((item) => item.destination === "cart");
      const fridgeItems = importableItems.filter((item) => item.destination === "fridge");

      for (const item of needsItems) {
        await addOrIncrementNeed({
          productId: null,
          store: "Marjane",
          category: item.category,
          name: item.name,
          imageUrl: item.imageUrl,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.purchasePrice,
        });
      }

      if (cartItems.length > 0) {
        addToCart(cartItems);
      }

      for (const item of fridgeItems) {
        const normalized = normalizeUnit(item.initialQuantity, item.unit);
        await addFridgeItem({
          productId: null,
          store: "Marjane",
          category: item.category,
          name: item.name,
          imageUrl: item.imageUrl,
          quantity: 1,
          unit: normalized.unit,
          unitQuantity: normalized.value,
          totalQuantity: normalized.value,
          initialQuantity: normalized.value,
          remainingQuantity: normalized.value,
          lowStockThreshold: 20,
          purchasePrice: item.purchasePrice,
          purchaseDate: getTodayDate(),
        });
      }

      void recordMarjaneSync({ syncType: "import", rawJson: importableItems.map((item) => item.raw), importedItems: importableItems }).catch(() => undefined);
      setMessage(`${importableItems.length} produit(s) importes vers Financiero.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import Marjane impossible.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Marjane Connect</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-950">Importer une liste Marjane</h2>
            <p className="mt-2 text-sm text-zinc-500">Aucun identifiant, cookie ou token n&apos;est stocke.</p>
          </div>
          <Link href="/caisse" className="inline-flex h-11 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-800 transition hover:border-blue-500">
            Ouvrir la caisse
          </Link>
        </div>
      </section>

      {error ? <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-zinc-950">Import JSON Marjane</h3>
          <textarea
            value={jsonInput}
            onChange={(event) => setJsonInput(event.target.value)}
            placeholder="Coller reponse JSON Marjane"
            className="mt-4 min-h-64 w-full rounded-lg border border-blue-100 bg-white p-3 text-sm font-semibold text-zinc-900 outline-none focus:border-blue-500"
          />
          <button type="button" onClick={() => analyzeJson(jsonInput)} className="mt-3 h-11 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700">
            Analyser
          </button>
        </div>

        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-zinc-950">URL API Marjane</h3>
          <input
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder="https://api-ayaline.marjane.ma/customers/shopping-list/XXXXX/products"
            className="mt-4 h-12 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-blue-500"
          />
          <button type="button" onClick={() => void fetchApiUrl()} disabled={isLoadingUrl} className="mt-3 h-11 rounded-lg bg-emerald-500 px-5 text-sm font-black text-black transition hover:bg-emerald-400 disabled:bg-zinc-300">
            {isLoadingUrl ? "Analyse..." : "Charger URL"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-black text-zinc-950">Apercu produits</h3>
            <p className="mt-1 text-sm font-semibold text-zinc-500">{items.length} produit(s), {importableItems.length} selectionne(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => sendAllTo("needs")} className="h-10 rounded-lg border border-blue-200 px-3 text-xs font-black text-blue-800">Tout vers Besoins</button>
            <button type="button" onClick={() => sendAllTo("cart")} className="h-10 rounded-lg border border-blue-200 px-3 text-xs font-black text-blue-800">Tout vers Caisse</button>
            <button type="button" onClick={() => sendAllTo("fridge")} className="h-10 rounded-lg border border-blue-200 px-3 text-xs font-black text-blue-800">Tout vers Frigo</button>
            <button type="button" onClick={() => void importSelection()} disabled={isImporting || importableItems.length === 0} className="h-10 rounded-lg bg-emerald-500 px-4 text-xs font-black text-black transition hover:bg-emerald-400 disabled:bg-zinc-300">
              {isImporting ? "Import..." : "Importer selection"}
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-zinc-500">
                <th className="border-b border-zinc-100 p-3">Image</th>
                <th className="border-b border-zinc-100 p-3">Nom</th>
                <th className="border-b border-zinc-100 p-3">Quantite detectee</th>
                <th className="border-b border-zinc-100 p-3">Unite</th>
                <th className="border-b border-zinc-100 p-3">Prix</th>
                <th className="border-b border-zinc-100 p-3">Categorie</th>
                <th className="border-b border-zinc-100 p-3">Destination</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center font-semibold text-zinc-500">Aucun produit analyse.</td>
                </tr>
              ) : null}
              {items.map((item) => (
                <tr key={item.sourceId} className="align-top">
                  <td className="border-b border-zinc-100 p-3">
                    <div className="grid size-14 place-items-center rounded-lg bg-zinc-50">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} className="max-h-12 max-w-12 object-contain" />
                      ) : (
                        <span className="text-xs font-black text-zinc-400">MJ</span>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    <input value={item.name} onChange={(event) => updateItem(item.sourceId, { name: event.target.value })} className="h-10 w-full rounded-lg border border-zinc-100 px-3 font-semibold outline-none focus:border-blue-500" />
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    <input
                      type="number"
                      min="0"
                      value={item.initialQuantity}
                      onChange={(event) => {
                        const initialQuantity = Number(event.target.value);
                        updateItem(item.sourceId, {
                          initialQuantity,
                          remainingQuantity: initialQuantity,
                          unitQuantity: item.quantity > 0 ? initialQuantity / item.quantity : initialQuantity,
                        });
                      }}
                      className="h-10 w-28 rounded-lg border border-zinc-100 px-3 font-semibold outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    <input value={item.unit} onChange={(event) => updateItem(item.sourceId, { unit: event.target.value })} className="h-10 w-24 rounded-lg border border-zinc-100 px-3 font-semibold outline-none focus:border-blue-500" />
                  </td>
                  <td className="border-b border-zinc-100 p-3 font-black text-zinc-950">{item.price === null ? "-" : formatMoney(item.price)}</td>
                  <td className="border-b border-zinc-100 p-3">
                    <input value={item.category} onChange={(event) => updateItem(item.sourceId, { category: event.target.value })} className="h-10 w-40 rounded-lg border border-zinc-100 px-3 font-semibold outline-none focus:border-blue-500" />
                  </td>
                  <td className="border-b border-zinc-100 p-3">
                    <select value={item.destination} onChange={(event) => updateItem(item.sourceId, { destination: event.target.value as FinancieroDestination })} className="h-10 rounded-lg border border-zinc-100 px-3 font-black outline-none focus:border-blue-500">
                      {Object.entries(destinationLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
