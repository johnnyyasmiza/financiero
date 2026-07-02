import { getTodayDate } from "@/lib/utils";
import { normalizeCaisseKey } from "@/lib/caisse-config";
import { detectProductUnit, isDiaperProduct, isEggProduct } from "@/lib/products/detect-product-unit";
import { ensureProductExists } from "@/lib/products/ensure-product";
import { addOrIncrementNeed, getNeeds } from "@/lib/shopping-catalog";
import { supabase } from "@/lib/supabase";
import {
  calculateStockPercent,
  convertBetweenUnits,
  formatQuantity,
  normalizeUnit as normalizeSupportedUnit,
  type SupportedUnit,
} from "@/lib/units";

export type FridgeUnit = SupportedUnit;

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
  autoConsume?: boolean | null;
  dailyConsumption?: number | null;
  lastAutoConsumedAt?: string | null;
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
  autoConsume?: boolean | null;
  dailyConsumption?: number | null;
  lastAutoConsumedAt?: string | null;
};

export type FridgeItemStockUpdate = {
  initialQuantity?: number | null;
  remainingQuantity?: number | null;
  unit?: string | null;
  purchasePrice?: number | null;
  lowStockThreshold?: number | null;
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
  auto_consume?: boolean | null;
  daily_consumption?: number | null;
  last_auto_consumed_at?: string | null;
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

function daysBetweenDates(startDate: string | null | undefined, endDate: string) {
  if (!startDate) return 0;
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

function getAutoConsumeDefaults(name: string) {
  if (!isDiaperProduct(name)) {
    return { autoConsume: false, dailyConsumption: null };
  }

  return { autoConsume: true, dailyConsumption: 5 };
}

function resolveInputStock(input: FridgeItemInput) {
  const detected = detectProductUnit(input.name);
  const forcedPiece = isEggProduct(input.name) || isDiaperProduct(input.name);
  const requestedUnit = forcedPiece ? "piece" : input.unit ? normalizeSupportedUnit(input.unit) : detected?.unit ?? "piece";
  const unit = requestedUnit;
  const packCount = input.quantity && input.quantity > 0 ? input.quantity : 1;

  if (input.totalQuantity !== null && input.totalQuantity !== undefined) {
    const totalQuantity = Number(input.totalQuantity);
    return { unit, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
  }

  if (input.initialQuantity !== null && input.initialQuantity !== undefined) {
    const totalQuantity = Number(input.initialQuantity);
    return { unit, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
  }

  if (input.quantityWeight && input.quantityWeight > 0) {
    const totalQuantity = input.quantityWeight;
    return { unit, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
  }

  if (input.quantityPieces && input.quantityPieces > 0) {
    const totalQuantity = input.quantityPieces;
    return { unit: unit === "pack" ? "pack" as const : "piece" as const, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
  }

  if (input.unitQuantity && input.unitQuantity > 0) {
    const totalQuantity = packCount * input.unitQuantity;
    return { unit, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
  }

  if (detected) {
    const totalQuantity = packCount * detected.quantity;
    return { unit: forcedPiece ? "piece" as const : detected.unit, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
  }

  const totalQuantity = packCount;
  return { unit, quantity: totalQuantity, unitQuantity: 1, totalQuantity };
}

function repairItemFromName(item: FridgeItem) {
  const detected = detectProductUnit(item.name);
  const forcedPiece = isEggProduct(item.name) || isDiaperProduct(item.name);
  if (!detected && !forcedPiece) return item;

  const initial = getInitialQuantity(item);
  const remaining = getRemainingQuantity(item);
  const detectedQuantity = detected?.quantity ?? initial;
  const detectedUnit = forcedPiece ? "piece" : detected?.unit ?? item.unit;
  const looksBroken = item.status !== "epuise" && initial <= 1 && remaining <= 1 && detectedQuantity > 1;
  const hasWrongSpecialUnit = forcedPiece && item.unit !== "piece";
  if (!looksBroken && !hasWrongSpecialUnit) return item;
  const nextInitial = looksBroken ? detectedQuantity : initial;
  const nextRemaining = looksBroken ? detectedQuantity : remaining;

  return enrichItem({
    ...item,
    unit: detectedUnit,
    quantity: nextRemaining,
    unitQuantity: 1,
    totalQuantity: nextInitial,
    initialQuantity: nextInitial,
    remainingQuantity: nextRemaining,
    quantityWeight: detectedUnit === "g" || detectedUnit === "kg" || detectedUnit === "ml" || detectedUnit === "cl" || detectedUnit === "l" ? nextRemaining : undefined,
    quantityPieces: detectedUnit === "piece" || detectedUnit === "pack" ? nextRemaining : undefined,
    status: nextRemaining <= 0 ? "epuise" : item.status ?? "en_stock",
  });
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
  return { value, unit: normalizeSupportedUnit(unit) };
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
  const autoDefaults = getAutoConsumeDefaults(input.name);
  const autoConsume = input.autoConsume ?? autoDefaults.autoConsume;
  const dailyConsumption = input.dailyConsumption ?? autoDefaults.dailyConsumption;
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
    auto_consume: autoConsume,
    daily_consumption: dailyConsumption,
    last_auto_consumed_at: input.lastAutoConsumedAt ?? (autoConsume ? input.purchaseDate || getTodayDate() : null),
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: FridgeItemRow): FridgeItem {
  const unit = isEggProduct(row.name) || isDiaperProduct(row.name) ? "piece" : normalizeSupportedUnit(row.unit);
  const detected = detectProductUnit(row.name);
  const rawQuantity = Number(row.quantity ?? 1);
  const totalQuantity = row.total_quantity === null || row.total_quantity === undefined ? null : Number(row.total_quantity);
  const unitQuantity = row.unit_quantity === null || row.unit_quantity === undefined ? null : Number(row.unit_quantity);
  const quantity = totalQuantity ?? (rawQuantity <= 1 && detected ? detected.quantity : rawQuantity);
  const derivedQuantity = totalQuantity ?? (unitQuantity ? rawQuantity * unitQuantity : quantity) ?? 1;
  const initialQuantity = row.initial_quantity === null || row.initial_quantity === undefined ? derivedQuantity : Number(row.initial_quantity);
  const remainingQuantity = row.remaining_quantity === null || row.remaining_quantity === undefined ? derivedQuantity : Number(row.remaining_quantity);
  const purchasePrice = row.purchase_price === null || row.purchase_price === undefined ? null : Number(row.purchase_price);
  const quantityWeight = unit === "g" || unit === "kg" || unit === "ml" || unit === "cl" || unit === "l" ? remainingQuantity ?? totalQuantity ?? unitQuantity ?? undefined : undefined;
  const quantityPieces = unit === "piece" || unit === "pack" ? remainingQuantity ?? quantity : undefined;

  return repairItemFromName(enrichItem({
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
    autoConsume: row.auto_consume ?? getAutoConsumeDefaults(row.name).autoConsume,
    dailyConsumption: row.daily_consumption ?? getAutoConsumeDefaults(row.name).dailyConsumption,
    lastAutoConsumedAt: row.last_auto_consumed_at,
    updatedAt: row.updated_at,
  }));
}

async function ensureDiaperNeed(item: FridgeItem) {
  const needs = await getNeeds();
  const alreadyExists = needs.some((need) => need.status === "a_acheter" && isDiaperProduct(need.name));
  if (alreadyExists) return;

  await addOrIncrementNeed({
    productId: item.productId ?? null,
    store: item.store ?? "Frigo",
    category: item.category || "Bebe",
    name: "Couches",
    imageUrl: item.imageUrl ?? null,
    unit: "piece",
    quantity: 1,
    unitPrice: null,
    total: null,
  });
}

async function applyAutoConsumption(items: FridgeItem[]) {
  const today = getTodayDate();
  const updates: FridgeItem[] = [];

  for (const item of items) {
    if (!item.autoConsume || !isDiaperProduct(item.name)) continue;
    const dailyConsumption = item.dailyConsumption && item.dailyConsumption > 0 ? item.dailyConsumption : 5;
    const lastDate = item.lastAutoConsumedAt?.slice(0, 10) || item.purchaseDate;
    const elapsedDays = daysBetweenDates(lastDate, today);
    const remainingQuantity = getRemainingQuantity(item);
    if (elapsedDays <= 0) {
      if (remainingQuantity <= 15) await ensureDiaperNeed(item);
      continue;
    }

    const nextRemaining = Math.max(remainingQuantity - elapsedDays * dailyConsumption, 0);
    updates.push(enrichItem({
      ...item,
      unit: "piece",
      quantity: nextRemaining,
      totalQuantity: item.totalQuantity ?? item.initialQuantity ?? getInitialQuantity(item),
      remainingQuantity: nextRemaining,
      quantityPieces: nextRemaining,
      status: nextRemaining <= 0 ? "epuise" : "en_stock",
      autoConsume: true,
      dailyConsumption,
      lastAutoConsumedAt: today,
      updatedAt: new Date().toISOString(),
    }));
  }

  await Promise.all(
    updates.map(async (item) => {
      const { error } = await supabase
        .from("fridge_items")
        .update({
          quantity: item.quantity ?? item.remainingQuantity ?? 0,
          unit: "piece",
          unit_quantity: 1,
          remaining_quantity: item.remainingQuantity ?? 0,
          status: item.status,
          auto_consume: true,
          daily_consumption: item.dailyConsumption ?? 5,
          last_auto_consumed_at: item.lastAutoConsumedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) throwFridgeError(error);
      if ((item.remainingQuantity ?? 0) <= 15) await ensureDiaperNeed(item);
    }),
  );

  return items.map((item) => updates.find((updated) => updated.id === item.id) ?? item);
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

  const rows = (data ?? []) as FridgeItemRow[];
  let items = rows.map(fromRow);
  items = await applyAutoConsumption(items);
  const repairs = items.filter((item, index) => {
    const row = rows[index];
    return (
      ((item.status !== "epuise" &&
        (row.initial_quantity ?? row.total_quantity ?? row.quantity ?? 1) <= 1 &&
        item.initialQuantity !== null &&
        item.initialQuantity !== undefined &&
        item.initialQuantity > 1) ||
        ((isEggProduct(row.name) || isDiaperProduct(row.name)) && row.unit !== "piece"))
    );
  });

  await Promise.all(
    repairs.map((item) =>
      supabase
        .from("fridge_items")
        .update({
          quantity: item.quantity ?? item.initialQuantity ?? 1,
          unit: item.unit,
          unit_quantity: 1,
          total_quantity: item.totalQuantity ?? item.initialQuantity ?? 1,
          initial_quantity: item.initialQuantity ?? 1,
          remaining_quantity: item.remainingQuantity ?? item.initialQuantity ?? 1,
          status: item.remainingQuantity !== undefined && item.remainingQuantity !== null && item.remainingQuantity <= 0 ? "epuise" : "en_stock",
          auto_consume: item.autoConsume ?? getAutoConsumeDefaults(item.name).autoConsume,
          daily_consumption: item.dailyConsumption ?? getAutoConsumeDefaults(item.name).dailyConsumption,
          last_auto_consumed_at: item.lastAutoConsumedAt ?? (item.autoConsume ? getTodayDate() : null),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id),
    ),
  );
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
  const productId = await ensureProductExists({
    productId: input.productId,
    store: input.store,
    category: input.category,
    name: input.name,
    imageUrl: input.imageUrl,
    price: input.purchasePrice ?? input.totalPrice ?? null,
    unit: input.unit,
    unitQuantity: input.unitQuantity,
    sourceUrl: null,
  });
  const resolved = resolveInputStock(input);
  const unit = resolved.unit;
  const quantity = resolved.quantity;
  const unitQuantity = resolved.unitQuantity;
  const totalQuantity = resolved.totalQuantity;
  const initialQuantity = input.initialQuantity ?? totalQuantity ?? quantity ?? 1;
  const remainingQuantity = input.remainingQuantity ?? totalQuantity ?? quantity ?? 1;
  const quantityWeight = unit === "g" || unit === "kg" || unit === "ml" || unit === "cl" || unit === "l" ? totalQuantity : undefined;
  const quantityPieces = unit === "piece" || unit === "pack" ? quantity : undefined;
  const now = getTodayDate();
  const autoDefaults = getAutoConsumeDefaults(input.name);
  const autoConsume = input.autoConsume ?? autoDefaults.autoConsume;
  const dailyConsumption = input.dailyConsumption ?? autoDefaults.dailyConsumption;
  const incoming = enrichItem({
    id: createId(),
    productId,
    store: input.store ?? null,
    name: titleCase(input.name),
    category: normalizeFridgeCategory(input.category || inferCategory(input.name)),
    imageUrl: input.imageUrl ?? null,
    quantity,
    unitQuantity,
    totalQuantity,
    initialQuantity,
    remainingQuantity,
    lowStockThreshold: input.lowStockThreshold ?? (autoConsume ? 15 : 20),
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
    autoConsume,
    dailyConsumption,
    lastAutoConsumedAt: input.lastAutoConsumedAt ?? (autoConsume ? input.purchaseDate || now : null),
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
  const payload = await Promise.all(items.map(async (input) => {
    const productId = await ensureProductExists({
      productId: input.productId,
      store: input.store,
      category: input.category,
      name: input.name,
      imageUrl: input.imageUrl,
      price: input.purchasePrice ?? input.totalPrice ?? null,
      unit: input.unit,
      unitQuantity: input.unitQuantity,
      sourceUrl: null,
    });
    const resolved = resolveInputStock(input);
    const quantity = resolved.quantity;
    const unitQuantity = resolved.unitQuantity;
    const totalQuantity = resolved.totalQuantity;
    const initialQuantity = input.initialQuantity ?? totalQuantity ?? quantity ?? 1;
    const remainingQuantity = input.remainingQuantity ?? totalQuantity ?? quantity ?? 1;
    const autoDefaults = getAutoConsumeDefaults(input.name);
    const autoConsume = input.autoConsume ?? autoDefaults.autoConsume;
    const dailyConsumption = input.dailyConsumption ?? autoDefaults.dailyConsumption;
    return {
      product_id: productId,
      store: input.store || null,
      category: normalizeFridgeCategory(input.category),
      name: input.name,
      image_url: input.imageUrl || null,
      quantity,
      unit: resolved.unit,
      unit_quantity: unitQuantity,
      total_quantity: totalQuantity,
      initial_quantity: initialQuantity,
      remaining_quantity: remainingQuantity,
      low_stock_threshold: input.lowStockThreshold ?? (autoConsume ? 15 : 20),
      purchase_price: input.purchasePrice ?? input.totalPrice ?? null,
      purchase_date: input.purchaseDate || now,
      status: remainingQuantity <= 0 ? "epuise" : "en_stock",
      auto_consume: autoConsume,
      daily_consumption: dailyConsumption,
      last_auto_consumed_at: input.lastAutoConsumedAt ?? (autoConsume ? input.purchaseDate || now : null),
      updated_at: new Date().toISOString(),
    };
  }));

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
    return calculateStockPercent(remainingQuantity, initialQuantity);
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
      if (isDiaperProduct(item.name) && remainingQuantity <= 15) return { itemId: item.id, item, message: "Couches bientôt épuisées", type: "low" as const };
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
  const consumeUnit = isEggProduct(item.name) || isDiaperProduct(item.name) ? "piece" : normalized.unit;
  const currentRemaining = getRemainingQuantity(item);
  const consumeAmount = convertBetweenUnits(normalized.value, consumeUnit, item.unit);
  const nextRemaining = Math.max(currentRemaining - consumeAmount, 0);
  let nextWeight = item.quantityWeight ?? currentRemaining;
  let nextPieces = item.quantityPieces ?? currentRemaining;

  if (consumeUnit === "piece" || consumeUnit === "pack") {
    nextPieces = Math.max(nextPieces - normalized.value, 0);
    if (item.averageWeightPerPiece) nextWeight = Math.max(nextWeight - normalized.value * item.averageWeightPerPiece, 0);
  } else if (["g", "kg", "ml", "cl", "l"].includes(consumeUnit)) {
    nextWeight = Math.max(nextWeight - consumeAmount, 0);
    if (item.averageWeightPerPiece) nextPieces = Math.max(nextPieces - consumeAmount / item.averageWeightPerPiece, 0);
  }

  const updated = enrichItem({
    ...item,
    remainingQuantity: nextRemaining,
    status: nextRemaining <= 0 ? "epuise" : "en_stock",
    quantityWeight: ["g", "kg", "ml", "cl", "l"].includes(item.unit) ? nextRemaining || undefined : nextWeight || undefined,
    quantityPieces: item.unit === "piece" || item.unit === "pack" ? nextRemaining || undefined : nextPieces || undefined,
  });
  updated.quantity = consumeUnit === "piece" || consumeUnit === "pack" ? nextPieces : item.quantity;
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
  const consumeUnit = isEggProduct(item.name) || isDiaperProduct(item.name) ? "piece" : normalized.unit;
  const currentRemaining = getRemainingQuantity(item);
  const consumeAmount = convertBetweenUnits(normalized.value, consumeUnit, item.unit);
  const nextRemaining = Math.max(currentRemaining - consumeAmount, 0);
  const updated = enrichItem({
    ...item,
    remainingQuantity: nextRemaining,
    status: nextRemaining <= 0 ? "epuise" : "en_stock",
    quantityWeight: ["g", "kg", "ml", "cl", "l"].includes(item.unit) ? nextRemaining || undefined : item.quantityWeight,
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

export async function updateFridgeItemStock(id: string, patch: FridgeItemStockUpdate) {
  const items = getFridgeItems();
  const item = items.find((current) => current.id === id);
  if (!item) throw new Error("Produit introuvable dans Mon Frigo.");

  const unit = patch.unit ? normalizeSupportedUnit(patch.unit) : item.unit;
  const initialQuantity = patch.initialQuantity ?? item.initialQuantity ?? getInitialQuantity(item);
  const remainingQuantity = Math.max(0, patch.remainingQuantity ?? item.remainingQuantity ?? getRemainingQuantity(item));
  const updated = enrichItem({
    ...item,
    unit,
    quantity: remainingQuantity,
    unitQuantity: 1,
    totalQuantity: initialQuantity,
    initialQuantity,
    remainingQuantity,
    purchasePrice: patch.purchasePrice ?? item.purchasePrice ?? null,
    totalPrice: patch.purchasePrice ?? item.totalPrice,
    lowStockThreshold: patch.lowStockThreshold ?? item.lowStockThreshold ?? 20,
    quantityPieces: unit === "piece" || unit === "pack" ? remainingQuantity : undefined,
    quantityWeight: ["g", "kg", "ml", "cl", "l"].includes(unit) ? remainingQuantity : undefined,
    status: remainingQuantity <= 0 ? "epuise" : "en_stock",
    updatedAt: new Date().toISOString(),
  });

  writeFridgeItems(items.map((current) => (current.id === id ? updated : current)));
  const { error } = await supabase.from("fridge_items").update(toRowPayload(updated)).eq("id", id);
  if (error) throwFridgeError(error);
  return updated;
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
    const requestedInItemUnit = convertBetweenUnits(normalized.value, normalized.unit, item.unit);
    const available = getRemainingQuantity(item);
    const missing = Math.max(requestedInItemUnit - available, 0);
    const used = Math.min(requestedInItemUnit, available);
    const initial = getInitialQuantity(item);
    const unitCost = initial > 0 ? (item.purchasePrice ?? item.totalPrice ?? 0) / initial : 0;
    const cost = used * unitCost;

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
  if (remainingQuantity || remainingQuantity === 0) return formatQuantity(remainingQuantity, item.unit || "piece");

  const parts = [];
  if (item.quantityWeight) parts.push(`${Math.round(item.quantityWeight)} ${item.unit === "ml" ? "ml" : "g"}`);
  if (item.quantityPieces) parts.push(`${Number(item.quantityPieces.toFixed(1))} ${item.quantityPieces > 1 ? item.name.toLowerCase() : item.name.toLowerCase().replace(/s$/i, "")}`);
  return parts.join(" / ") || "0";
}

export function estimateFridgeValue(item: FridgeItem) {
  return getItemValue(item);
}
