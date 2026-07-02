"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { FridgeItemCard } from "@/components/FridgeItemCard";
import {
  addFridgeItem,
  calculateRecipeCost,
  calculateStockProgress,
  formatFridgeQuantity,
  getLowStockAlerts,
  loadFridgeItems,
  prepareRecipe,
  subscribeToFridge,
  type FridgeItem,
  type FridgeRecipeIngredient,
} from "@/lib/fridge";
import { PREDEFINED_RECIPES } from "@/lib/automationFlow";
import { addExpense } from "@/lib/finance-db";
import { addNeeds, addOrIncrementNeed, getNeeds } from "@/lib/shopping-catalog";
import { normalizeProductName } from "@/lib/price-comparison";
import { formatMoney, getTodayDate } from "@/lib/utils";

const recipeUnits = ["g", "kg", "ml", "cl", "l", "piece", "pack"];
const fridgeFilters = ["Tous", "En stock", "Stock bas", "Epuise", "Fruits", "Legumes", "Viande", "Volaille", "Bebe", "Epicerie", "Fromage", "Charcuterie"];

type EditableRecipeIngredient = FridgeRecipeIngredient & { estimatedPrice?: number };

function cloneRecipe(recipeId: string): EditableRecipeIngredient[] {
  const recipe = PREDEFINED_RECIPES.find((item) => item.id === recipeId) ?? PREDEFINED_RECIPES[0];
  return recipe.ingredients.map((ingredient) => ({ name: ingredient.name, amount: ingredient.amount, unit: ingredient.unit, estimatedPrice: ingredient.estimatedPrice }));
}

export function FridgePage() {
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedRecipeId, setSelectedRecipeId] = useState(PREDEFINED_RECIPES[0]?.id ?? "");
  const [recipe, setRecipe] = useState<EditableRecipeIngredient[]>(() => cloneRecipe(PREDEFINED_RECIPES[0]?.id ?? ""));
  const [toast, setToast] = useState<{ message: string; tone: "success" | "warning" | "error" } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [needsAddedIds, setNeedsAddedIds] = useState<Set<string>>(() => new Set());

  function reload() {
    loadFridgeItems()
      .then((nextItems) => {
        setItems(nextItems);
        setLoadError("");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Impossible de charger le frigo.";
        setItems([]);
        setLoadError(message);
        setToast({ message, tone: "error" });
      });
  }

  function showToast(message: string, tone: "success" | "warning" | "error" = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3000);
    reload();
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    const unsubscribe = subscribeToFridge(reload);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const selectedRecipe = PREDEFINED_RECIPES.find((item) => item.id === selectedRecipeId) ?? PREDEFINED_RECIPES[0];
  const alerts = getLowStockAlerts(items);
  const recipeCost = calculateRecipeCost(recipe);

  function selectRecipe(recipeId: string) {
    setSelectedRecipeId(recipeId);
    setRecipe(cloneRecipe(recipeId));
  }

  function updateIngredient(index: number, patch: Partial<EditableRecipeIngredient>) {
    setRecipe((current) => current.map((ingredient, currentIndex) => (currentIndex === index ? { ...ingredient, ...patch } : ingredient)));
  }

  function removeIngredient(index: number) {
    setRecipe((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function addIngredient() {
    setRecipe((current) => [...current, { name: "", amount: 1, unit: "piece" }]);
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "");
    const weight = Number(values.get("weight"));
    const weightUnit = String(values.get("weightUnit") || "g");
    const pieces = Number(values.get("pieces"));
    const unitIsCount = weightUnit === "piece" || weightUnit === "pack";

    try {
      await addFridgeItem({
        name,
        category: String(values.get("category") || "Autre"),
        quantityWeight: !unitIsCount && Number.isFinite(weight) && weight > 0 ? weight : undefined,
        quantityPieces: unitIsCount && Number.isFinite(weight) && weight > 0 ? weight : Number.isFinite(pieces) && pieces > 0 ? pieces : undefined,
        unit: weightUnit,
        totalPrice: Number(values.get("totalPrice")),
        purchaseDate: String(values.get("purchaseDate") || getTodayDate()),
        expiryDate: String(values.get("expiryDate") || ""),
      });
      form.reset();
      showToast(`${name} ajoute au frigo`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible d'ajouter ce produit au frigo.", "error");
    }
  }

  async function addMissingToNeeds() {
    await Promise.all(
      recipeCost.missing.map((line) =>
        addOrIncrementNeed({
          productId: null,
          store: "Frigo",
          category: "Courses",
          name: line.ingredient.name,
          imageUrl: null,
          unit: "piece",
          quantity: 1,
          unitPrice: null,
          total: null,
        }),
      ),
    );
    showToast("Ingredients manquants ajoutes aux besoins", "warning");
  }

  async function addFridgeItemToNeeds(item: FridgeItem, message = `${item.name} ajoute aux besoins`) {
    if (needsAddedIds.has(item.id)) {
      setToast({ message: "Produit deja dans besoins", tone: "warning" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }

    const needs = await getNeeds();
    const normalizedName = normalizeProductName(item.name);
    const alreadyInNeeds = needs.some((need) => {
      const sameProduct = item.productId && need.productId === item.productId;
      return need.status === "a_acheter" && (sameProduct || normalizeProductName(need.name) === normalizedName);
    });

    if (alreadyInNeeds) {
      setNeedsAddedIds((current) => new Set(current).add(item.id));
      setToast({ message: "Produit deja dans besoins", tone: "warning" });
      window.setTimeout(() => setToast(null), 3000);
      return;
    }

    const quantityToBuy = Math.max(1, Number(item.quantity ?? 1));
    const unitPrice = item.purchasePrice && quantityToBuy > 0 ? item.purchasePrice / quantityToBuy : null;
    await addNeeds([
      {
        productId: item.productId ?? null,
        store: item.store ?? "Frigo",
        category: item.category,
        name: item.name,
        imageUrl: item.imageUrl ?? null,
        unit: item.unit,
        quantity: quantityToBuy,
        unitPrice,
        total: unitPrice === null ? null : unitPrice * quantityToBuy,
      },
    ]);
    setNeedsAddedIds((current) => new Set(current).add(item.id));
    setToast({ message, tone: "warning" });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function prepareCurrentRecipe() {
    const cleanRecipe = recipe.filter((ingredient) => ingredient.name.trim() && ingredient.amount > 0);
    const result = prepareRecipe(cleanRecipe);
    if (!result.ok) {
      showToast(`Il manque : ${result.cost.missing.map((line) => line.ingredient.name).join(", ")}`, "warning");
      return;
    }
    await addExpense({
      amount: result.cost.totalCost,
      merchant: selectedRecipe.name,
      category: "Cuisine / Repas maison",
      payment: "Interne",
      note: "Cout estime recette, sans impact solde",
      date: getTodayDate(),
      sourceType: "recipe_cost_internal",
    });
    showToast(`${selectedRecipe.name} disponible avec le stock actuel. Cout interne : ${formatMoney(result.cost.totalCost)}`);
  }

  const visibleItems = items.filter((item) => {
    const progress = calculateStockProgress(item);
    const isEpuise = item.status === "epuise" || (item.remainingQuantity ?? 1) <= 0;
    if (activeFilter === "Tous") return true;
    if (activeFilter === "En stock") return !isEpuise && progress > (item.lowStockThreshold ?? 20);
    if (activeFilter === "Stock bas") return !isEpuise && progress <= (item.lowStockThreshold ?? 20);
    if (activeFilter === "Epuise") return isEpuise;
    return item.category.toLowerCase() === activeFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {toast ? (
        <p className={`fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-lg p-4 text-sm font-black shadow-2xl ${toast.tone === "error" ? "bg-red-500 text-white" : toast.tone === "warning" ? "bg-yellow-400 text-black" : "bg-emerald-400 text-black"}`}>
          {toast.message}
        </p>
      ) : null}
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">
          <p className="whitespace-pre-line">{loadError}</p>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={(event) => void addItem(event)} className="grid gap-3 rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-blue-600">Mon Frigo</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">Ajouter produit</h2>
            </div>
            <Link href="/scan" className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800">
              Scanner ticket
            </Link>
          </div>
          <input name="name" required placeholder="Tomates, Danone, lait..." className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <input name="weight" type="number" step="0.01" min="0" placeholder="Poids / volume" className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
            <select name="weightUnit" className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500">
              {["kg", "g", "l", "cl", "ml", "piece", "pack"].map((unit) => <option key={unit} value={unit}>{unit === "piece" ? "pièce" : unit === "pack" ? "paquet" : unit}</option>)}
            </select>
          </div>
          <input name="pieces" type="number" step="0.1" min="0" placeholder="Nombre de pieces optionnel" className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
          <input name="totalPrice" type="number" step="0.01" min="0" placeholder="Prix total DH" className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <input name="purchaseDate" type="date" defaultValue={getTodayDate()} className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
            <input name="expiryDate" type="date" className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
          </div>
          <select name="category" className="h-12 rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500">
            {["Fruits", "Legumes", "Viande", "Volaille", "Bebe", "Epicerie", "Fromage", "Charcuterie", "Autre"].map((category) => <option key={category}>{category}</option>)}
          </select>
          <button type="submit" className="h-12 rounded-lg bg-emerald-400 px-5 font-black text-black transition hover:bg-emerald-300">
            Ajouter produit
          </button>
        </form>

        <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-zinc-950">Alertes stock</h2>
          <div className="mt-4 space-y-3">
            {alerts.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-200 p-5 text-center text-sm font-semibold text-zinc-500">Aucune alerte.</p> : null}
            {alerts.map((alert) => (
              <div key={alert.itemId} className={`rounded-lg border p-3 ${alert.type === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-yellow-200 bg-yellow-50 text-yellow-900"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black">{alert.message}</p>
                    <p className="mt-1 text-xs font-bold">Restant : {formatFridgeQuantity(alert.item)}</p>
                    {needsAddedIds.has(alert.item.id) ? <p className="mt-2 inline-flex rounded-md bg-white px-2 py-1 text-xs font-black text-emerald-700">Deja dans besoins</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void addFridgeItemToNeeds(alert.item)} className="h-9 rounded-lg bg-white px-3 text-xs font-black text-zinc-900 shadow-sm">
                      {needsAddedIds.has(alert.item.id) ? "Deja ajoute" : "Ajouter aux besoins"}
                    </button>
                    <button type="button" onClick={() => void addFridgeItemToNeeds(alert.item, `${alert.item.name} ajoute pour rachat`)} className="h-9 rounded-lg bg-zinc-950 px-3 text-xs font-black text-white">
                      Racheter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Stock alimentaire</p>
            <h2 className="text-2xl font-black text-zinc-950">{items.length} produit(s)</h2>
          </div>
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {fridgeFilters.map((filter) => (
            <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-black ${activeFilter === filter ? "border-blue-600 bg-blue-600 text-white" : "border-blue-100 bg-white text-blue-800"}`}>
              {filter}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.length === 0 ? <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm font-semibold text-zinc-500 sm:col-span-2 xl:col-span-3">Aucun produit dans le frigo.</p> : null}
          {visibleItems.map((item) => <FridgeItemCard key={item.id} item={item} onChanged={showToast} />)}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-blue-600">Recettes</p>
              <h2 className="text-2xl font-black text-zinc-950">Choisir une recette</h2>
            </div>
            <select value={selectedRecipeId} onChange={(event) => selectRecipe(event.target.value)} className="h-12 rounded-lg border border-blue-100 px-4 text-sm font-bold outline-none focus:border-blue-500">
              {PREDEFINED_RECIPES.map((recipeItem) => <option key={recipeItem.id} value={recipeItem.id}>{recipeItem.name}</option>)}
            </select>
          </div>

          <div className="mt-5 grid gap-3">
            {recipe.map((ingredient, index) => (
              <div key={`${ingredient.name}-${index}`} className="grid gap-2 rounded-lg border border-zinc-100 p-3 sm:grid-cols-[1.2fr_0.6fr_0.7fr_0.7fr_auto]">
                <input value={ingredient.name} onChange={(event) => updateIngredient(index, { name: event.target.value })} placeholder="Ingredient" className="h-11 rounded-lg border border-blue-100 px-3 text-sm outline-none focus:border-blue-500" />
                <input value={ingredient.amount} onChange={(event) => updateIngredient(index, { amount: Number(event.target.value) })} type="number" min="0" step="0.01" className="h-11 rounded-lg border border-blue-100 px-3 text-sm outline-none focus:border-blue-500" />
                <select value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value })} className="h-11 rounded-lg border border-blue-100 px-3 text-sm outline-none focus:border-blue-500">
                  {recipeUnits.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
                <input value={ingredient.estimatedPrice ?? ""} onChange={(event) => updateIngredient(index, { estimatedPrice: event.target.value ? Number(event.target.value) : undefined })} type="number" min="0" step="0.01" placeholder="Prix DH" className="h-11 rounded-lg border border-blue-100 px-3 text-sm outline-none focus:border-blue-500" />
                <button type="button" onClick={() => removeIngredient(index)} className="h-11 rounded-lg border border-red-100 px-3 text-xs font-black text-red-700">
                  Retirer
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={addIngredient} className="h-11 rounded-lg border border-blue-100 px-4 text-sm font-black text-blue-800">
              Ajouter ingredient
            </button>
            <button type="button" onClick={() => void prepareCurrentRecipe()} className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-black text-white">
              Preparer recette
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black text-zinc-950">Cout et manquants</h2>
          <div className="mt-4 rounded-lg bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase text-emerald-700">Cout estime</p>
            <p className="text-2xl font-black text-emerald-950">{formatMoney(recipeCost.totalCost)}</p>
            <p className="mt-1 text-xs font-bold text-emerald-800">Analyse interne, sans doubler la depense d&apos;achat.</p>
          </div>

          <div className="mt-4 space-y-3">
            {recipeCost.missing.length === 0 ? <p className="text-sm font-semibold text-zinc-500">Tous les ingredients sont disponibles.</p> : null}
            {recipeCost.missing.map((line) => <p key={line.ingredient.name} className="rounded-lg bg-yellow-50 p-3 text-sm font-black text-yellow-900">Il manque : {line.ingredient.name}</p>)}
          </div>
          {recipeCost.missing.length > 0 ? (
            <button type="button" onClick={() => void addMissingToNeeds()} className="mt-4 h-11 rounded-lg bg-yellow-400 px-4 text-sm font-black text-black">
              Ajouter manquants aux besoins
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
