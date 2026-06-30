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

export function extractReceiptAmount(ocrText: string): number | null {
  if (!ocrText) return null;

  const lines = ocrText
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

  const amountRegex = /\b\d{1,6}(?:[.,]\d{1,2})\b/g;

  const getAmounts = (line: string): number[] => {
    const matches = line.match(amountRegex) || [];
    return matches.map((match) => Number(match.replace(",", "."))).filter((amount) => Number.isFinite(amount));
  };

  const isTotalLine = (normalizedLine: string): boolean =>
    /\bTOTAL\b/.test(normalizedLine) && !/\bSOUS[- ]?TOTAL\b/.test(normalizedLine) && !/\bSUBTOTAL\b/.test(normalizedLine);

  for (const line of lines) {
    const normalizedLine = normalize(line);

    if (isTotalLine(normalizedLine)) {
      const amounts = getAmounts(line);
      if (amounts.length > 0) {
        return amounts[amounts.length - 1];
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalize(lines[index]);

    if (isTotalLine(normalizedLine)) {
      for (let nextIndex = index; nextIndex <= Math.min(index + 3, lines.length - 1); nextIndex += 1) {
        const amounts = getAmounts(lines[nextIndex]);
        if (amounts.length > 0) {
          return amounts[amounts.length - 1];
        }
      }
    }
  }

  const netPayKeywords = ["NET A PAYER", "NET À PAYER", "MONTANT A PAYER", "MONTANT À PAYER", "A PAYER", "À PAYER"];
  for (const line of lines) {
    const normalizedLine = normalize(line);

    if (netPayKeywords.some((keyword) => normalizedLine.includes(normalize(keyword)))) {
      const amounts = getAmounts(line);
      if (amounts.length > 0) {
        return amounts[amounts.length - 1];
      }
    }
  }

  const paymentKeywords = ["ESPECES", "ESPÈCES", "CARTE", "CASH", "CB", "VISA", "MASTERCARD"];
  for (const line of lines) {
    const normalizedLine = normalize(line);

    if (paymentKeywords.some((keyword) => normalizedLine.includes(normalize(keyword)))) {
      const amounts = getAmounts(line);
      if (amounts.length > 0) {
        return amounts[amounts.length - 1];
      }
    }
  }

  const forbiddenKeywords = ["HT", "TVA", "TAXE", "TTC", "EXONERER", "EXONERE", "EXONÉRÉ"];

  const allAmounts = lines
    .filter((line) => {
      const normalizedLine = normalize(line);
      return !forbiddenKeywords.some((keyword) => normalizedLine.includes(normalize(keyword)));
    })
    .flatMap(getAmounts)
    .filter((amount) => amount > 0 && amount < 1000000);

  if (allAmounts.length === 0) return null;

  return Math.max(...allAmounts);
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
    montant: extractReceiptAmount(text) ?? "",
    date: parseDate(text),
    marchand,
    categorie: parseCategory(text, marchand),
    moyenPaiement: parsePayment(text),
    note: parseNote(text),
  };
}

export const receiptParserExamples = [
  {
    input: "HT 28.33\nTVA 5.67\nTTC 34.00\nEXONERER 3.00\nTOTAL 37.00\nESPECES 37.00",
    expectedMontant: 37,
  },
  {
    input: "TOTAL 149.29 90521",
    expectedMontant: 149.29,
  },
  {
    input: "9052103027 total 148.90",
    expectedMontant: 148.9,
  },
] as const;
