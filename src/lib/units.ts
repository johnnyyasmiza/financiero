export type SupportedUnit = "kg" | "g" | "l" | "cl" | "ml" | "piece" | "pack";

const unitAliases: Record<string, SupportedUnit> = {
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramme: "kg",
  kilogrammes: "kg",
  g: "g",
  gr: "g",
  gramme: "g",
  grammes: "g",
  l: "l",
  litre: "l",
  litres: "l",
  ml: "ml",
  millilitre: "ml",
  millilitres: "ml",
  cl: "cl",
  centilitre: "cl",
  centilitres: "cl",
  piece: "piece",
  pieces: "piece",
  pcs: "piece",
  unite: "piece",
  unites: "piece",
  paquet: "pack",
  paquets: "pack",
  pack: "pack",
};

function cleanUnit(unit: string | null | undefined) {
  return (unit || "piece")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[èé]/g, "e")
    .trim();
}

export function normalizeUnit(unit: string | null | undefined): SupportedUnit {
  return unitAliases[cleanUnit(unit)] ?? "piece";
}

export function convertToBaseQuantity(quantity: number, unit: string | null | undefined) {
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === "kg") return quantity * 1000;
  if (normalizedUnit === "l") return quantity * 1000;
  if (normalizedUnit === "cl") return quantity * 10;
  return quantity;
}

export function convertFromBaseQuantity(quantity: number, unit: string | null | undefined) {
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === "kg") return quantity / 1000;
  if (normalizedUnit === "l") return quantity / 1000;
  if (normalizedUnit === "cl") return quantity / 10;
  return quantity;
}

function unitFamily(unit: SupportedUnit) {
  if (unit === "kg" || unit === "g") return "weight";
  if (unit === "l" || unit === "cl" || unit === "ml") return "volume";
  return "count";
}

export function convertBetweenUnits(quantity: number, fromUnit: string | null | undefined, toUnit: string | null | undefined) {
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);

  if (unitFamily(normalizedFrom) !== unitFamily(normalizedTo)) {
    return quantity;
  }

  return convertFromBaseQuantity(convertToBaseQuantity(quantity, normalizedFrom), normalizedTo);
}

export function formatQuantity(quantity: number, unit: string | null | undefined) {
  const normalizedUnit = normalizeUnit(unit);
  const label = normalizedUnit === "piece" ? "pièce" : normalizedUnit === "pack" ? "paquet" : normalizedUnit;
  const formatted = Number(quantity.toFixed(quantity % 1 === 0 ? 0 : 2));
  return `${formatted} ${label}${normalizedUnit === "piece" && formatted > 1 ? "s" : ""}`;
}

export function calculateStockPercent(remainingQuantity: number | null | undefined, initialQuantity: number | null | undefined) {
  const initial = Number(initialQuantity ?? 0);
  const remaining = Number(remainingQuantity ?? 0);
  if (!Number.isFinite(initial) || initial <= 0) return 0;
  return Math.max(0, Math.min(100, (remaining / initial) * 100));
}
