"use client";

import Link from "next/link";
import { type Recipe, type RecipeCategory } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export function RecipeCategoryClient({ category, recipes }: { category: RecipeCategory; recipes: Recipe[] }) {
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recipes.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-black text-zinc-950">Aucune recette dans cette categorie</p>
            <p className="mt-2 text-sm text-zinc-500">Ajoutez une recette depuis le bouton Nouvelle recette.</p>
          </div>
        ) : null}
        {recipes.map((recipe) => (
          <Link key={recipe.id} href={`/recettes/${recipe.id}`} className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg active:scale-[0.98]">
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
        ))}
      </section>
    </div>
  );
}
