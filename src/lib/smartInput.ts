import { addExpense, addRevenue } from "@/lib/finance-db";
import { addFridgeItem, getFridgeItemQuantity, getLowStockAlerts } from "@/lib/fridge";
import { getTodayDate } from "@/lib/utils";
import { addProduct } from "@/lib/shopping-catalog";
import {
  handleConsumeStock,
  handleNeed,
  handlePrepareRecipe,
  handlePurchase,
  inferExpenseCategory,
} from "@/lib/automationFlow";

export type SmartInputCommand =
  | { type: "purchase"; text: string }
  | { type: "recipe_prepare"; recipeId: string }
  | { type: "recipe_select"; recipeId: string }
  | { type: "expense"; amount: number; merchant: string; category: string }
  | { type: "income"; amount: number; source: string }
  | { type: "need"; items: string[]; text: string }
  | { type: "cash_product"; name: string; price: number | null }
  | { type: "fridge_add"; name: string; quantityWeight?: number; quantityPieces?: number; unit: string; totalPrice: number; category: string }
  | { type: "fridge_consume"; name: string; quantity: number; unit: string; text: string }
  | { type: "fridge_query"; name: string }
  | { type: "fridge_alerts" };

export type SmartInputResult = {
  command: SmartInputCommand;
  message: string;
};

const currencyWords = /\b(?:dh|dhs|dirham|dirhams|mad)\b/gi;
const amountPattern = /\b\d{1,7}(?:[.,]\d{1,2})?\b/;

function normalize(value: string) {
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

function extractAmount(input: string) {
  const match = input.match(amountPattern);
  if (!match) return null;

  const amount = Number(match[0].replace(",", "."));
  if (!Number.isFinite(amount)) return null;

  return {
    amount,
    withoutAmount: input.replace(match[0], " ").replace(currencyWords, " ").replace(/\s+/g, " ").trim(),
  };
}

function cleanName(value: string) {
  return value
    .replace(currencyWords, " ")
    .replace(/\b(?:j ai|jai|je|ai|a|payer|paye|payee|recu|ajoute|ajouter|dans|besoin|besoins|caisse|produit|stock|frigo|le|la|les|un|une|des|du|de|me|faut|au|aux|il|reste|combien|pris|mange|enleve|retire|achete|achat)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFridgeCategory(text: string) {
  const normalized = normalize(text);
  if (/\b(?:lait|danone|yaourt|fromage|oeuf|oeufs|beurre)\b/.test(normalized)) return "frais";
  if (/\b(?:eau|coca|jus|soda|boisson)\b/.test(normalized)) return "boisson";
  if (/\b(?:poulet|viande|kefta|boeuf)\b/.test(normalized)) return "viande";
  if (/\b(?:poisson|crevette|sardine)\b/.test(normalized)) return "poisson";
  if (/\b(?:bebe|couche|lait infantile)\b/.test(normalized)) return "bebe";
  if (/\b(?:pate|pates|riz|huile|sucre|farine|cafe)\b/.test(normalized)) return "epicerie";
  return "autre";
}

function parseNeedItems(input: string) {
  const cleaned = normalize(input)
    .replace(/\b(?:ajoute|ajouter|dans|besoin|besoins|il me faut|me faut|faut|j ai besoin de|jai besoin de|de|du|des|le|la|les|un|une|aux|au)\b/g, " ")
    .replace(/\s+et\s+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  const items = cleaned.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
  if (items.length === 1 && items[0].split(/\s+/).length > 1) return items[0].split(/\s+/).filter(Boolean);
  return items;
}

function parseFridgeAdd(transcript: string): SmartInputCommand | null {
  const normalized = normalize(transcript);
  if (!/\b(?:ajoute|ajouter|mets|met)\b/.test(normalized)) return null;

  const priceMatch = transcript.match(/\b(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:dh|dhs|dirham|dirhams|mad)\b/i);
  if (!priceMatch) return null;

  const totalPrice = Number(priceMatch[1].replace(",", "."));
  const beforePrice = transcript.slice(0, priceMatch.index).replace(/\b(?:au|dans|le)?\s*frigo\b/gi, " ");
  const weightMatch = beforePrice.match(/\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(kg|kilo|kilos|g|gr|gramme|grammes|l|litre|litres|ml)\b/i);
  const piecesMatch = beforePrice.match(/\b(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:piece|pieces|piece?s|pack|paquet|paquets)\b/i);
  const simplePiecesMatch = beforePrice.match(/\b(?:ajoute|ajouter|mets|met)\s+(\d{1,5}(?:[.,]\d{1,2})?)\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s-]*?)\s*$/i);

  if (!weightMatch && !piecesMatch && !simplePiecesMatch) return null;

  const quantityWeight = weightMatch ? Number(weightMatch[1].replace(",", ".")) : undefined;
  const quantityPieces = piecesMatch
    ? Number(piecesMatch[1].replace(",", "."))
    : !weightMatch && simplePiecesMatch
      ? Number(simplePiecesMatch[1].replace(",", "."))
      : undefined;
  const unit = weightMatch ? weightMatch[2] : piecesMatch?.[0].toLowerCase().includes("pack") || piecesMatch?.[0].toLowerCase().includes("paquet") ? "pack" : "piece";
  const rawName = beforePrice
    .replace(/\b\d{1,5}(?:[.,]\d{1,2})?\s*(?:kg|kilo|kilos|g|gr|gramme|grammes|l|litre|litres|ml|piece|pieces|piece?s|pack|paquet|paquets)\b/gi, " ")
    .replace(/\b(?:ajoute|ajouter|mets|met|de|au|dans|frigo)\b/gi, " ");
  const name = cleanName(rawName || simplePiecesMatch?.[2] || "");

  if (!name || !Number.isFinite(totalPrice)) return null;

  return {
    type: "fridge_add",
    name: titleCase(name),
    quantityWeight,
    quantityPieces,
    unit,
    totalPrice,
    category: inferFridgeCategory(name),
  };
}

function parseFridgeConsume(transcript: string): SmartInputCommand | null {
  const normalized = normalize(transcript);
  if (!/\b(?:pris|prend|prends|enleve|enlever|retire|retirer|consomme|mange)\b/.test(normalized)) return null;

  const match = transcript.match(/\b(?:pris|prend|prends|enleve|enlever|retire|retirer|consomme|mange)\b\s+(?:(un|une|des|\d{1,5}(?:[.,]\d{1,2})?)\s*)?(kg|kilo|kilos|g|gr|gramme|grammes|l|litre|litres|ml|piece|pieces|pack|paquet|paquets)?(?:\s+de)?\s+(.+)$/i);
  if (!match) return null;

  const quantity = match[1] && !/un|une|des/i.test(match[1]) ? Number(match[1].replace(",", ".")) : 1;
  const unit = match[2] ?? "piece";
  const name = cleanName(match[3]);

  if (!name || !Number.isFinite(quantity)) return null;
  return { type: "fridge_consume", name: titleCase(name), quantity, unit, text: transcript };
}

function parseFridgeQuery(transcript: string): SmartInputCommand | null {
  const normalized = normalize(transcript);
  if (/\b(?:bientot fini|stock bas|stock critique)\b/.test(normalized)) return { type: "fridge_alerts" };
  if (!/\b(?:reste combien|combien reste|stock de|combien de)\b/.test(normalized)) return null;

  const name = cleanName(transcript.replace(/.*\b(?:reste combien de|combien reste de|stock de|combien de)\b/i, ""));
  return name ? { type: "fridge_query", name: titleCase(name) } : null;
}

export function parseVoiceCommand(transcript: string): SmartInputCommand | null {
  const normalized = normalize(transcript);
  const amountInfo = extractAmount(transcript);

  if (/\b(?:achete|achetee|achat|j ai achete|jai achete)\b/.test(normalized) && amountInfo) return { type: "purchase", text: transcript };
  if (/\b(?:prepare|preparer)\b/.test(normalized)) return { type: "recipe_prepare", recipeId: cleanName(transcript) || transcript };
  if (/\brecette\b/.test(normalized)) return { type: "recipe_select", recipeId: cleanName(transcript) || transcript };

  const fridgeCommand = parseFridgeAdd(transcript) ?? parseFridgeConsume(transcript) ?? parseFridgeQuery(transcript);
  if (fridgeCommand) return fridgeCommand;

  const hasCashProductIntent = /\b(?:caisse|produit|stock)\b/.test(normalized);
  const hasNeedIntent = /\b(?:besoin|besoins|il me faut|me faut|ajoute|ajouter)\b/.test(normalized) && !hasCashProductIntent;
  const hasIncomeIntent = /\b(?:revenu|recu|salaire|encaisse|gagne)\b/.test(normalized);

  if (hasNeedIntent && !amountInfo) {
    const items = parseNeedItems(transcript);
    return items.length > 0 ? { type: "need", items, text: transcript } : null;
  }

  if (hasCashProductIntent) {
    const name = cleanName(amountInfo?.withoutAmount ?? transcript);
    return name ? { type: "cash_product", name: titleCase(name), price: amountInfo?.amount ?? null } : null;
  }

  if (hasIncomeIntent && amountInfo) {
    const source = cleanName(amountInfo.withoutAmount) || "Revenu";
    return { type: "income", amount: amountInfo.amount, source: titleCase(source) };
  }

  if (amountInfo) {
    const merchant = cleanName(amountInfo.withoutAmount) || "A verifier";
    return { type: "expense", amount: amountInfo.amount, merchant: titleCase(merchant), category: inferExpenseCategory(merchant || transcript) };
  }

  return null;
}

function commandSummary(command: SmartInputCommand) {
  if (command.type === "purchase") return command.text;
  if (command.type === "recipe_prepare") return `Preparer ${command.recipeId}`;
  if (command.type === "recipe_select") return `Recette ${command.recipeId}`;
  if (command.type === "expense") return `${command.amount} DH ${command.merchant}`;
  if (command.type === "income") return `${command.amount} DH ${command.source}`;
  if (command.type === "cash_product") return command.price ? `${command.name} - ${command.price} DH` : command.name;
  if (command.type === "fridge_add") return `${command.name} - ${command.totalPrice} DH`;
  if (command.type === "fridge_consume") return `${command.quantity} ${command.unit} ${command.name}`;
  if (command.type === "fridge_query") return command.name;
  if (command.type === "fridge_alerts") return "Alertes frigo";
  return command.items.join(", ");
}

export async function handleSmartInput(inputText: string): Promise<SmartInputResult> {
  const command = parseVoiceCommand(inputText);
  if (!command) throw new Error("Commande non reconnue. Essaie : 120 DH Carrefour, ajoute lait, ou j'ai achete 1 kilo tomate 5 pieces 30 DH.");

  if (command.type === "purchase") {
    const result = await handlePurchase(command.text);
    return { command, message: result.message };
  }

  if (command.type === "recipe_prepare") {
    const result = await handlePrepareRecipe(command.recipeId);
    return { command, message: result.message };
  }

  if (command.type === "recipe_select") {
    return { command, message: `Recette demandee : ${command.recipeId}. Ouvre Mon Frigo pour choisir et modifier les ingredients.` };
  }

  if (command.type === "expense") {
    await addExpense({ amount: command.amount, merchant: command.merchant, category: command.category, date: getTodayDate(), payment: "A verifier", note: `sourceType: voice\nAjout vocal: ${inputText}` });
    return { command, message: `Depense ajoutee : ${command.amount} DH ${command.merchant}` };
  }

  if (command.type === "income") {
    await addRevenue({ amount: command.amount, source: command.source, date: getTodayDate(), note: `Ajout vocal: ${inputText}` });
    return { command, message: `Revenu ajoute : ${command.amount} DH ${command.source}` };
  }

  if (command.type === "need") {
    const result = await handleNeed(command.text);
    return { command, message: result.message };
  }

  if (command.type === "fridge_add") {
    const item = await addFridgeItem({ name: command.name, quantityWeight: command.quantityWeight, quantityPieces: command.quantityPieces, unit: command.unit, totalPrice: command.totalPrice, category: command.category, purchaseDate: getTodayDate() });
    return { command, message: `${item.name} ajoute au frigo` };
  }

  if (command.type === "fridge_consume") {
    const result = await handleConsumeStock(command.text);
    return { command, message: result.message };
  }

  if (command.type === "fridge_query") {
    const result = getFridgeItemQuantity(command.name);
    if (!result) throw new Error(`${command.name} est introuvable dans Mon Frigo.`);
    const parts = [result.weight ? `${Math.round(result.weight)} g` : "", result.pieces ? `${Number(result.pieces.toFixed(1))} piece(s)` : ""].filter(Boolean);
    return { command, message: `Il reste ${parts.join(" / ")} de ${result.item.name}` };
  }

  if (command.type === "fridge_alerts") {
    const alerts = getLowStockAlerts();
    return { command, message: alerts.length > 0 ? alerts.map((alert) => alert.message).join(", ") : "Aucun produit bientot fini" };
  }

  await addProduct({ store: "Vocal", name: command.name, category: "Epicerie", price: command.price, unit: "piece", imageUrl: null, sourceUrl: null });
  return { command, message: "Produit ajoute a la caisse" };
}

export function describeSmartCommand(command: SmartInputCommand | null) {
  return command ? commandSummary(command) : "";
}
