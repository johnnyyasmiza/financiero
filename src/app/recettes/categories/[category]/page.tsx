import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RecipeCategoryClient } from "@/components/recipes/RecipeCategoryClient";
import { getRecipeCategory, getRecipesByCategory } from "@/lib/recipes";

export default async function RecipeCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = getRecipeCategory(slug);

  if (!category) {
    notFound();
  }

  return (
    <AppShell title={category.name} subtitle="Choisissez une recette puis ajoutez ses ingredients a la caisse ou aux besoins.">
      <RecipeCategoryClient category={category} recipes={getRecipesByCategory(slug)} />
    </AppShell>
  );
}
