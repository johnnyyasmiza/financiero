"use client";

import Link from "next/link";
import { useState } from "react";
import { recipeCategories } from "@/lib/recipes";

export function NewRecipeClient() {
  const [message, setMessage] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Modele pret. La sauvegarde Supabase des recettes pourra etre branchee sur recipes et recipe_ingredients.");
    event.currentTarget.reset();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <Link href="/recettes" className="text-sm font-black text-blue-700">Retour recettes</Link>
        <h2 className="mt-4 text-3xl font-black text-zinc-950">Nouvelle recette</h2>
        <p className="mt-2 text-sm text-zinc-500">Structure compatible avec les futures tables recipes et recipe_ingredients.</p>
      </section>

      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-blue-100 bg-white p-5 shadow-sm lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-black text-zinc-700">Nom</span>
          <input name="title" required className="h-12 w-full rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-zinc-700">Categorie</span>
          <select name="category" className="h-12 w-full rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500">
            {recipeCategories.map((category) => (
              <option key={category.slug}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-black text-zinc-700">Portions de base</span>
          <input name="servings" type="number" min="1" defaultValue="2" className="h-12 w-full rounded-lg border border-blue-100 px-4 outline-none focus:border-blue-500" />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-black text-zinc-700">Ingredients</span>
          <textarea name="ingredients" rows={5} placeholder="Un ingredient par ligne : tomate, 2, piece" className="w-full rounded-lg border border-blue-100 p-4 outline-none focus:border-blue-500" />
        </label>
        <label className="space-y-2 lg:col-span-2">
          <span className="text-sm font-black text-zinc-700">Etapes</span>
          <textarea name="steps" rows={5} className="w-full rounded-lg border border-blue-100 p-4 outline-none focus:border-blue-500" />
        </label>
        <button type="submit" className="h-12 rounded-lg bg-blue-600 px-5 font-black text-white transition hover:bg-blue-700">
          Preparer la recette
        </button>
      </form>
    </div>
  );
}
