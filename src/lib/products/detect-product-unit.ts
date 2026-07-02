import { normalizeUnit, type SupportedUnit } from "@/lib/units";

export type DetectedProductUnit = {
  quantity: number;
  unit: SupportedUnit;
};

export function normalizeProductUnitText(value: string) {
  return value
    .replace(/[œŒ]/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/Å“/g, "oe")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isEggProduct(label: string) {
  return /\boeufs?\b/.test(normalizeProductUnitText(label));
}

export function isDiaperProduct(label: string) {
  return /\bcouches?\b/.test(normalizeProductUnitText(label));
}

export function detectProductUnit(label: string): DetectedProductUnit | null {
  const value = normalizeProductUnitText(label);
  const isEggs = /\boeufs?\b/.test(value);
  const isDiapers = /\bcouches?\b/.test(value);

  if (isEggs || isDiapers) {
    const pieces =
      value.match(/\bx\s*(\d+(?:[.,]\d+)?)\b/i) ??
      value.match(/\b(?:boite|boites|pack|paquet)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s+(?:oeufs?|couches?)\b/i) ??
      value.match(/\b(?:boite|boites|pack|paquet)\s+(?:oeufs?|couches?)\s+(\d+(?:[.,]\d+)?)\b/i) ??
      value.match(/\b(?:oeufs?|couches?)\s+(\d+(?:[.,]\d+)?)\b/i) ??
      value.match(/\b(\d+(?:[.,]\d+)?)\s+(?:oeufs?|couches?|pieces?|pcs?|unites?)\b/i);

    return {
      quantity: toNumber(pieces?.[1]) ?? 1,
      unit: "piece",
    };
  }

  const combo = value.match(/\b(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grammes?|l|litres?|cl|ml)\b/i);
  if (combo) {
    const count = toNumber(combo[1]) ?? 1;
    const amount = toNumber(combo[2]) ?? 1;
    const unit = normalizeUnit(combo[3]);
    return { quantity: count * amount, unit };
  }

  const measured = value.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|g|gr|grammes?|l|litres?|cl|ml)\b/i);
  if (measured) {
    return {
      quantity: toNumber(measured[1]) ?? 1,
      unit: normalizeUnit(measured[2]),
    };
  }

  const pieces = value.match(/\b(?:x\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:pieces?|pcs?|unites?|portions?))\b/i);
  if (pieces) {
    return {
      quantity: toNumber(pieces[1] ?? pieces[2]) ?? 1,
      unit: "piece",
    };
  }

  return null;
}
