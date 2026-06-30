import { recipes } from "@/lib/recipes";
import { normalizeRecipeName } from "@/lib/recipes/seed-recipes";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseMessage(error: unknown) {
  const value = error as { message?: string; details?: string; hint?: string; code?: string };
  return [value.message, value.details, value.hint, value.code].filter(Boolean).join("\n") || "Erreur Supabase inconnue.";
}

export async function POST() {
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const recipe of recipes) {
    const existing = await supabase
      .from("recipes")
      .select("id")
      .eq("normalized_name", normalizeRecipeName(recipe.title))
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      errors.push(`${recipe.title}: ${supabaseMessage(existing.error)}`);
      continue;
    }

    if (existing.data?.id) {
      skipped += 1;
      continue;
    }

    const inserted = await supabase
      .from("recipes")
      .insert({
        name: recipe.title,
        title: recipe.title,
        normalized_name: normalizeRecipeName(recipe.title),
        category: recipe.category,
        subcategory: recipe.subcategory ?? null,
        category_slug: recipe.categorySlug,
        slug: recipe.id,
        image_url: null,
        base_servings: recipe.baseServings,
        prep_time_minutes: Math.max(Math.round((recipe.minutes ?? 30) * 0.35), 5),
        cook_time_minutes: Math.max(Math.round((recipe.minutes ?? 30) * 0.65), 0),
        difficulty: "facile",
        minutes: recipe.minutes ?? null,
        tags: recipe.tags ?? [],
        instructions: recipe.steps,
        steps: recipe.steps,
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data?.id) {
      errors.push(`${recipe.title}: ${supabaseMessage(inserted.error)}`);
      continue;
    }

    const ingredients = recipe.ingredients.map((ingredient) => ({
      recipe_id: inserted.data.id,
      recipe_key: recipe.id,
      ingredient_name: ingredient.name,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }));
    const ingredientInsert = await supabase.from("recipe_ingredients").insert(ingredients);

    if (ingredientInsert.error) {
      errors.push(`${recipe.title} ingredients: ${supabaseMessage(ingredientInsert.error)}`);
      continue;
    }

    created += 1;
  }

  return Response.json({
    success: errors.length === 0,
    total: recipes.length,
    created,
    skipped,
    errors,
  });
}
