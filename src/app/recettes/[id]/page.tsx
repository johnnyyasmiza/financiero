import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RecipeDetailClient } from "@/components/recipes/RecipeDetailClient";
import { getRecipe } from "@/lib/recipes";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = getRecipe(id);

  if (!recipe) {
    notFound();
  }

  return (
    <AppShell title="Recette" subtitle="Cout, meilleur magasin et panier prepare depuis les produits importes.">
      <RecipeDetailClient recipe={recipe} />
    </AppShell>
  );
}
