import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RecipeCategoryClient } from "@/components/recipes/RecipeCategoryClient";
import { RecipeDetailClient } from "@/components/recipes/RecipeDetailClient";
import { getRecipe, getRecipeCategory, getRecipesByCategory } from "@/lib/recipes";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = getRecipe(id);

  if (!recipe) {
    const category = getRecipeCategory(id);

    if (!category) {
      notFound();
    }

    return (
      <AppShell title={category.name} subtitle="Choisissez une recette puis preparez-la avec le stock du frigo.">
        <RecipeCategoryClient category={category} recipes={getRecipesByCategory(id)} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Recette" subtitle="Cout, meilleur magasin et panier prepare depuis les produits importes.">
      <RecipeDetailClient recipe={recipe} />
    </AppShell>
  );
}
