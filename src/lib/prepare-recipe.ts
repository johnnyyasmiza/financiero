import {
  consumeFridgeItemById,
  findFridgeItem,
  getFridgeItems,
  loadFridgeItems,
  normalizeUnit,
  type FridgeRecipeIngredient,
} from "@/lib/fridge";
import { getRecipe, recipes, type Recipe } from "@/lib/recipes";
import { addOrIncrementNeed } from "@/lib/shopping-catalog";

export type PreparedRecipeIngredient = {
  name: string;
  requested: number;
  unit: string;
  consumed: number;
  missing: number;
};

export type PrepareRecipeResult = {
  recipe: Recipe;
  consumed: PreparedRecipeIngredient[];
  missing: PreparedRecipeIngredient[];
  message: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferNeedCategory(name: string) {
  const normalized = normalizeText(name);
  if (/\b(?:tomate|pomme|patate|oignon|salade|carotte)\b/.test(normalized)) return "Legumes";
  if (/\b(?:orange|banane|fraise|jus)\b/.test(normalized)) return "Fruits";
  if (/\b(?:poulet|dinde|volaille)\b/.test(normalized)) return "Volaille";
  if (/\b(?:viande|boeuf|kefta)\b/.test(normalized)) return "Viande";
  if (/\b(?:fromage|lait|yaourt|danone|oeuf)\b/.test(normalized)) return "Fromage";
  return "Epicerie";
}

function resolveRecipe(recipeId: string) {
  const direct = getRecipe(recipeId);
  if (direct) return direct;

  const normalized = normalizeText(recipeId);
  return (
    recipes.find((recipe) => normalizeText(recipe.id) === normalized) ??
    recipes.find((recipe) => normalizeText(recipe.title) === normalized) ??
    recipes.find((recipe) => normalizeText(recipe.title).includes(normalized) || normalized.includes(normalizeText(recipe.title))) ??
    null
  );
}

function scaleIngredients(recipe: Recipe, servings?: number): FridgeRecipeIngredient[] {
  const factor = servings && servings > 0 ? servings / recipe.baseServings : 1;
  return recipe.ingredients.map((ingredient) => ({
    name: ingredient.name,
    amount: ingredient.quantity * factor,
    unit: ingredient.unit,
  }));
}

function getAvailableQuantity(item: ReturnType<typeof getFridgeItems>[number]) {
  return item.remainingQuantity ?? item.totalQuantity ?? (item.quantity ?? 1) * (item.unitQuantity ?? 1);
}

export async function prepareRecipe(recipeId: string, options: { servings?: number } = {}): Promise<PrepareRecipeResult> {
  const recipe = resolveRecipe(recipeId);
  if (!recipe) {
    throw new Error("Recette introuvable.");
  }

  await loadFridgeItems();

  const consumed: PreparedRecipeIngredient[] = [];
  const missing: PreparedRecipeIngredient[] = [];

  for (const ingredient of scaleIngredients(recipe, options.servings)) {
    const normalized = normalizeUnit(ingredient.amount, ingredient.unit);
    const item = findFridgeItem(ingredient.name, getFridgeItems());
    const available = item ? getAvailableQuantity(item) : 0;
    const consumedAmount = item ? Math.min(available, normalized.value) : 0;
    const missingAmount = Math.max(normalized.value - consumedAmount, 0);

    if (item && consumedAmount > 0) {
      await consumeFridgeItemById(item.id, consumedAmount, normalized.unit);
    }

    const line = {
      name: ingredient.name,
      requested: normalized.value,
      unit: normalized.unit,
      consumed: consumedAmount,
      missing: missingAmount,
    };

    if (consumedAmount > 0) {
      consumed.push(line);
    }

    if (missingAmount > 0) {
      missing.push(line);
      await addOrIncrementNeed({
        productId: null,
        store: "Recette",
        category: inferNeedCategory(ingredient.name),
        name: ingredient.name,
        imageUrl: null,
        unit: normalized.unit,
        quantity: missingAmount,
        unitPrice: null,
        total: null,
      });
    }
  }

  return {
    recipe,
    consumed,
    missing,
    message: "Recette préparée, stock frigo mis à jour.",
  };
}
