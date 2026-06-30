import { getTodayDate } from "@/lib/utils";

export type ParsedReceipt = {
  montant: number | "";
  date: string;
  marchand: string;
  categorie: string;
  moyenPaiement: string;
  note: string;
};

function todayDate() {
  return getTodayDate();
}

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseDate(text: string) {
  const match = text.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);

  if (!match) {
    return todayDate();
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseMerchant(text: string) {
  const normalized = normalizeText(text);
  const knownMerchants = [
    ["marjane", "Marjane"],
    ["carrefour", "Carrefour"],
    ["bim", "BIM"],
    ["acima", "Acima"],
  ];
  const merchant = knownMerchants.find(([needle]) => normalized.includes(needle));

  if (merchant) {
    return merchant[1];
  }

  const firstTextLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /[a-zA-ZÀ-ÿ]/.test(line));

  return firstTextLine ?? "";
}

const amountPattern = /(^|[^\d])(\d{1,5}[.,]\d{1,2})(?!\d)/g;
const totalHintPattern = /\b(total|ttc|net\s+a\s+payer|montant|a\s+payer|payer)\b/;

function extractDecimalAmounts(text: string) {
  return [...text.matchAll(amountPattern)]
    .map((match) => Number(match[2].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 100000);
}

function parseAmount(text: string) {
  const lines = text.split(/\r?\n/);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (!totalHintPattern.test(normalizeText(line))) {
      continue;
    }

    const lineAmounts = extractDecimalAmounts(line);

    if (lineAmounts.length > 0) {
      return lineAmounts[lineAmounts.length - 1];
    }
  }

  const amountMatches = extractDecimalAmounts(text);

  if (amountMatches.length === 0) {
    return "";
  }

  return Math.max(...amountMatches);
}

function parseCategory(text: string, merchant: string) {
  const normalized = normalizeText(`${merchant} ${text}`);

  if (["marjane", "carrefour", "bim", "acima"].some((value) => normalized.includes(value))) {
    return "Nourriture";
  }

  if (normalized.includes("onee") || normalized.includes("electricite")) {
    return "Électricité";
  }

  if (normalized.includes("radee") || normalized.includes("eau")) {
    return "Eau";
  }

  if (normalized.includes("orange") || normalized.includes("maroc telecom") || normalized.includes("inwi")) {
    return "Internet";
  }

  return "Autre";
}

function parsePayment(text: string) {
  const normalized = normalizeText(text);

  if (
    normalized.includes("cb") ||
    normalized.includes("carte") ||
    normalized.includes("tpe") ||
    normalized.includes("visa") ||
    normalized.includes("mastercard")
  ) {
    return "Carte";
  }

  return "À vérifier";
}

function parseNote(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .slice(0, 180);
}

export function parseReceiptText(text: string): ParsedReceipt {
  const marchand = parseMerchant(text);

  return {
    montant: parseAmount(text),
    date: parseDate(text),
    marchand,
    categorie: parseCategory(text, marchand),
    moyenPaiement: parsePayment(text),
    note: parseNote(text),
  };
}

export const receiptParserExamples = [
  {
    input: "TOTAL 149.29 90521",
    expectedMontant: 149.29,
  },
  {
    input: "9052103027 total 148.90",
    expectedMontant: 148.9,
  },
] as const;
