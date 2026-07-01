import { addExpense } from "@/lib/finance-db";
import {
  addFridgeItem,
  consumeFridgeItem,
  normalizeUnit,
  type FridgeRecipeIngredient,
  type FridgeUnit,
} from "@/lib/fridge";
import { prepareRecipe } from "@/lib/prepare-recipe";
import { addOrIncrementNeed } from "@/lib/shopping-catalog";
import { getTodayDate } from "@/lib/utils";

export type RecipeTemplate = {
  id: string;
  name: string;
  ingredients: Array<FridgeRecipeIngredient & { estimatedPrice?: number }>;
};

export type AutomationResult = {
  message: string;
  amount?: number;
  category?: string;
  name?: string;
  sourceType?: "purchase" | "receipt" | "voice" | "recipe_cost_internal";
  addedToFridge?: boolean;
  missing?: FridgeRecipeIngredient[];
};

export const PREDEFINED_RECIPES: RecipeTemplate[] = [
  {
    id: "tajine-poulet",
    name: "Tajine poulet",
    ingredients: [
      { name: "Poulet", amount: 1, unit: "kg" },
      { name: "Tomate", amount: 2, unit: "piece" },
      { name: "Pomme de terre", amount: 500, unit: "g" },
      { name: "Oignon", amount: 1, unit: "piece" },
      { name: "Huile", amount: 50, unit: "ml" },
      { name: "Epices", amount: 10, unit: "g" },
    ],
  },
  { id: "tajine-viande", name: "Tajine viande", ingredients: [{ name: "Viande", amount: 1, unit: "kg" }, { name: "Tomate", amount: 2, unit: "piece" }, { name: "Oignon", amount: 1, unit: "piece" }, { name: "Huile", amount: 50, unit: "ml" }] },
  { id: "pates-tomate", name: "Pates tomate", ingredients: [{ name: "Pates", amount: 250, unit: "g" }, { name: "Tomate", amount: 3, unit: "piece" }, { name: "Huile", amount: 25, unit: "ml" }] },
  { id: "salade-marocaine", name: "Salade marocaine", ingredients: [{ name: "Tomate", amount: 3, unit: "piece" }, { name: "Oignon", amount: 1, unit: "piece" }, { name: "Huile", amount: 20, unit: "ml" }] },
  { id: "omelette", name: "Omelette", ingredients: [{ name: "Oeufs", amount: 3, unit: "piece" }, { name: "Huile", amount: 10, unit: "ml" }] },
  { id: "pizza-maison", name: "Pizza maison", ingredients: [{ name: "Farine", amount: 300, unit: "g" }, { name: "Tomate", amount: 2, unit: "piece" }, { name: "Fromage", amount: 150, unit: "g" }] },
  { id: "couscous", name: "Couscous", ingredients: [{ name: "Semoule", amount: 500, unit: "g" }, { name: "Viande", amount: 1, unit: "kg" }, { name: "Oignon", amount: 1, unit: "piece" }] },
  { id: "sandwich", name: "Sandwich", ingredients: [{ name: "Pain", amount: 1, unit: "piece" }, { name: "Fromage", amount: 1, unit: "piece" }, { name: "Tomate", amount: 1, unit: "piece" }] },
  { id: "harira", name: "Harira", ingredients: [{ name: "Tomate", amount: 4, unit: "piece" }, { name: "Farine", amount: 80, unit: "g" }, { name: "Oignon", amount: 1, unit: "piece" }] },
  { id: "jus", name: "Jus", ingredients: [{ name: "Orange", amount: 4, unit: "piece" }, { name: "Sucre", amount: 20, unit: "g" }] },
];

const foodWords = [
  "tomate", "pomme de terre", "oignon", "lait", "yaourt", "danone", "viande", "poulet", "poisson",
  "pates", "pate", "riz", "huile", "sucre", "cafe", "farine", "oeuf", "oeufs", "pain", "fromage",
  "orange", "semoule",
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.trim().split(/\s+/).map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ");
}

function cleanProductName(value: string) {
  return normalize(value)
    .replace(/\b(?:j ai|jai|achete|achetee|acheter|achat|de|du|des|le|la|les|un|une|au|aux|dans|frigo|dh|dhs|dirham|dirhams|mad)\b/g, " ")
    .replace(/\b\d{1,7}(?:[.,]\d{1,2})?\s*(?:kg|kilo|kilos|g|gr|gramme|grammes|l|litre|litres|ml|piece|pieces|paquet|paquets|pack)\b/g, " ")
    .replace(/\b\d{1,7}(?:[.,]\d{1,2})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFoodProduct(name: string) {
  const normalized = normalize(name);
  return foodWords.some((word) => normalized.includes(word));
}

export function inferExpenseCategory(name: string) {
  const normalized = normalize(name);
  if (/\b(?:cigarette|tabac)\b/.test(normalized)) return "Tabac";
  if (/\b(?:essence|gasoil|diesel|shell|afriquia|total)\b/.test(normalized)) return "Carburant";
  if (/\b(?:internet|iam|orange|inwi|maroc telecom)\b/.test(normalized)) return "Telecom";
  if (/\bpharmacie\b/.test(normalized)) return "Sante";
  if (/\b(?:restaurant|cafe|snack)\b/.test(normalized)) return "Restauration";
  if (isFoodProduct(normalized)) return "Courses";
  return "Divers";
}

function inferFridgeCategory(name: string) {
  const normalized = normalize(name);
  if (/\b(?:lait|danone|yaourt|fromage|oeuf|oeufs)\b/.test(normalized)) return "frais";
  if (/\b(?:eau|coca|jus|orange)\b/.test(normalized)) return "boisson";
  if (/\b(?:poulet|viande)\b/.test(normalized)) return "viande";
  if (/\bpoisson\b/.test(normalized)) return "poisson";
  if (/\b(?:pates|pate|riz|huile|sucre|cafe|farine|semoule)\b/.test(normalized)) return "epicerie";
  return "autre";
}

export function getRecipeById(recipeId: string) {
  const normalized = normalize(recipeId);
  return PREDEFINED_RECIPES.find((recipe) => recipe.id === recipeId || normalize(recipe.name).includes(normalized) || normalized.includes(normalize(recipe.name))) ?? null;
}

function parsePurchase(input: string) {
  const priceMatches = Array.from(input.matchAll(/\b(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:dh|dhs|dirham|dirhams|mad)\b/gi));
  const priceMatch = priceMatches.at(-1);
  if (!priceMatch || priceMatch.index === undefined) return null;

  const amount = Number(priceMatch[1].replace(",", "."));
  const beforePrice = input.slice(0, priceMatch.index);
  const weightMatch = beforePrice.match(/\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(kg|kilo|kilos|g|gr|gramme|grammes|l|litre|litres|ml)\b/i);
  const piecesMatch = beforePrice.match(/\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:piece|pieces|piece?s|paquet|paquets|pack)\b/i);
  const name = titleCase(cleanProductName(beforePrice));
  if (!name || !Number.isFinite(amount)) return null;

  return {
    name,
    amount,
    quantityWeight: weightMatch ? Number(weightMatch[1].replace(",", ".")) : undefined,
    unit: (weightMatch?.[2] ?? "piece") as FridgeUnit,
    quantityPieces: piecesMatch ? Number(piecesMatch[1].replace(",", ".")) : undefined,
  };
}

export async function handleFoodPurchase(input: string): Promise<AutomationResult> {
  const purchase = parsePurchase(input);
  if (!purchase) throw new Error("Achat alimentaire non reconnu.");

  await addExpense({
    amount: purchase.amount,
    merchant: purchase.name,
    category: "Courses",
    payment: "A verifier",
    note: `sourceType: voice\nAchat alimentaire: ${input}`,
    date: getTodayDate(),
  });

  const item = await addFridgeItem({
    name: purchase.name,
    category: inferFridgeCategory(purchase.name),
    quantityWeight: purchase.quantityWeight,
    quantityPieces: purchase.quantityPieces ?? (!purchase.quantityWeight ? 1 : undefined),
    unit: purchase.unit,
    totalPrice: purchase.amount,
    purchaseDate: getTodayDate(),
  });

  return { message: `Depense ajoutee et ${item.name} ajoute au frigo`, amount: purchase.amount, category: "Courses", name: item.name, sourceType: "voice", addedToFridge: true };
}

export async function handleNonFoodExpense(input: string): Promise<AutomationResult> {
  const purchase = parsePurchase(input);
  if (!purchase) throw new Error("Depense non reconnue.");
  const category = inferExpenseCategory(purchase.name);

  await addExpense({
    amount: purchase.amount,
    merchant: purchase.name,
    category,
    payment: "A verifier",
    note: `sourceType: voice\nAchat: ${input}`,
    date: getTodayDate(),
  });

  return { message: `Depense ajoutee : ${purchase.amount} DH ${purchase.name}`, amount: purchase.amount, category, name: purchase.name, sourceType: "voice", addedToFridge: false };
}

export async function handlePurchase(input: string): Promise<AutomationResult> {
  const purchase = parsePurchase(input);
  if (!purchase) throw new Error("Achat non reconnu.");
  return isFoodProduct(purchase.name) ? handleFoodPurchase(input) : handleNonFoodExpense(input);
}

export async function handleConsumeStock(input: string): Promise<AutomationResult> {
  const normalized = normalize(input);
  const match = normalized.match(/\b(?:pris|prend|prends|mange|mangee|enleve|enlever|retire|retirer)\b\s+(?:(un|une|\d{1,5}(?:[.,]\d{1,2})?)\s*)?(kg|kilo|kilos|g|gramme|grammes|l|litre|litres|ml|piece|pieces)?(?:\s+de)?\s+(.+)$/);
  if (!match) throw new Error("Consommation non reconnue.");

  const amount = match[1] && !/un|une/.test(match[1]) ? Number(match[1].replace(",", ".")) : 1;
  const unit = match[2] ?? "piece";
  const name = titleCase(cleanProductName(match[3]));
  const result = await consumeFridgeItem(name, amount, unit);
  return { message: `${result.item.name} retire du frigo${result.alert ? `. ${result.alert}` : ""}`, name: result.item.name, sourceType: "voice" };
}

export async function handleNeed(input: string): Promise<AutomationResult> {
  const cleaned = normalize(input)
    .replace(/\b(?:ajoute|ajouter|besoin|besoins|aux|au|dans|il me faut|me faut|de|du|des|le|la|les|un|une)\b/g, " ")
    .replace(/\s+et\s+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  const items = cleaned.split(/[,;]/).map((item) => titleCase(item.trim())).filter(Boolean);
  await Promise.all(items.map((name) => addOrIncrementNeed({ productId: null, store: "Vocal", category: "Courses", name, imageUrl: null, unit: "piece", quantity: 1, unitPrice: null, total: null })));
  return { message: `${items.length === 1 ? items[0] : `${items.length} articles`} ajoute aux besoins`, sourceType: "voice" };
}

export async function handlePrepareRecipe(recipeId: string): Promise<AutomationResult> {
  const result = await prepareRecipe(recipeId);
  return {
    message: result.message,
    missing: result.missing.map((line) => ({ name: line.name, amount: line.missing, unit: line.unit })),
    sourceType: "recipe_cost_internal",
  };
}

export async function addFoodPurchaseToFridge(input: { name: string; quantity: number; unit: string; totalPrice: number }) {
  if (!isFoodProduct(input.name)) return null;
  const normalized = normalizeUnit(input.quantity, input.unit);
  return addFridgeItem({
    name: input.name,
    category: inferFridgeCategory(input.name),
    quantityWeight: normalized.unit === "g" || normalized.unit === "ml" ? input.quantity : undefined,
    quantityPieces: normalized.unit === "piece" || normalized.unit === "pack" ? input.quantity : undefined,
    unit: input.unit,
    totalPrice: input.totalPrice,
    purchaseDate: getTodayDate(),
  });
}
