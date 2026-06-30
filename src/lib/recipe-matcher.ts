import { calculatePricePerBaseUnit, extractUnitInfo } from "@/lib/price-comparison";
import type { Recipe, RecipeIngredient } from "@/lib/recipes";
import type { ShoppingProduct } from "@/lib/shopping-catalog";

export type RecipeMatch = {
  product: ShoppingProduct | null;
  score: number;
  productQuantity: number;
  cost: number | null;
  warning: string | null;
  candidates: ShoppingProduct[];
};

export type RecipeCostLine = RecipeMatch & {
  ingredient: RecipeIngredient;
  scaledQuantity: number;
};

const storePriority = ["Marjane", "Carrefour", "Boucherie Amsterdam", "HRI", "Swika"];
const uselessWords = new Set(["filiere", "m", "frais", "fraiche", "rond", "ronde", "blanche", "blanc", "rouge", "barquette", "paquet"]);

const synonymPairs: Array<[RegExp, string]> = [
  [/\bpommes?\s+de\s+terre\b/g, "patate"],
  [/\bpatates?\b/g, "patate"],
  [/\bb[œoe]+uf\b/g, "boeuf"],
  [/\bviande\s+boeuf\b/g, "boeuf"],
  [/\bviande\s+hachee\b/g, "viande hachee"],
  [/\bvolaille\b/g, "poulet"],
  [/\btomates?\b/g, "tomate"],
  [/\boignons?\b/g, "oignon"],
  [/\bcarottes?\b/g, "carotte"],
  [/\bcourgettes?\b/g, "courgette"],
  [/\bspaghetti\b/g, "pates"],
  [/\bpenne\b/g, "pates"],
  [/\bmacaroni\b/g, "pates"],
  [/\briz\s+blanc\b/g, "riz"],
  [/\bfromage\s+rape\b/g, "fromage"],
  [/\bpommes?\b/g, "pomme"],
  [/\bbananes?\b/g, "banane"],
  [/\boranges?\b/g, "orange"],
  [/\bcitrons?\b/g, "citron"],
];

export function normalizeText(text: string) {
  let normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|grammes?|ml|cl|l|litres?|pieces?|pcs?|unites?)\b/g, " ")
    .replace(/[^\w\s]/g, " ");

  synonymPairs.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized
    .split(/\s+/)
    .map((word) => word.replace(/s$/, ""))
    .filter((word) => word && !uselessWords.has(word))
    .sort()
    .join(" ");
}

export const normalizeRecipeProductName = normalizeText;

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(/\s+/).filter(Boolean));
}

function matchScore(ingredientName: string, productName: string) {
  const ingredientTokens = tokenSet(ingredientName);
  const productTokens = tokenSet(productName);

  if (ingredientTokens.size === 0 || productTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  ingredientTokens.forEach((token) => {
    if (productTokens.has(token)) {
      intersection += 1;
    }
  });

  const coverage = intersection / ingredientTokens.size;
  const precision = intersection / productTokens.size;
  return coverage * 0.8 + precision * 0.2;
}

function storeRank(store: string) {
  const rank = storePriority.indexOf(store);
  return rank === -1 ? 99 : rank;
}

function getProductBase(product: ShoppingProduct) {
  const info = extractUnitInfo(product.name, product.unit);
  const quantity = product.unitQuantity ?? info.quantity;
  const baseUnit = product.unitBase ?? info.baseUnit;
  const pricePerBaseUnit = product.pricePerBaseUnit ?? calculatePricePerBaseUnit(product.price, quantity, baseUnit);
  return { quantity, baseUnit, pricePerBaseUnit };
}

function getIngredientBase(ingredient: RecipeIngredient) {
  const info = extractUnitInfo(`${ingredient.quantity} ${ingredient.unit}`, ingredient.unit);
  return { quantity: info.quantity, baseUnit: info.baseUnit };
}

export function matchRecipeIngredientToProduct(ingredientName: string, products: ShoppingProduct[]) {
  return products
    .map((product) => ({ product, score: matchScore(ingredientName, product.name) }))
    .filter((row) => row.score >= 0.5)
    .sort((first, second) => {
      const byStore = storeRank(first.product.store) - storeRank(second.product.store);
      if (byStore !== 0) return byStore;
      return second.score - first.score;
    });
}

export function getBestProductForIngredient(ingredientName: string, products: ShoppingProduct[]) {
  return matchRecipeIngredientToProduct(ingredientName, products)[0]?.product ?? null;
}

export function calculateIngredientCost(ingredient: RecipeIngredient, product: ShoppingProduct | null): RecipeMatch {
  if (!product) {
    return { product: null, score: 0, productQuantity: 0, cost: null, warning: "Produit a choisir", candidates: [] };
  }

  const ingredientBase = getIngredientBase(ingredient);
  const productBase = getProductBase(product);

  if (ingredientBase.quantity && ingredientBase.baseUnit && productBase.baseUnit === ingredientBase.baseUnit && productBase.pricePerBaseUnit) {
    return {
      product,
      score: matchScore(ingredient.name, product.name),
      productQuantity: productBase.quantity ? Math.max(1, Math.ceil(ingredientBase.quantity / productBase.quantity)) : 1,
      cost: productBase.pricePerBaseUnit * ingredientBase.quantity,
      warning: null,
      candidates: [],
    };
  }

  if (product.price && product.price > 0) {
    return {
      product,
      score: matchScore(ingredient.name, product.name),
      productQuantity: 1,
      cost: product.price,
      warning: "Prix brut utilise : price_per_base_unit indisponible ou unite non comparable.",
      candidates: [],
    };
  }

  return {
    product,
    score: matchScore(ingredient.name, product.name),
    productQuantity: 0,
    cost: null,
    warning: "Prix indisponible.",
    candidates: [],
  };
}

export function calculateRecipeCost(recipe: Recipe, ingredients: RecipeIngredient[], products: ShoppingProduct[]) {
  const lines = ingredients.map<RecipeCostLine>((ingredient) => {
    const matches = matchRecipeIngredientToProduct(ingredient.name, products);
    const product = matches[0]?.product ?? null;
    const cost = calculateIngredientCost(ingredient, product);
    return {
      ...cost,
      ingredient,
      scaledQuantity: ingredient.quantity,
      candidates: matches.map((match) => match.product),
    };
  });
  const total = lines.reduce((sum, line) => sum + (line.cost ?? 0), 0);

  return {
    recipe,
    lines,
    total,
    perServing: total / Math.max(recipe.baseServings, 1),
  };
}

export function findRecipeCandidates(ingredient: RecipeIngredient, products: ShoppingProduct[]) {
  return matchRecipeIngredientToProduct(ingredient.name, products).map((row) => row.product);
}

export function matchRecipeIngredient(ingredient: RecipeIngredient, scaledQuantity: number, products: ShoppingProduct[]): RecipeMatch {
  const scaled = { ...ingredient, quantity: scaledQuantity };
  const matches = matchRecipeIngredientToProduct(ingredient.name, products);
  const best = matches[0];

  if (!best || best.score < 0.65) {
    return { product: null, score: best?.score ?? 0, productQuantity: 0, cost: null, warning: "Produit a choisir", candidates: matches.map((row) => row.product) };
  }

  return { ...calculateIngredientCost(scaled, best.product), candidates: matches.map((row) => row.product) };
}
