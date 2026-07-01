import { seedRecipes } from "@/lib/recipes/seed-recipes";
import { calculateRecipeCost as calculateInventoryRecipeCost, prepareRecipe as prepareInventoryRecipe } from "@/lib/fridge";
import type { FridgeRecipeCost as RecipeCostResult, FridgeRecipeIngredient as RecipeIngredientInput, FridgeUnit } from "@/lib/fridge";

export type RecipeIngredient = {
  name: string;
  quantity: number;
  unit: string;
};

export type Recipe = {
  id: string;
  title: string;
  category: string;
  categorySlug: string;
  subcategory?: string;
  baseServings: number;
  minutes?: number;
  tags?: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
};

export type RecipeCategory = {
  name: string;
  slug: string;
  logo: string;
  accent: string;
  bg: string;
};

export type HouseRecipe = {
  id: string;
  name: string;
  portions: number;
  ingredients: RecipeIngredientInput[];
  createdAt: string;
  updatedAt: string;
};

export type HouseRecipeInput = {
  name: string;
  portions: number;
  ingredients: RecipeIngredientInput[];
};

export const recipeCategories: RecipeCategory[] = [
  { name: "Tajines", slug: "tajine", logo: "/logo/tajine.png", accent: "border-yellow-500", bg: "from-yellow-50 to-white" },
  { name: "Pates", slug: "pates", logo: "/logo/pates.png", accent: "border-emerald-500", bg: "from-emerald-50 to-white" },
  { name: "Poulet", slug: "poulet", logo: "/logo/poulet.png", accent: "border-red-400", bg: "from-red-50 to-white" },
  { name: "Viande", slug: "viande", logo: "/logo/viande.png", accent: "border-red-600", bg: "from-red-50 to-white" },
  { name: "Poisson", slug: "poisson", logo: "/logo/poisson.png", accent: "border-blue-500", bg: "from-blue-50 to-white" },
  { name: "Salades", slug: "salade", logo: "/logo/salade.png", accent: "border-emerald-500", bg: "from-emerald-50 to-white" },
  { name: "Rapide", slug: "rapide", logo: "/logo/recette%20rapide.png", accent: "border-yellow-400", bg: "from-yellow-50 to-white" },
  { name: "Bebe", slug: "bebe", logo: "/logo/recettebebe.png", accent: "border-blue-400", bg: "from-blue-50 to-white" },
  { name: "Pizza", slug: "pizza", logo: "/logo/pizza.png", accent: "border-red-500", bg: "from-red-50 to-white" },
  { name: "Jus", slug: "jus", logo: "/logo/jus.png", accent: "border-emerald-400", bg: "from-emerald-50 to-white" },
  { name: "Asiatique", slug: "asiatique", logo: "/logo/asiatique.png", accent: "border-yellow-500", bg: "from-yellow-50 to-white" },
];

export const servingOptions = [1, 2, 4, 6, 8];
export const recipes: Recipe[] = seedRecipes;
const HOUSE_RECIPES_STORAGE_KEY = "financiero:house-recipes";
const HOUSE_RECIPES_EVENT = "financiero-house-recipes-change";

export function getRecipe(id: string) {
  return recipes.find((recipe) => recipe.id === id) ?? null;
}

export function getRecipeCategory(slug: string) {
  const aliases: Record<string, string> = {
    tajines: "tajine",
    salades: "salade",
    "recette-rapide": "rapide",
    "recette-bebe": "bebe",
  };
  const normalizedSlug = aliases[slug] ?? slug;
  return recipeCategories.find((category) => category.slug === normalizedSlug) ?? null;
}

export function getRecipesByCategory(slug: string) {
  const aliases: Record<string, string> = {
    tajines: "tajine",
    salades: "salade",
    "recette-rapide": "rapide",
    "recette-bebe": "bebe",
  };
  const normalizedSlug = aliases[slug] ?? slug;

  if (slug === "all") {
    return recipes;
  }

  return recipes.filter((recipe) => recipe.categorySlug === normalizedSlug);
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyHouseRecipesChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HOUSE_RECIPES_EVENT));
  }
}

function readHouseRecipes() {
  if (!canUseStorage()) {
    return [] as HouseRecipe[];
  }

  try {
    return JSON.parse(window.localStorage.getItem(HOUSE_RECIPES_STORAGE_KEY) ?? "[]") as HouseRecipe[];
  } catch {
    return [];
  }
}

function writeHouseRecipes(items: HouseRecipe[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(HOUSE_RECIPES_STORAGE_KEY, JSON.stringify(items));
  notifyHouseRecipesChange();
}

export function subscribeToHouseRecipes(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(HOUSE_RECIPES_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(HOUSE_RECIPES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getHouseRecipes() {
  return readHouseRecipes().sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export function addHouseRecipe(input: HouseRecipeInput) {
  const now = new Date().toISOString();
  const recipe: HouseRecipe = {
    id: createId(),
    name: input.name.trim(),
    portions: Number(input.portions),
    ingredients: input.ingredients.map((ingredient) => ({
      name: ingredient.name.trim(),
      amount: Number(ingredient.amount),
      unit: ingredient.unit as FridgeUnit,
    })),
    createdAt: now,
    updatedAt: now,
  };

  writeHouseRecipes([recipe, ...readHouseRecipes()]);
  return recipe;
}

export function deleteHouseRecipe(id: string) {
  writeHouseRecipes(readHouseRecipes().filter((recipe) => recipe.id !== id));
}

export function calculateRecipeCost(recipe: HouseRecipe): RecipeCostResult {
  return calculateInventoryRecipeCost(recipe.ingredients);
}

export function prepareRecipe(recipe: HouseRecipe): RecipeCostResult {
  return prepareInventoryRecipe(recipe.ingredients).cost;
}
