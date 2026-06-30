import type { ShoppingProduct } from "@/lib/shopping-catalog";

export type UnitInfo = {
  quantity: number | null;
  baseUnit: "kg" | "L" | "piece" | null;
};

export type BestPriceResult = {
  status: "best" | "cheaper" | "unavailable";
  bestProduct: ShoppingProduct | null;
  savingPerBaseUnit: number;
  message: string;
};

const uselessWords = new Set(["frais", "fraiche", "fraiche", "promo", "filiere", "qualite", "nature", "barquette", "paquet", "filet"]);
const synonymGroups = [
  [/\bpommes?\s+de\s+terre\b/g, "patate"],
  [/\bviande\s+hachee\b/g, "viande hachee"],
  [/\bpoulet\s+entier\b/g, "poulet"],
  [/\bpoulet\s+cuisse\b/g, "cuisse poulet"],
  [/\bcuisse\s+de\s+poulet\b/g, "cuisse poulet"],
  [/\bblanc\s+de\s+poulet\b/g, "blanc poulet"],
  [/\bblanc\s+poulet\b/g, "blanc poulet"],
  [/\btomate\s+ronde\b/g, "tomate"],
  [/\boignons?\s+blancs?\b/g, "oignon"],
  [/\bb[œoe]+uf\b/g, "boeuf"],
] as const;

export function normalizeProductName(name: string) {
  let normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|grammes?|ml|cl|l|litres?|pieces?|pcs?|unites?)\b/g, " ")
    .replace(/[^\w\s]/g, " ");

  synonymGroups.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized
    .split(/\s+/)
    .filter((word) => word && !uselessWords.has(word))
    .sort()
    .join(" ");
}

export function extractUnitInfo(name: string, unit?: string | null): UnitInfo {
  const value = `${name} ${unit ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const weight = value.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|g|gr|gramme|grammes)\b/);
  if (weight) {
    const amount = Number(weight[1].replace(",", "."));
    const symbol = weight[2];
    return {
      quantity: symbol.startsWith("kg") || symbol.startsWith("kilo") ? amount : amount / 1000,
      baseUnit: "kg",
    };
  }

  const volume = value.match(/\b(\d+(?:[.,]\d+)?)\s*(l|litre|litres|ml)\b/);
  if (volume) {
    const amount = Number(volume[1].replace(",", "."));
    const symbol = volume[2];
    return {
      quantity: symbol === "ml" ? amount / 1000 : amount,
      baseUnit: "L",
    };
  }

  const pieces = value.match(/\b(?:x\s*)?(\d+(?:[.,]\d+)?)\s*(piece|pieces|pcs|unite|unites|bulbe|bulbes)\b/);
  if (pieces) {
    return {
      quantity: Number(pieces[1].replace(",", ".")),
      baseUnit: "piece",
    };
  }

  if (/\b(piece|pieces|pcs|unite|unites)\b/.test(value)) {
    return { quantity: 1, baseUnit: "piece" };
  }

  return { quantity: null, baseUnit: null };
}

export function calculatePricePerBaseUnit(price: number | null, quantity: number | null, baseUnit: string | null) {
  if (!price || price <= 0 || !quantity || quantity <= 0 || !baseUnit) {
    return null;
  }

  return price / quantity;
}

function tokenSet(value: string) {
  return new Set(normalizeProductName(value).split(/\s+/).filter(Boolean));
}

function similarityScore(first: string, second: string) {
  const firstTokens = tokenSet(first);
  const secondTokens = tokenSet(second);

  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  firstTokens.forEach((token) => {
    if (secondTokens.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...firstTokens, ...secondTokens]).size;
  return intersection / union;
}

function getProductBasePrice(product: ShoppingProduct) {
  const unitInfo = {
    quantity: product.unitQuantity ?? extractUnitInfo(product.name, product.unit).quantity,
    baseUnit: product.unitBase ?? extractUnitInfo(product.name, product.unit).baseUnit,
  };
  const pricePerBaseUnit = product.pricePerBaseUnit ?? calculatePricePerBaseUnit(product.price, unitInfo.quantity, unitInfo.baseUnit);

  return {
    ...unitInfo,
    pricePerBaseUnit,
  };
}

export function findComparableProducts(product: ShoppingProduct, allProducts: ShoppingProduct[]) {
  const current = getProductBasePrice(product);

  if (!current.baseUnit || !current.pricePerBaseUnit) {
    return [];
  }

  return allProducts.filter((candidate) => {
    if (candidate.id === product.id || candidate.store === product.store) {
      return false;
    }

    const candidatePrice = getProductBasePrice(candidate);
    if (!candidatePrice.baseUnit || !candidatePrice.pricePerBaseUnit || candidatePrice.baseUnit !== current.baseUnit) {
      return false;
    }

    return similarityScore(product.name, candidate.name) >= 0.75;
  });
}

export function getBestPrice(product: ShoppingProduct, allProducts: ShoppingProduct[]): BestPriceResult {
  const current = getProductBasePrice(product);

  if (!current.baseUnit || !current.pricePerBaseUnit) {
    return {
      status: "unavailable",
      bestProduct: null,
      savingPerBaseUnit: 0,
      message: "Comparaison indisponible",
    };
  }

  const candidates = [product, ...findComparableProducts(product, allProducts)]
    .map((candidate) => ({ product: candidate, info: getProductBasePrice(candidate) }))
    .filter((candidate) => candidate.info.pricePerBaseUnit && candidate.info.baseUnit === current.baseUnit)
    .sort((first, second) => (first.info.pricePerBaseUnit ?? Infinity) - (second.info.pricePerBaseUnit ?? Infinity));
  const best = candidates[0];

  if (!best) {
    return {
      status: "unavailable",
      bestProduct: null,
      savingPerBaseUnit: 0,
      message: "Comparaison indisponible",
    };
  }

  if (best.product.id === product.id) {
    return {
      status: "best",
      bestProduct: product,
      savingPerBaseUnit: 0,
      message: "Meilleur prix actuel",
    };
  }

  const saving = current.pricePerBaseUnit - (best.info.pricePerBaseUnit ?? current.pricePerBaseUnit);

  return {
    status: "cheaper",
    bestProduct: best.product,
    savingPerBaseUnit: saving,
    message: `Moins cher chez ${best.product.store} : ${(best.info.pricePerBaseUnit ?? 0).toFixed(2)} DH/${current.baseUnit}, économie ${saving.toFixed(2)} DH/${current.baseUnit}`,
  };
}

export function formatBaseUnitPrice(product: ShoppingProduct) {
  const info = getProductBasePrice(product);
  if (!info.pricePerBaseUnit || !info.baseUnit) {
    return "Prix unité indisponible";
  }

  return `${info.pricePerBaseUnit.toFixed(2)} DH/${info.baseUnit}`;
}
