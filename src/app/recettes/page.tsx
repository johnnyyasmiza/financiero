import { AppShell } from "@/components/AppShell";
import { RecipesListClient } from "@/components/recipes/RecipesListClient";

export default function RecettesPage() {
  return (
    <AppShell title="Recettes" subtitle="Composez vos repas et transformez les ingredients en panier de courses.">
      <RecipesListClient />
    </AppShell>
  );
}
