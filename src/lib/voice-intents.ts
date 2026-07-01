import { getRecipeById, inferExpenseCategory } from "@/lib/automationFlow";
import { addExpense } from "@/lib/finance-db";
import {
  addFridgeItem,
  consumeFridgeItemById,
  findFridgeItem,
  loadFridgeItems,
  normalizeUnit,
  type FridgeRecipeIngredient,
} from "@/lib/fridge";
import { addOrIncrementNeed } from "@/lib/shopping-catalog";
import { getTodayDate } from "@/lib/utils";

type VoiceConfidence = "high" | "medium" | "low";

export type VoiceIntent =
  | {
      type: "expense";
      text: string;
      amount: number;
      merchant: string;
      category: string;
      confidence: VoiceConfidence;
    }
  | {
      type: "fridge_add";
      text: string;
      name: string;
      quantity: number;
      unit: string;
      category: string;
      amount: number | null;
      createExpense: boolean;
      confidence: VoiceConfidence;
    }
  | {
      type: "fridge_consume";
      text: string;
      name: string;
      quantity: number;
      unit: string;
      confidence: VoiceConfidence;
    }
  | {
      type: "recipe_prepare";
      text: string;
      recipeName: string;
      confidence: VoiceConfidence;
    }
  | {
      type: "need_add";
      text: string;
      name: string;
      quantity: number;
      unit: string;
      category: string;
      confidence: VoiceConfidence;
    }
  | {
      type: "unknown";
      text: string;
      reason: string;
      confidence: "low";
    };

export type VoiceIntentResult = {
  intent: VoiceIntent;
  message: string;
};

const currencyWords = /\b(?:dh|dhs|dirham|dirhams|mad)\b/gi;
const amountWithCurrencyPattern = /\b(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:dh|dhs|dirham|dirhams|mad)\b/i;
const firstNumberPattern = /\b\d{1,7}(?:[.,]\d{1,2})?\b/;
const unitPattern = "(?:kg|kilo|kilos|kilogramme|kilogrammes|g|gr|gramme|grammes|l|litre|litres|ml|piece|pieces|paquet|paquets|boite|boites|bouteille|bouteilles)";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function toNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCurrencyAmount(input: string) {
  const match = input.match(amountWithCurrencyPattern);
  if (!match) return null;
  const amount = toNumber(match[1]);
  if (amount === null) return null;
  return {
    amount,
    before: input.slice(0, match.index).trim(),
    after: input.slice((match.index ?? 0) + match[0].length).trim(),
  };
}

function canonicalUnit(unit: string | undefined) {
  const normalized = normalizeText(unit ?? "");
  if (["kg", "kilo", "kilos", "kilogramme", "kilogrammes"].includes(normalized)) return "kg";
  if (["g", "gr", "gramme", "grammes"].includes(normalized)) return "g";
  if (["l", "litre", "litres"].includes(normalized)) return "l";
  if (normalized === "ml") return "ml";
  if (["paquet", "paquets"].includes(normalized)) return "pack";
  if (["boite", "boites", "bouteille", "bouteilles"].includes(normalized)) return "piece";
  return "piece";
}

function singularizeProduct(value: string) {
  const normalized = normalizeText(value);
  if (/\b(?:pomme de terre|pommes de terre|patate|patates)\b/.test(normalized)) return "Pomme de terre";
  if (/\b(?:oeuf|oeufs)\b/.test(normalized)) return "Oeuf";
  if (/\b(?:danone|yaourt|yaourts)\b/.test(normalized)) return "Danone";
  if (/\b(?:poulet|volaille)\b/.test(normalized)) return "Poulet";
  if (/\b(?:tomate|tomates)\b/.test(normalized)) return "Tomate";
  return titleCase(value.replace(/\s+/g, " ").trim());
}

function cleanName(value: string) {
  const cleaned = normalizeText(value)
    .replace(currencyWords, " ")
    .replace(
      /\b(?:j ai|jai|on a|je|ai|a|du|de|des|le|la|les|un|une|au|aux|dans|frigo|stock|reserve|caisse|produit|ajoute|ajouter|mets|met|besoin|besoins|il me faut|me faut|dois acheter|manque|payer|paye|payee|achete|achetee|achat|pris|prends|prend|utilise|utilisee|consomme|consommee|enleve|enlevee|retire|prepare|preparer|preparee|cuisine|cuisinee|fait|recette)\b/g,
      " ",
    )
    .replace(new RegExp(`\\b\\d{1,7}(?:[.,]\\d{1,2})?\\s*${unitPattern}\\b`, "gi"), " ")
    .replace(/\b\d{1,7}(?:[.,]\d{1,2})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return singularizeProduct(cleaned);
}

function inferProductCategory(name: string) {
  const normalized = normalizeText(name);
  if (/\b(?:orange|pomme|pommes|banane|bananes|fraise|fraises)\b/.test(normalized)) return "Fruits";
  if (/\b(?:tomate|tomates|pomme de terre|patate|oignon|salade|carotte)\b/.test(normalized)) return "Legumes";
  if (/\b(?:boeuf|viande|kefta)\b/.test(normalized)) return "Viande";
  if (/\b(?:poulet|volaille|dinde)\b/.test(normalized)) return "Volaille";
  if (/\b(?:bebe|couche|couches|lait infantile)\b/.test(normalized)) return "Bebe";
  if (/\b(?:fromage)\b/.test(normalized)) return "Fromage";
  if (/\b(?:charcuterie|jambon|saucisson)\b/.test(normalized)) return "Charcuterie";
  if (/\b(?:riz|pate|pates|huile|sucre|farine|cafe|semoule)\b/.test(normalized)) return "Epicerie";
  return "Epicerie";
}

function isLikelyFridgeProduct(name: string) {
  const normalized = normalizeText(name);
  return /\b(?:tomate|tomates|pomme|pommes|pomme de terre|patate|orange|banane|fraise|oignon|salade|carotte|lait|danone|yaourt|oeuf|oeufs|fromage|poulet|volaille|viande|boeuf|kefta|poisson|riz|pate|pates|huile|sucre|farine|cafe|semoule|eau|jus)\b/.test(normalized);
}

function parseQuantityAndName(input: string) {
  const withoutCurrency = input.replace(amountWithCurrencyPattern, " ");
  const quantityWithUnit = withoutCurrency.match(new RegExp(`\\b(\\d{1,5}(?:[.,]\\d{1,2})?)\\s*(${unitPattern})\\b\\s*(?:de\\s+)?(.+)$`, "i"));

  if (quantityWithUnit) {
    const quantity = toNumber(quantityWithUnit[1]) ?? 1;
    const unit = canonicalUnit(quantityWithUnit[2]);
    return { quantity, unit, name: cleanName(quantityWithUnit[3]) };
  }

  const simpleQuantity = withoutCurrency.match(/\b(\d{1,5}(?:[.,]\d{1,2})?)\b\s+(.+)$/i);
  if (simpleQuantity) {
    const quantity = toNumber(simpleQuantity[1]) ?? 1;
    return { quantity, unit: "piece", name: cleanName(simpleQuantity[2]) };
  }

  return { quantity: 1, unit: "piece", name: cleanName(withoutCurrency) };
}

function expenseMerchant(input: string, amount: number) {
  const merchant = cleanName(input.replace(String(amount), " ").replace(currencyWords, " "));
  return merchant || "A verifier";
}

function parseExpense(input: string, normalized: string): VoiceIntent | null {
  const currencyAmount = extractCurrencyAmount(input);
  const plainAmount = input.match(firstNumberPattern);
  const hasExpenseVerb = /\b(?:paye|payer|payee|depense|depensee|ajoute depense|ajouter depense)\b/.test(normalized);
  const hasPurchaseVerb = /\b(?:achete|achetee|achat)\b/.test(normalized);

  if (!hasExpenseVerb && !hasPurchaseVerb && !currencyAmount) return null;
  if (!currencyAmount && !hasExpenseVerb) return null;
  const amount = currencyAmount?.amount ?? toNumber(plainAmount?.[0]);
  if (amount === null) return null;

  const merchant = expenseMerchant(currencyAmount ? `${currencyAmount.before} ${currencyAmount.after}` : input, amount);
  return {
    type: "expense",
    text: input,
    amount,
    merchant,
    category: inferExpenseCategory(merchant || input),
    confidence: currencyAmount ? "high" : "medium",
  };
}

function parseRecipe(input: string, normalized: string): VoiceIntent | null {
  if (!/\b(?:prepare|preparer|preparee|cuisine|cuisinee|fait|faite)\b/.test(normalized)) return null;
  const recipeName = cleanName(input);
  if (!recipeName) return null;
  return { type: "recipe_prepare", text: input, recipeName, confidence: "medium" };
}

function parseNeed(input: string, normalized: string): VoiceIntent | null {
  if (!/\b(?:besoin|besoins|il me faut|me faut|dois acheter|manque|courses a acheter)\b/.test(normalized)) return null;
  const parsed = parseQuantityAndName(input);
  if (!parsed.name) return null;
  return {
    type: "need_add",
    text: input,
    name: parsed.name,
    quantity: parsed.quantity,
    unit: parsed.unit,
    category: inferProductCategory(parsed.name),
    confidence: "high",
  };
}

function parseFridgeConsume(input: string, normalized: string): VoiceIntent | null {
  if (!/\b(?:pris|prends|prend|utilise|utilisee|consomme|consommee|enleve|enlevee|retire|retirer)\b/.test(normalized)) return null;
  const parsed = parseQuantityAndName(input);
  if (!parsed.name) return null;
  return { type: "fridge_consume", text: input, name: parsed.name, quantity: parsed.quantity, unit: parsed.unit, confidence: "high" };
}

function parseFridgeAdd(input: string, normalized: string): VoiceIntent | null {
  const isExplicitStock = /\b(?:frigo|stock|reserve)\b/.test(normalized);
  const isBoughtFood = /\b(?:achete|achetee|achat)\b/.test(normalized);

  if (!isExplicitStock && !isBoughtFood) return null;

  const parsed = parseQuantityAndName(input);
  if (!parsed.name) return null;
  if (isBoughtFood && !isExplicitStock && !isLikelyFridgeProduct(parsed.name)) return null;

  const amountInfo = extractCurrencyAmount(input);
  return {
    type: "fridge_add",
    text: input,
    name: parsed.name,
    quantity: parsed.quantity,
    unit: parsed.unit,
    category: inferProductCategory(parsed.name),
    amount: amountInfo?.amount ?? null,
    createExpense: Boolean(amountInfo && /\b(?:achete|achetee|achat|paye|payer|payee)\b/.test(normalized)),
    confidence: isExplicitStock || isBoughtFood ? "high" : "medium",
  };
}

export function parseVoiceCommand(text: string): VoiceIntent {
  const input = text.trim();
  if (!input) return { type: "unknown", text, reason: "Commande vide.", confidence: "low" };

  const normalized = normalizeText(input);
  const intent =
    parseRecipe(input, normalized) ??
    parseFridgeConsume(input, normalized) ??
    parseNeed(input, normalized) ??
    parseFridgeAdd(input, normalized) ??
    parseExpense(input, normalized);

  return intent ?? { type: "unknown", text: input, reason: "Commande non reconnue.", confidence: "low" };
}

function describeQuantity(quantity: number, unit: string) {
  return unit === "piece" ? `x${quantity}` : `${quantity} ${unit}`;
}

export function describeVoiceIntent(intent: VoiceIntent) {
  if (intent.type === "expense") return `Creer depense : ${intent.merchant} - ${intent.amount} DH`;
  if (intent.type === "fridge_add") return `Ajouter au frigo : ${intent.name} ${describeQuantity(intent.quantity, intent.unit)}`;
  if (intent.type === "fridge_consume") return `Consommer du frigo : ${intent.name} ${describeQuantity(intent.quantity, intent.unit)}`;
  if (intent.type === "recipe_prepare") return `Recette preparee : ${intent.recipeName}`;
  if (intent.type === "need_add") return `Ajouter aux besoins : ${intent.name} ${describeQuantity(intent.quantity, intent.unit)}`;
  return intent.reason;
}

function fridgePayloadFromQuantity(intent: Extract<VoiceIntent, { type: "fridge_add" }>) {
  const normalized = normalizeUnit(intent.quantity, intent.unit);
  const isMeasured = normalized.unit === "g" || normalized.unit === "ml";
  const quantity = isMeasured ? 1 : normalized.value;
  const unitQuantity = isMeasured ? normalized.value : 1;
  const totalQuantity = quantity * unitQuantity;

  return {
    name: intent.name,
    category: intent.category,
    quantity,
    unit: normalized.unit,
    unitQuantity,
    totalQuantity,
    initialQuantity: totalQuantity,
    remainingQuantity: totalQuantity,
    lowStockThreshold: 20,
    purchasePrice: intent.amount,
    totalPrice: intent.amount ?? undefined,
    purchaseDate: getTodayDate(),
  };
}

async function executeRecipe(intent: Extract<VoiceIntent, { type: "recipe_prepare" }>) {
  const recipe = getRecipeById(intent.recipeName);
  if (!recipe) throw new Error("Recette introuvable.");

  await loadFridgeItems();
  const consumed: string[] = [];
  const missing: FridgeRecipeIngredient[] = [];

  for (const ingredient of recipe.ingredients) {
    const item = findFridgeItem(ingredient.name);
    const normalized = normalizeUnit(ingredient.amount, ingredient.unit);

    if (!item) {
      missing.push(ingredient);
      await addOrIncrementNeed({
        productId: null,
        store: "Recette",
        category: inferProductCategory(ingredient.name),
        name: ingredient.name,
        imageUrl: null,
        unit: normalized.unit,
        quantity: normalized.value,
        unitPrice: null,
        total: null,
      });
      continue;
    }

    const available = item.remainingQuantity ?? item.totalQuantity ?? (item.quantity ?? 1) * (item.unitQuantity ?? 1);
    const used = Math.min(available, normalized.value);

    if (used > 0) {
      await consumeFridgeItemById(item.id, used, normalized.unit);
      consumed.push(item.name);
    }

    if (available < normalized.value) {
      const missingAmount = normalized.value - available;
      missing.push({ ...ingredient, amount: missingAmount, unit: normalized.unit });
      await addOrIncrementNeed({
        productId: null,
        store: "Recette",
        category: inferProductCategory(ingredient.name),
        name: ingredient.name,
        imageUrl: null,
        unit: normalized.unit,
        quantity: missingAmount,
        unitPrice: null,
        total: null,
      });
    }
  }

  return `Recette preparee : ${recipe.name}. Stock diminue${consumed.length ? ` (${consumed.join(", ")})` : ""}.${missing.length ? ` ${missing.length} produit(s) manquant(s) ajoute(s) aux besoins.` : ""}`;
}

export async function executeVoiceIntent(intent: VoiceIntent): Promise<VoiceIntentResult> {
  if (intent.type === "unknown") {
    throw new Error(`${intent.reason} Essaie par exemple : "Ajoute au frigo 4 Danone" ou "Il me faut du lait".`);
  }

  if (intent.type === "expense") {
    await addExpense({
      amount: intent.amount,
      merchant: intent.merchant,
      category: intent.category,
      payment: "Carte",
      note: `sourceType: voice\nAjout vocal: ${intent.text}`,
      date: getTodayDate(),
    });
    return { intent, message: `Depense ajoutee : ${intent.amount} DH ${intent.merchant}` };
  }

  if (intent.type === "fridge_add") {
    if (intent.createExpense && intent.amount !== null) {
      await addExpense({
        amount: intent.amount,
        merchant: intent.name,
        category: "Alimentation",
        payment: "Carte",
        note: `sourceType: voice\nAchat vocal: ${intent.text}`,
        date: getTodayDate(),
      });
    }

    const item = await addFridgeItem(fridgePayloadFromQuantity(intent));
    const expensePart = intent.createExpense ? " et depense creee" : "";
    return { intent, message: `${item.name} ajoute au frigo${expensePart}` };
  }

  if (intent.type === "fridge_consume") {
    await loadFridgeItems();
    const item = findFridgeItem(intent.name);
    if (!item) throw new Error(`${intent.name} est introuvable dans Mon Frigo.`);
    const result = await consumeFridgeItemById(item.id, intent.quantity, intent.unit);
    return {
      intent,
      message: `${result.item.name} consomme. ${result.item.status === "epuise" ? "Produit epuise et visible dans Alertes stock." : "Stock mis a jour."}`,
    };
  }

  if (intent.type === "recipe_prepare") {
    return { intent, message: await executeRecipe(intent) };
  }

  await addOrIncrementNeed({
    productId: null,
    store: "Vocal",
    category: intent.category,
    name: intent.name,
    imageUrl: null,
    unit: intent.unit,
    quantity: intent.quantity,
    unitPrice: null,
    total: null,
  });
  return { intent, message: `${intent.name} ajoute aux besoins` };
}
