export type Stat = {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "amber" | "violet";
};

export type Transaction = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
};

export type Expense = {
  id: string;
  merchant?: string;
  category: string;
  amount: number;
  date: string;
  payment: string;
  note?: string;
};

export type Income = {
  id: string;
  source: string;
  amount: number;
  date: string;
  note?: string;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  status: "Paye" | "A payer";
  dueDate: string;
};

export type Asset = {
  id: string;
  name: string;
  value: number;
};

export const expenseCategories = [
  "Maison",
  "Alimentation",
  "Eau",
  "Electricite",
  "Internet",
  "Telephone",
  "Nourriture",
  "Bebe",
  "Couches bebe",
  "Banque",
  "Transport",
  "Voiture",
  "Moto",
  "Sante",
  "Loisirs",
  "Autre",
];

export const incomeSources = ["Salaire", "Business", "Location", "Vente", "Autre"];
export const paymentMethods = ["Carte", "Carte bancaire", "Cash", "Espèces", "Virement", "Prelevement", "A verifier"];
export const billTypes = ["Eau", "Electricite", "Internet", "Telephone", "Loyer", "Assurance"];
export const assetTypes = ["Banque", "Cash", "Immobilier", "Moto", "Voiture", "Business", "Dettes"];

export const stats: Stat[] = [
  { label: "Solde total", value: 0, tone: "emerald" },
  { label: "Revenus du mois", value: 0, tone: "blue" },
  { label: "Depenses du mois", value: 0, tone: "amber" },
  { label: "Epargne du mois", value: 0, tone: "emerald" },
  { label: "Patrimoine net", value: 0, tone: "violet" },
];

export const transactions: Transaction[] = [];
export const expenses: Expense[] = [];
export const incomes: Income[] = [];
export const bills: Bill[] = [];
export const assets: Asset[] = [];
