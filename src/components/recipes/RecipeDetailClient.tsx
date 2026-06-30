"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CART_STORAGE_KEY, type CaisseCartItem } from "@/components/caisse/CaisseCartProvider";
import { formatCaissePrice } from "@/lib/caisse-config";
import { matchRecipeIngredient } from "@/lib/recipe-matcher";
import { generateRecipeVariants } from "@/lib/recipes/seed-recipes";
import { getRecipeCategory, type Recipe, servingOptions } from "@/lib/recipes";
import { addNeeds, getProducts, saveRecipeIngredientProduct, type ShoppingProduct } from "@/lib/shopping-catalog";
import { getTodayDate } from "@/lib/utils";

type IngredientChoice = {
  ingredient: Recipe["ingredients"][number];
  scaledQuantity: number;
  product: ShoppingProduct | null;
  productQuantity: number;
  cost: number | null;
  warning: string | null;
  candidates: ShoppingProduct[];
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
}

function lineTotal(choice: IngredientChoice) {
  return (choice.product?.price ?? 0) * choice.productQuantity;
}

function mergeIntoCart(choices: IngredientChoice[]) {
  const cart = readCart();

  choices.forEach((choice) => {
    if (!choice.product || choice.productQuantity <= 0) {
      return;
    }

    const existing = cart.find((item) => item.product.id === choice.product?.id);
    if (existing) {
      existing.quantity += choice.productQuantity;
    } else {
      cart.push({ product: choice.product, quantity: choice.productQuantity });
    }
  });

  writeCart(cart);
}

function manualChoice(product: ShoppingProduct, choice: IngredientChoice): IngredientChoice {
  return {
    ...choice,
    product,
    productQuantity: Math.max(1, choice.productQuantity || 1),
    cost: product.price ?? null,
    warning: product.pricePerBaseUnit ? null : "Prix brut utilise : selection manuelle.",
  };
}

export function RecipeDetailClient({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const category = getRecipeCategory(recipe.categorySlug);
  const [servings, setServings] = useState(recipe.baseServings);
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getProducts()
      .then((nextProducts) => {
        setProducts(nextProducts);
        setError("");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les produits."))
      .finally(() => setIsLoading(false));
  }, []);

  const marjaneProducts = useMemo(() => products.filter((product) => product.store === "Marjane"), [products]);
  const choices = useMemo(() => {
    const factor = servings / recipe.baseServings;
    return recipe.ingredients.map<IngredientChoice>((ingredient) => {
      const scaledQuantity = ingredient.quantity * factor;
      const match = matchRecipeIngredient(ingredient, scaledQuantity, products);
      const baseChoice: IngredientChoice = {
        ingredient,
        scaledQuantity,
        product: match.product,
        productQuantity: match.productQuantity,
        cost: match.cost,
        warning: match.warning,
        candidates: match.candidates,
      };
      const selected = selectedProducts[ingredient.name];
      const selectedProduct = selected ? products.find((product) => product.id === selected) : null;
      return selectedProduct ? manualChoice(selectedProduct, baseChoice) : baseChoice;
    });
  }, [products, recipe, selectedProducts, servings]);
  const estimatedTotal = choices.reduce((sum, choice) => sum + (choice.cost ?? 0), 0);
  const costPerServing = servings > 0 ? estimatedTotal / servings : 0;
  const variants = useMemo(() => generateRecipeVariants(recipe, products.slice(0, 6).map((product) => product.name.split(/\s+/).slice(0, 2).join(" "))), [products, recipe]);

  function addToCaisse() {
    mergeIntoCart(choices);
    router.push("/caisse/panier");
  }

  async function chooseProduct(ingredientName: string, productId: string) {
    setSelectedProducts((current) => ({ ...current, [ingredientName]: productId }));
    setError("");
    setMessage("");

    try {
      await saveRecipeIngredientProduct({ recipeKey: recipe.id, ingredientName, productId });
      setMessage("Produit Marjane sauvegarde pour cet ingredient.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder le produit choisi.");
    }
  }

  async function saveForLater() {
    const matched = choices.filter((choice) => choice.product);

    if (matched.length === 0) {
      setError("Choisissez au moins un produit Marjane pour cette recette.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await addNeeds(
        matched.map((choice) => ({
          productId: choice.product?.id ?? null,
          store: choice.product?.store ?? "Marjane",
          category: choice.product?.category ?? recipe.category,
          name: choice.product?.name ?? choice.ingredient.name,
          imageUrl: choice.product?.imageUrl ?? null,
          quantity: choice.productQuantity,
          unit: choice.product?.unit ?? choice.ingredient.unit,
          unitPrice: choice.product?.price ?? null,
          total: lineTotal(choice),
        })),
      );
      setMessage(`Produits ajoutes aux besoins le ${getTodayDate()}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder la liste.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <Link href={category ? `/recettes/categories/${category.slug}` : "/recettes"} className="text-sm font-black text-blue-700">Retour recettes</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex gap-4">
            {category ? (
              <div className="grid size-24 shrink-0 place-items-center rounded-lg border border-blue-100 bg-white p-3 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={category.logo} alt={category.name} className="max-h-20 max-w-full object-contain" />
              </div>
            ) : null}
            <div>
              <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{recipe.category}</span>
              <h2 className="mt-3 text-3xl font-black text-zinc-950">{recipe.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">Priorite aux prix Marjane. Aucun achat n&apos;est valide depuis les recettes.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={addToCaisse} disabled={isLoading} className="h-12 rounded-lg bg-blue-600 px-5 font-black text-white transition hover:bg-blue-700 disabled:bg-zinc-300">
              Ajouter a la caisse
            </button>
            <button type="button" onClick={() => void saveForLater()} disabled={isLoading || isSaving} className="h-12 rounded-lg bg-emerald-500 px-5 font-black text-black transition hover:bg-emerald-400 disabled:bg-zinc-300">
              Ajouter aux besoins
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase text-blue-600">Portions</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {servingOptions.map((option) => (
              <button key={option} type="button" onClick={() => setServings(option)} className={`h-12 rounded-lg border text-base font-black ${servings === option ? "border-blue-600 bg-blue-600 text-white" : "border-blue-100 bg-white text-zinc-800"}`}>
                {option}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-blue-50 p-4">
            <p className="text-xs font-black uppercase text-blue-700">Cout estime</p>
            <p className="mt-1 text-3xl font-black text-zinc-950">{formatCaissePrice(estimatedTotal)}</p>
            <p className="mt-2 text-sm font-black text-blue-800">
              {recipe.categorySlug === "bebe" ? "Par portion bebe" : "Par personne"} : {formatCaissePrice(costPerServing)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black text-zinc-950">Prix Marjane par ingredient</h3>
          <div className="mt-4 divide-y divide-zinc-100">
            {choices.map((choice) => (
              <div key={choice.ingredient.name} className="grid gap-4 py-4 xl:grid-cols-[1fr_1.3fr_160px] xl:items-start">
                <div>
                  <p className="font-black text-zinc-950">{choice.ingredient.name}</p>
                  <p className="text-sm text-zinc-500">{choice.scaledQuantity.toFixed(choice.scaledQuantity % 1 === 0 ? 0 : 1)} {choice.ingredient.unit}</p>
                </div>
                <div className="space-y-2">
                  {choice.product ? (
                    <>
                      <p className="font-semibold text-zinc-800">{choice.product.name}</p>
                      <p className="text-sm text-zinc-500">{choice.product.store} - {formatCaissePrice(choice.product.price)} / {choice.product.unit}</p>
                      {choice.warning ? <p className="text-xs font-bold text-amber-700">{choice.warning}</p> : null}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-amber-700">Produit a choisir</p>
                  )}
                  <label className="block">
                    <span className="text-xs font-black uppercase text-blue-700">Choisir produit Marjane</span>
                    <select
                      value={choice.product?.store === "Marjane" ? choice.product.id : selectedProducts[choice.ingredient.name] ?? ""}
                      onChange={(event) => void chooseProduct(choice.ingredient.name, event.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-blue-500"
                    >
                      <option value="">Produit Marjane</option>
                      {marjaneProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {formatCaissePrice(product.price)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="text-left xl:text-right">
                  <p className="text-xs font-bold uppercase text-zinc-400">Cout calcule</p>
                  <p className="text-lg font-black text-zinc-950">{choice.cost === null ? "-" : formatCaissePrice(choice.cost)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-zinc-950">Variantes automatiques</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {variants.map((variant) => (
            <div key={variant.title} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="font-black text-emerald-950">{variant.title}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">{variant.tags.join(", ")}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-zinc-950">Preparation</h3>
        <ol className="mt-4 space-y-3">
          {recipe.steps.map((step, index) => (
            <li key={step} className="rounded-lg bg-zinc-50 p-3 text-sm font-semibold text-zinc-700">
              {index + 1}. {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
