import { normalizeProductName } from "@/lib/price-comparison";
import { supabase } from "@/lib/supabase";

export type MarjaneApiPrice = {
  price_ttc?: number | string | null;
  vat_rate?: number | string | null;
};

export type MarjaneApiProduct = {
  id?: number | string | null;
  uuid?: string | null;
  default_label?: string | null;
  default_picture?: string | null;
  weight?: number | string | null;
  prices?: MarjaneApiPrice[] | null;
  stock?: {
    quantity?: number | string | null;
  } | null;
};

export type MarjaneApiItem = {
  id?: number | string | null;
  product?: MarjaneApiProduct | null;
  quantity?: number | string | null;
};

export type MarjaneProduct = {
  id: string | null;
  uuid: string | null;
  name: string;
  imageUrl: string | null;
  price: number | null;
  weight: number | null;
  stockQuantity: number | null;
};

export type FinancieroDestination = "needs" | "cart" | "fridge" | "ignore";

export type FinancieroImportItem = {
  sourceId: string;
  productId: string | null;
  name: string;
  normalizedName: string;
  imageUrl: string | null;
  price: number | null;
  category: string;
  store: "Marjane";
  quantity: number;
  unitQuantity: number;
  initialQuantity: number;
  remainingQuantity: number;
  unit: string;
  purchasePrice: number | null;
  destination: FinancieroDestination;
  raw: MarjaneApiItem;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[œ]/g, "oe")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [record.data, record.items, record.products, record.results, record["hydra:member"]];
    const match = candidates.find(Array.isArray);
    if (Array.isArray(match)) return match;
  }
  return [];
}

export function parseMarjaneJson(input: string): MarjaneApiItem[] {
  const parsed = JSON.parse(input) as unknown;
  const rows = asArray(parsed);

  if (rows.length === 0) {
    throw new Error("JSON Marjane reconnu, mais aucune liste de produits n'a ete trouvee.");
  }

  return rows.filter((row): row is MarjaneApiItem => Boolean(row && typeof row === "object" && "product" in row));
}

export function getBestPrice(product: MarjaneApiProduct | null | undefined) {
  const prices = product?.prices ?? [];
  const firstValid = prices.map((price) => asNumber(price.price_ttc)).find((price): price is number => price !== null && price > 0);
  return firstValid ?? null;
}

export function detectUnitFromLabel(label: string, weight?: number | null) {
  const normalized = normalizeText(label);
  const comboWeight = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramme|grammes|ml|l|litre|litres)\b/);

  if (comboWeight) {
    const count = asNumber(comboWeight[1]) ?? 1;
    const amount = asNumber(comboWeight[2]) ?? 1;
    const unit = comboWeight[3];
    if (/kg/.test(unit)) return { unit: "g", quantity: count * amount * 1000 };
    if (/^(l|litre|litres)$/.test(unit)) return { unit: "ml", quantity: count * amount * 1000 };
    return { unit: unit === "ml" ? "ml" : "g", quantity: count * amount };
  }

  const volume = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|l|litre|litres)\b/);
  if (volume) {
    const amount = asNumber(volume[1]) ?? 1;
    return /^(l|litre|litres)$/.test(volume[2]) ? { unit: "litre", quantity: amount } : { unit: "ml", quantity: amount };
  }

  const mass = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|g|gr|gramme|grammes)\b/);
  if (mass) {
    const amount = asNumber(mass[1]) ?? 1;
    return /^(kg|kilo|kilos)$/.test(mass[2]) ? { unit: "kg", quantity: amount } : { unit: "g", quantity: amount };
  }

  const pieces = normalized.match(/\b(?:x\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:portions?|pieces?|pcs?|unites?))\b/);
  if (pieces) {
    return { unit: "piece", quantity: asNumber(pieces[1] ?? pieces[2]) ?? 1 };
  }

  if (weight && weight > 0) {
    return { unit: "g", quantity: weight };
  }

  return { unit: "piece", quantity: 1 };
}

export function detectCategoryFromLabel(label: string) {
  const normalized = normalizeText(label);
  if (/\b(?:lait|fromage|beurre|creme|yaourt|danone)\b/.test(normalized)) return "Fromage/Laitier";
  if (/\b(?:oeuf|oeufs)\b/.test(normalized)) return "Oeufs";
  if (/\b(?:riz|farine|semoule|pates|pate|coquillages)\b/.test(normalized)) return "Feculents";
  if (/\b(?:thon|sardine|sardines)\b/.test(normalized)) return "Conserves";
  if (/\b(?:huile|vinaigre|moutarde|sauce)\b/.test(normalized)) return "Epicerie";
  if (/\b(?:eau|boisson|jus)\b/.test(normalized)) return "Boissons";
  if (/\b(?:couche|couches|bebe|lait infantile)\b/.test(normalized)) return "Bebe";
  if (/\b(?:tomate|oignon|pomme de terre|patate|carotte)\b/.test(normalized)) return "Legumes";
  if (/\b(?:pomme|banane|orange)\b/.test(normalized)) return "Fruits";
  return "Epicerie";
}

export function normalizeMarjaneItem(item: MarjaneApiItem): MarjaneProduct {
  const product = item.product ?? {};
  const name = product.default_label?.trim() || "Produit Marjane";

  return {
    id: product.id === null || product.id === undefined ? null : String(product.id),
    uuid: product.uuid ?? null,
    name,
    imageUrl: product.default_picture ?? null,
    price: getBestPrice(product),
    weight: asNumber(product.weight),
    stockQuantity: asNumber(product.stock?.quantity),
  };
}

export function mapToFinancieroItem(item: MarjaneApiItem): FinancieroImportItem {
  const product = normalizeMarjaneItem(item);
  const quantity = asNumber(item.quantity) ?? 1;
  const detected = detectUnitFromLabel(product.name, product.weight);
  const unitQuantity = detected.quantity;
  const initialQuantity = unitQuantity * quantity;
  const sourceId = String(item.id ?? product.uuid ?? product.id ?? product.name);

  return {
    sourceId,
    productId: product.uuid ?? product.id,
    name: product.name,
    normalizedName: normalizeProductName(product.name),
    imageUrl: product.imageUrl,
    price: product.price,
    category: detectCategoryFromLabel(product.name),
    store: "Marjane",
    quantity,
    unitQuantity,
    initialQuantity,
    remainingQuantity: initialQuantity,
    unit: detected.unit,
    purchasePrice: product.price === null ? null : product.price * quantity,
    destination: "needs",
    raw: item,
  };
}

export async function recordMarjaneSync(input: {
  syncType: "json" | "url" | "extension" | "import";
  rawJson: unknown;
  importedItems: unknown;
}) {
  const { error } = await supabase.from("marjane_syncs").insert({
    sync_type: input.syncType,
    source: "marjane",
    raw_json: input.rawJson,
    imported_items: input.importedItems,
  });

  if (error) {
    throw new Error(error.message);
  }
}
