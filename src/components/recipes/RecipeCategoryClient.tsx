"use client";

import Link from "next/link";
import { useState } from "react";
import { prepareRecipe } from "@/lib/prepare-recipe";
import { type Recipe, type RecipeCategory } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export function RecipeCategoryClient({ category, recipes }: { category: RecipeCategory; recipes: Recipe[] }) {
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function prepareFromCard(recipeId: string) {
    setPreparingId(recipeId);
    setMessage("");
    setError("");

    try {
      const result = await prepareRecipe(recipeId);
      setMessage(result.message);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Impossible de preparer la recette.");
    } finally {
      setPreparingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className={cn("rounded-lg border-2 bg-gradient-to-br p-5 shadow-sm", category.accent, category.bg)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-24 place-items-center rounded-lg bg-white p-3 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={category.logo} alt={category.name} className="max-h-20 max-w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-black uppercase text-blue-700">Recettes</p>
              <h2 className="text-3xl font-black text-zinc-950">{category.name}</h2>
              <p className="mt-1 text-sm font-semibold text-zinc-600">{recipes.length} recette(s) disponible(s)</p>
            </div>
          </div>
          <Link href="/recettes" className="inline-flex h-12 items-center justify-center rounded-lg border border-blue-200 bg-white px-5 font-black text-blue-800 transition hover:border-blue-500">
            Retour categories
          </Link>
        </div>
      </section>

      {error ? <p className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recipes.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-black text-zinc-950">Aucune recette dans cette categorie</p>
            <p className="mt-2 text-sm text-zinc-500">Ajoutez une recette depuis le bouton Nouvelle recette.</p>
          </div>
        ) : null}
        {recipes.map((recipe) => (
          <article key={recipe.id} className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg">
            <Link href={`/recettes/${recipe.id}`} className="block active:scale-[0.98]">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{recipe.category}</span>
              <span className="text-xs font-black text-zinc-400">{recipe.baseServings} pers.</span>
            </div>
            <h3 className="mt-4 text-xl font-black text-zinc-950">{recipe.title}</h3>
            <p className="mt-2 text-sm text-zinc-500">{recipe.ingredients.length} ingredients</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {recipe.ingredients.slice(0, 4).map((ingredient) => (
                <span key={ingredient.name} className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-600">
                  {ingredient.name}
                </span>
              ))}
            </div>
            </Link>
            <button type="button" onClick={() => void prepareFromCard(recipe.id)} disabled={preparingId === recipe.id} className="mt-4 h-11 w-full rounded-lg bg-amber-400 px-4 text-sm font-black text-black transition hover:bg-amber-300 disabled:bg-zinc-300">
              {preparingId === recipe.id ? "Preparation..." : "Préparer"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
