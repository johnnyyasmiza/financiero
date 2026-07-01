import { getTodayDate } from "@/lib/utils";
import { normalizeCaisseKey } from "@/lib/caisse-config";
import { supabase } from "@/lib/supabase";

export type FridgeUnit = "g" | "kg" | "ml" | "l" | "piece" | "pack";

export type FridgeItem = {
  id: string;
  productId?: string | null;
  store?: string | null;
  name: string;
  category: string;
  imageUrl?: string | null;
  quantity?: number;
  initialQuantity?: number | null;
  remainingQuantity?: number | null;
  lowStockThreshold?: number | null;
  unitQuantity?: number | null;
  totalQuantity?: number | null;
  purchasePrice?: number | null;
  status?: string;
  updatedAt?: string | null;
  quantityWeight?: number;
  quantityPieces?: number;
  initialWeight?: number;
  initialPieces?: number;
  unit: FridgeUnit;
  totalPrice?: number;
  pricePerGram?: number;
  pricePerPiece?: number;
  averageWeightPerPiece?: number;
  purchaseDate: string;
  expiryDate?: string;
  lowStockThresholdPercent?: number;
};

export type FridgeItemInput = {
  productId?: string | null;
  store?: string | null;
  name: string;
  category?: string;
  imageUrl?: string | null;
  quantity?: number;
  initialQuantity?: number | null;
  remainingQuantity?: number | null;
  lowStockThreshold?: number | null;
  unitQuantity?: number | null;
  totalQuantity?: number | null;
  purchasePrice?: number | null;
  quantityWeight?: number;
  quantityPieces?: number;
  unit?: string;
  totalPrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  lowStockThresholdPercent?: number;
};

export type FridgeConsumeResult = {
  item: FridgeItem;
  alert: string | null;
};

export type FridgeRecipeIngredient = {
  name: string;
  amount: number;
  unit: string;
};

export type FridgeRecipeCostLine = {
  ingredient: FridgeRecipeIngredient;
  item: FridgeItem | null;
  missing: number;
  cost: number;
};

export type FridgeRecipeCost = {
  totalCost: number;
  lines: FridgeRecipeCostLine[];
  missing: FridgeRecipeCostLine[];
};

const FRIDGE_STORAGE_KEY = "financiero:fridge:v2";
const FRIDGE_EVENT = "financiero-fridge-change";

type FridgeItemRow = {
  id: string;
  product_id: string | null;
  store: string | null;
  category: string | null;
  name: string;
  image_url: string | null;
  quantity: number | null;
  unit: string | null;
  unit_quantity: number | null;
  total_quantity: number | null;
  initial_quantity?: number | null;
  remaining_quantity?: number | null;
  low_stock_threshold?: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  expiry_date: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function notifyFridgeChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FRIDGE_EVENT));
}

function getErrorMessage(error: unknown) {
  const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code].filter(Boolean);

  if (supabaseError.code === "PGRST205" || supabaseError.code === "42P01" || supabaseError.code === "42703") {
    parts.unshift("Table fridge_items absente. Executez supabase-fridge-schema.sql dans Supabase SQL Editor. Si la table vient d'etre creee, rechargez la page dans 30 secondes.");
  }

  if (supabaseError.code === "42501" || supabaseError.message?.toLowerCase().includes("row-level security")) {
    parts.unshift("RLS bloque fridge_items. Desactive RLS sur fridge_items.");
  }

  return parts.join("\n") || "Erreur Supabase.";
}

function throwFridgeError(error: unknown) {
  throw new Error(getErrorMessage(error));
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function normalizeFridgeCategory(value: string | null | undefined) {
  if (!value) return "Autre";
  const key = normalizeCaisseKey(value);
  const labels: Record<string, string> = {
    bebe: "Bebe",
    charcuterie: "Charcuterie",
    epicerie: "Epicerie",
    fromage: "Fromage",
    fruits: "Fruits",
    legumes: "Legumes",
    viande: "Viande",
    volaille: "Volaille",
  };
  return labels[key] ?? value;
}

function getDerivedQuantity(item: FridgeItem) {
  return item.totalQuantity ?? (item.quantity ?? 1) * (item.unitQuantity ?? 1);
}

function getInitialQuantity(item: FridgeItem) {
  return item.initialQuantity ?? getDerivedQuantity(item);
}

function getRemainingQuantity(item: FridgeItem) {
  return item.remainingQuantity ?? getDerivedQuantity(item);
}

export function normalizeFridgeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/s$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeUnit(value: number, unit: string): { value: number; unit: FridgeUnit } {
  const normalized = unit
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (["kg", "kilo", "kilos", "kilogramme", "kilogrammes"].includes(normalized)) return { value: value * 1000, unit: "g" };
  if (["g", "gr", "gramme", "grammes"].includes(normalized)) return { value, unit: "g" };
  if (["l", "litre", "litres"].includes(normalized)) return { value: value * 1000, unit: "ml" };
  if (["ml", "millilitre", "millilitres"].includes(normalized)) return { value, unit: "ml" };
  if (["pack", "paquet", "paquets"].includes(normalized)) return { value, unit: "pack" };
  return { value, unit: "piece" };
}

function readFridgeItems() {
  if (!canUseStorage()) return [] as FridgeItem[];

  try {
    return JSON.parse(window.localStorage.getItem(FRIDGE_STORAGE_KEY) ?? "[]") as FridgeItem[];
  } catch {
    return [];
  }
}

function writeFridgeItems(items: FridgeItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(FRIDGE_STORAGE_KEY, JSON.stringify(items));
  notifyFridgeChange();
}

function toRowPayload(input: FridgeItem) {
  const quantity = input.quantity ?? input.quantityPieces ?? 1;
  const unitQuantity = input.unitQuantity ?? 1;
  const totalQuantity = input.totalQuantity ?? quantity * unitQuantity;
  const initialQuantity = input.initialQuantity ?? totalQuantity ?? quantity ?? 1;
  const remainingQuantity = input.remainingQuantity ?? totalQuantity ?? quantity ?? 1;
  return {
    product_id: isUuid(input.productId) ? input.productId : null,
    store: input.store || null,
    category: normalizeFridgeCategory(input.category),
    name: input.name,
    image_url: input.imageUrl || null,
    quantity,
    unit: input.unit || "piece",
    unit_quantity: unitQuantity,
    total_quantity: totalQuantity,
    initial_quantity: initialQuantity,
    remaining_quantity: remainingQuantity,
    low_stock_threshold: input.lowStockThreshold ?? input.lowStockThresholdPercent ?? 20,
    purchase_price: input.purchasePrice ?? input.totalPrice ?? null,
    purchase_date: input.purchaseDate || getTodayDate(),
    status: remainingQuantity <= 0 ? "epuise" : input.status || "en_stock",
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: FridgeItemRow): FridgeItem {
  const quantity = Number(row.quantity ?? 1);
  const unit = normalizeUnit(1, row.unit ?? "piece").unit;
  const totalQuantity = row.total_quantity === null || row.total_quantity === undefined ? null : Number(row.total_quantity);
  const unitQuantity = row.unit_quantity === null || row.unit_quantity === undefined ? null : Number(row.unit_quantity);
  const derivedQuantity = totalQuantity ?? (unitQuantity ? quantity * unitQuantity : quantity) ?? 1;
  const initialQuantity = row.initial_quantity === null || row.initial_quantity === undefined ? derivedQuantity : Number(row.initial_quantity);
  const remainingQuantity = row.remaining_quantity === null || row.remaining_quantity === undefined ? derivedQuantity : Number(row.remaining_quantity);
  const purchasePrice = row.purchase_price === null || row.purchase_price === undefined ? null : Number(row.purchase_price);
  const quantityWeight = unit === "g" || unit === "ml" ? remainingQuantity ?? totalQuantity ?? unitQuantity ?? undefined : undefined;
  const quantityPieces = unit === "piece" || unit === "pack" ? remainingQuantity ?? quantity : undefined;

  return enrichItem({
    id: row.id,
    productId: row.product_id,
    store: row.store,
    name: row.name,
    category: row.category ?? inferCategory(row.name),
    imageUrl: row.image_url,
    quantity,
    unit,
    unitQuantity,
    totalQuantity,
    initialQuantity,
    remainingQuantity,
    lowStockThreshold: row.low_stock_threshold === null || row.low_stock_threshold === undefined ? 20 : Number(row.low_stock_threshold),
    purchasePrice,
    quantityWeight,
    quantityPieces,
    initialWeight: quantityWeight,
    initialPieces: quantityPieces,
    totalPrice: purchasePrice ?? undefined,
    purchaseDate: row.purchase_date ?? getTodayDate(),
    expiryDate: row.expiry_date ?? "",
    status: remainingQuantity <= 0 ? "epuise" : row.status ?? "en_stock",
    updatedAt: row.updated_at,
  });
}

export function subscribeToFridge(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(FRIDGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FRIDGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function inferCategory(name: string) {
  const normalized = normalizeFridgeName(name);
  if (/\b(lait|danone|yaourt|fromage|oeuf|beurre)\b/.test(normalized)) return "frais";
  if (/\b(eau|coca|jus|soda|boisson)\b/.test(normalized)) return "boisson";
  if (/\b(poulet|viande|kefta|boeuf)\b/.test(normalized)) return "viande";
  if (/\b(poisson|crevette|sardine)\b/.test(normalized)) return "poisson";
  if (/\b(bebe|couche)\b/.test(normalized)) return "bebe";
  if (/\b(pate|riz|huile|sucre|farine|cafe)\b/.test(normalized)) return "epicerie";
  return "autre";
}

function enrichItem(item: FridgeItem): FridgeItem {
  const quantityWeight = item.quantityWeight && item.quantityWeight > 0 ? item.quantityWeight : undefined;
  const quantityPieces = item.quantityPieces && item.quantityPieces > 0 ? item.quantityPieces : undefined;
  const initialWeight = item.initialWeight && item.initialWeight > 0 ? item.initialWeight : quantityWeight;
  const initialPieces = item.initialPieces && item.initialPieces > 0 ? item.initialPieces : quantityPieces;
  const totalPrice = item.totalPrice && item.totalPrice > 0 ? item.totalPrice : undefined;
  const averageWeightPerPiece =
    initialWeight && initialPieces ? initialWeight / initialPieces : item.averageWeightPerPiece;

  return {
    ...item,
    quantityWeight,
    quantityPieces,
    initialWeight,
    initialPieces,
    totalPrice,
    pricePerGram: totalPrice && initialWeight ? totalPrice / initialWeight : item.pricePerGram,
    pricePerPiece: totalPrice && initialPieces ? totalPrice / initialPieces : item.pricePerPiece,
    averageWeightPerPiece,
  };
}

export function getFridgeItems() {
  return readFridgeItems().map(enrichItem).sort((first, second) => first.name.localeCompare(second.name));
}

export async function loadFridgeItems() {
  const { data, error } = await supabase.from("fridge_items").select("*").order("purchase_date", { ascending: false });

  if (error) {
    throwFridgeError(error);
  }

  const items = ((data ?? []) as FridgeItemRow[]).map(fromRow);
  writeFridgeItems(items);
  return items;
}

export function findFridgeItem(productName: string, items = getFridgeItems()) {
  const normalizedName = normalizeFridgeName(productName);
  return (
    items.find((item) => normalizeFridgeName(item.name) === normalizedName) ??
    items.find((item) => normalizeFridgeName(item.name).includes(normalizedName) || normalizedName.includes(normalizeFridgeName(item.name))) ??
    null
  );
}

export function findFridgeItemById(itemId: string, items = getFridgeItems()) {
  return items.find((item) => item.id === itemId) ?? null;
}

export async function addFridgeItem(input: FridgeItemInput) {
  const unit = normalizeUnit(1, input.unit ?? "piece").unit;
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : input.quantityPieces && input.quantityPieces > 0 ? input.quantityPieces : 1;
  const unitQuantity = input.unitQuantity && input.unitQuantity > 0 ? input.unitQuantity : input.quantityWeight && input.quantityWeight > 0 ? input.quantityWeight : 1;
  const totalQuantity = input.totalQuantity ?? (unitQuantity ? unitQuantity * quantity : input.quantityWeight ?? input.quantityPieces ?? quantity);
  const initialQuantity = input.initialQuantity ?? totalQuantity ?? quantity ?? 1;
  const remainingQuantity = input.remainingQuantity ?? totalQuantity ?? quantity ?? 1;
  const quantityWeight = unit === "g" || unit === "ml" ? totalQuantity : undefined;
  const quantityPieces = unit === "piece" || unit === "pack" ? quantity : undefined;
  const now = getTodayDate();
  const incoming = enrichItem({
    id: createId(),
    productId: isUuid(input.productId) ? input.productId : null,
    store: input.store ?? null,
    name: titleCase(input.name),
    category: normalizeFridgeCategory(input.category || inferCategory(input.name)),
    imageUrl: input.imageUrl ?? null,
    quantity,
    unitQuantity,
    totalQuantity,
    initialQuantity,
    remainingQuantity,
    lowStockThreshold: input.lowStockThreshold ?? 20,
    purchasePrice: input.purchasePrice ?? input.totalPrice ?? null,
    quantityWeight,
    quantityPieces,
    initialWeight: quantityWeight,
    initialPieces: quantityPieces,
    unit,
    totalPrice: input.totalPrice,
    purchaseDate: input.purchaseDate || now,
    expiryDate: input.expiryDate || "",
    lowStockThresholdPercent: input.lowStockThresholdPercent ?? 25,
    status: remainingQuantity <= 0 ? "epuise" : "en_stock",
  });
  const { data, error } = await supabase.from("fridge_items").insert(toRowPayload(incoming)).select("*").single();
  if (error) throwFridgeError(error);
  const inserted = fromRow(data as FridgeItemRow);
  writeFridgeItems([inserted, ...getFridgeItems()]);
  return inserted;
}

export async function addFridgeItems(items: FridgeItemInput[]) {
  if (items.length === 0) {
    return [];
  }

  const now = getTodayDate();
  const payload = items.map((input) => {
    const quantity = input.quantity && input.quantity > 0 ? input.quantity : input.quantityPieces && input.quantityPieces > 0 ? input.quantityPieces : 1;
    const unitQuantity = input.unitQuantity && input.unitQuantity > 0 ? input.unitQuantity : 1;
    const totalQuantity = input.totalQuantity ?? quantity * unitQuantity;
    const initialQuantity = input.initialQuantity ?? totalQuantity ?? quantity ?? 1;
    const remainingQuantity = input.remainingQuantity ?? totalQuantity ?? quantity ?? 1;
    return {
      product_id: isUuid(input.productId) ? input.productId : null,
      store: input.store || null,
      category: normalizeFridgeCategory(input.category),
      name: input.name,
      image_url: input.imageUrl || null,
      quantity,
      unit: input.unit || "piece",
      unit_quantity: unitQuantity,
      total_quantity: totalQuantity,
      initial_quantity: initialQuantity,
      remaining_quantity: remainingQuantity,
      low_stock_threshold: input.lowStockThreshold ?? 20,
      purchase_price: input.purchasePrice ?? input.totalPrice ?? null,
      purchase_date: input.purchaseDate || now,
      status: remainingQuantity <= 0 ? "epuise" : "en_stock",
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase.from("fridge_items").insert(payload).select("*");
  if (error) throwFridgeError(error);

  const inserted = ((data ?? []) as FridgeItemRow[]).map(fromRow);
  writeFridgeItems([...inserted, ...getFridgeItems()]);
  return inserted;
}

export function calculateStockProgress(item: FridgeItem) {
  const initialQuantity = getInitialQuantity(item);
  const remainingQuantity = getRemainingQuantity(item);

  if (initialQuantity > 0) {
    return Math.max(0, Math.min(100, (remainingQuantity / initialQuantity) * 100));
  }

  if (item.initialWeight && item.initialWeight > 0) {
    return Math.max(0, Math.min(100, ((item.quantityWeight ?? 0) / item.initialWeight) * 100));
  }

  if (item.initialPieces && item.initialPieces > 0) {
    return Math.max(0, Math.min(100, ((item.quantityPieces ?? 0) / item.initialPieces) * 100));
  }

  return 0;
}

export function getLowStockAlerts(items = getFridgeItems()) {
  return items
    .map((item) => {
      const progress = calculateStockProgress(item);
      const remainingQuantity = getRemainingQuantity(item);
      if (item.status === "epuise" || remainingQuantity <= 0) return { itemId: item.id, item, message: `Epuise : ${item.name}`, type: "critical" as const };
      if (item.status === "en_stock" && progress <= (item.lowStockThreshold ?? item.lowStockThresholdPercent ?? 20)) return { itemId: item.id, item, message: `Stock bas : ${item.name}`, type: "low" as const };
      return null;
    })
    .filter(Boolean) as Array<{ itemId: string; item: FridgeItem; message: string; type: "critical" | "low" }>;
}

function getItemValue(item: FridgeItem) {
  const progress = calculateStockProgress(item);
  if (item.purchasePrice !== null && item.purchasePrice !== undefined) return item.purchasePrice * (progress / 100);
  if (item.pricePerGram && item.quantityWeight) return item.pricePerGram * item.quantityWeight;
  if (item.pricePerPiece && item.quantityPieces) return item.pricePerPiece * item.quantityPieces;
  return 0;
}

export function getFridgeStats() {
  const items = getFridgeItems();
  const alerts = getLowStockAlerts(items);
  return {
    count: items.filter((item) => getRemainingQuantity(item) > 0).length,
    lowStockCount: alerts.length,
    totalValue: items.reduce((total, item) => total + getItemValue(item), 0),
  };
}

export async function consumeFridgeItem(productName: string, amount: number, unit: string): Promise<FridgeConsumeResult> {
  const items = getFridgeItems();
  const item = findFridgeItem(productName, items);

  if (!item) throw new Error(`${productName} est introuvable dans Mon Frigo.`);

  const normalized = normalizeUnit(amount, unit);
  const currentRemaining = getRemainingQuantity(item);
  const consumeAmount = normalized.unit === "kg" || normalized.unit === "l" ? normalized.value : amount;
  const nextRemaining = Math.max(currentRemaining - consumeAmount, 0);
  let nextWeight = item.quantityWeight ?? currentRemaining;
  let nextPieces = item.quantityPieces ?? currentRemaining;

  if (normalized.unit === "piece" || normalized.unit === "pack") {
    nextPieces = Math.max(nextPieces - normalized.value, 0);
    if (item.averageWeightPerPiece) nextWeight = Math.max(nextWeight - normalized.value * item.averageWeightPerPiece, 0);
  } else if (normalized.unit === "g") {
    nextWeight = Math.max(nextWeight - normalized.value, 0);
    if (item.averageWeightPerPiece) nextPieces = Math.max(nextPieces - normalized.value / item.averageWeightPerPiece, 0);
  } else if (normalized.unit === "ml") {
    nextWeight = Math.max(nextWeight - normalized.value, 0);
  }

  const updated = enrichItem({
    ...item,
    remainingQuantity: nextRemaining,
    status: nextRemaining <= 0 ? "epuise" : "en_stock",
    quantityWeight: item.unit === "g" || item.unit === "ml" ? nextRemaining || undefined : nextWeight || undefined,
    quantityPieces: item.unit === "piece" || item.unit === "pack" ? nextRemaining || undefined : nextPieces || undefined,
  });
  updated.quantity = normalized.unit === "piece" || normalized.unit === "pack" ? nextPieces : item.quantity;
  updated.totalQuantity = item.totalQuantity ?? item.initialQuantity ?? currentRemaining;
  const nextItems = items.map((current) => (current.id === item.id ? updated : current));
  writeFridgeItems(nextItems);
  const { error } = await supabase.from("fridge_items").update(toRowPayload(updated)).eq("id", item.id);
  if (error) throwFridgeError(error);
  const alert = getLowStockAlerts(nextItems).find((current) => current.itemId === updated.id)?.message ?? null;

  return { item: updated, alert };
}

export async function consumeFridgeItemById(itemId: string, amount: number, unit: string): Promise<FridgeConsumeResult> {
  const items = getFridgeItems();
  const item = findFridgeItemById(itemId, items);

  if (!item) throw new Error("Produit introuvable dans Mon Frigo.");

  const normalized = normalizeUnit(amount, unit);
  const currentRemaining = getRemainingQuantity(item);
  const nextRemaining = Math.max(currentRemaining - normalized.value, 0);
  const updated = enrichItem({
    ...item,
    remainingQuantity: nextRemaining,
    status: nextRemaining <= 0 ? "epuise" : "en_stock",
    quantityWeight: item.unit === "g" || item.unit === "ml" ? nextRemaining || undefined : item.quantityWeight,
    quantityPieces: item.unit === "piece" || item.unit === "pack" ? nextRemaining || undefined : item.quantityPieces,
    updatedAt: new Date().toISOString(),
  });
  const nextItems = items.map((current) => (current.id === item.id ? updated : current));
  writeFridgeItems(nextItems);

  const { error } = await supabase
    .from("fridge_items")
    .update({
      remaining_quantity: nextRemaining,
      status: nextRemaining <= 0 ? "epuise" : "en_stock",
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  if (error) throwFridgeError(error);
  const alert = getLowStockAlerts(nextItems).find((current) => current.itemId === updated.id)?.message ?? null;

  return { item: updated, alert };
}

export async function deleteFridgeItem(id: string) {
  const nextItems = getFridgeItems().filter((item) => item.id !== id);
  writeFridgeItems(nextItems);
  const { error } = await supabase.from("fridge_items").delete().eq("id", id);
  if (error) throwFridgeError(error);
}

export async function updateFridgeItemQuantity(id: string, quantity: number, totalQuantity?: number | null) {
  const items = getFridgeItems();
  const item = items.find((current) => current.id === id);
  if (!item) throw new Error("Produit introuvable dans Mon Frigo.");

  const nextRemaining = totalQuantity ?? quantity * (item.unitQuantity ?? 1);
  const nextItem = enrichItem({
    ...item,
    quantity,
    quantityPieces: item.unit === "piece" || item.unit === "pack" ? quantity : item.quantityPieces,
    quantityWeight: item.unit === "g" || item.unit === "ml" ? nextRemaining : item.quantityWeight,
    remainingQuantity: nextRemaining,
    status: nextRemaining <= 0 ? "epuise" : "en_stock",
    updatedAt: new Date().toISOString(),
  });

  writeFridgeItems(items.map((current) => (current.id === id ? nextItem : current)));
  const { error } = await supabase.from("fridge_items").update(toRowPayload(nextItem)).eq("id", id);
  if (error) throwFridgeError(error);
  return nextItem;
}

export function getFridgeItemQuantity(productName: string) {
  const item = findFridgeItem(productName);
  return item ? { item, weight: item.quantityWeight ?? 0, pieces: item.quantityPieces ?? 0 } : null;
}

export function calculateRecipeCost(ingredients: FridgeRecipeIngredient[]): FridgeRecipeCost {
  const lines = ingredients.map((ingredient) => {
    const item = findFridgeItem(ingredient.name);
    if (!item) return { ingredient, item: null, missing: ingredient.amount, cost: 0 };

    const normalized = normalizeUnit(ingredient.amount, ingredient.unit);
    const available = normalized.unit === "piece" || normalized.unit === "pack" ? item.quantityPieces ?? 0 : item.quantityWeight ?? 0;
    const missing = Math.max(normalized.value - available, 0);
    const used = Math.min(normalized.value, available);
    const cost = normalized.unit === "piece" || normalized.unit === "pack" ? used * (item.pricePerPiece ?? 0) : used * (item.pricePerGram ?? 0);

    return { ingredient, item, missing, cost };
  });

  return {
    totalCost: lines.reduce((total, line) => total + line.cost, 0),
    lines,
    missing: lines.filter((line) => line.missing > 0 || !line.item),
  };
}

export function prepareRecipe(ingredients: FridgeRecipeIngredient[]) {
  const cost = calculateRecipeCost(ingredients);
  if (cost.missing.length > 0) return { ok: false as const, cost };
  return { ok: true as const, cost };
}

export function formatFridgeQuantity(item: FridgeItem) {
  const remainingQuantity = getRemainingQuantity(item);
  if (remainingQuantity || remainingQuantity === 0) return `${Number(remainingQuantity.toFixed(2))} ${item.unit || "piece"}`;

  const parts = [];
  if (item.quantityWeight) parts.push(`${Math.round(item.quantityWeight)} ${item.unit === "ml" ? "ml" : "g"}`);
  if (item.quantityPieces) parts.push(`${Number(item.quantityPieces.toFixed(1))} ${item.quantityPieces > 1 ? item.name.toLowerCase() : item.name.toLowerCase().replace(/s$/i, "")}`);
  return parts.join(" / ") || "0";
}

export function estimateFridgeValue(item: FridgeItem) {
  return getItemValue(item);
}
