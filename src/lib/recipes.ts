import { seedRecipes } from "@/lib/recipes/seed-recipes";

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
