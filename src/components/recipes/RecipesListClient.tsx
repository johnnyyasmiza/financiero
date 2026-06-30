"use client";

import Link from "next/link";
import { useState } from "react";
import { recipeCategories, getRecipesByCategory } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export function RecipesListClient() {
  const [seedResult, setSeedResult] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);

  async function seedCatalogue() {
    setIsSeeding(true);
    setSeedResult("");

    try {
      const response = await fetch("/api/recipes/seed", { method: "POST" });
      const payload = (await response.json()) as { created: number; skipped: number; total: number; errors?: string[] };
      setSeedResult(`${payload.created} creees, ${payload.skipped} deja existantes, ${payload.total} recettes catalogue.${payload.errors?.length ? ` ${payload.errors.length} erreur(s).` : ""}`);
    } catch (error) {
      setSeedResult(error instanceof Error ? error.message : "Impossible de generer le catalogue recettes.");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">Recettes</p>
            <h2 className="mt-1 text-3xl font-black text-zinc-950">Choisir une categorie</h2>
            <p className="mt-2 text-sm text-zinc-500">Catalogue relie aux produits, a la caisse et aux besoins.</p>
          </div>
          <button type="button" onClick={() => void seedCatalogue()} disabled={isSeeding} className="h-11 rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-800 transition hover:border-blue-500 disabled:text-zinc-400">
            {isSeeding ? "Generation..." : "Generer catalogue recettes"}
          </button>
        </div>
        {seedResult ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{seedResult}</p> : null}
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {recipeCategories.map((category) => (
          <Link
            key={category.slug}
            href={`/recettes/categories/${category.slug}`}
            className={cn("min-h-56 rounded-lg border-2 bg-gradient-to-br p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]", category.accent, category.bg)}
          >
            <div className="grid h-32 place-items-center rounded-lg bg-white p-3 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={category.logo} alt={category.name} className="max-h-28 max-w-full object-contain" />
            </div>
            <p className="mt-4 text-lg font-black text-zinc-950">{category.name}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">{getRecipesByCategory(category.slug).length} recettes</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
