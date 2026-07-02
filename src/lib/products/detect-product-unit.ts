import { normalizeUnit, type SupportedUnit } from "@/lib/units";

export type DetectedProductUnit = {
  quantity: number;
  unit: SupportedUnit;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectProductUnit(label: string): DetectedProductUnit | null {
  const value = normalizeText(label);
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
