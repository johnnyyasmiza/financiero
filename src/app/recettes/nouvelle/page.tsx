import { AppShell } from "@/components/AppShell";
import { NewRecipeClient } from "@/components/recipes/NewRecipeClient";

export default function NouvelleRecettePage() {
  return (
    <AppShell title="Nouvelle recette" subtitle="Preparez une recette compatible avec la future sauvegarde Supabase.">
      <NewRecipeClient />
    </AppShell>
  );
}
