import { supabase } from "@/lib/supabase";
import { type Asset, type Bill, type Expense, type Income } from "@/lib/finance-data";
import { cacheData, enqueueOfflineOperation, getCachedData, isNetworkError, isOnline, notifyOfflineStatus } from "@/lib/offline-store";

type ExpenseInput = Omit<Expense, "id"> & { id?: string };
type RevenueInput = Omit<Income, "id"> & { id?: string };
type BillInput = Omit<Bill, "id"> & { id?: string };
type AssetInput = Omit<Asset, "id"> & { id?: string };

type BillRow = Omit<Bill, "dueDate"> & {
  due_date: string;
};
type ExpenseRow = {
  id: string;
  amount: number;
  merchant: string | null;
  category: string;
  payment_method: string;
  note: string | null;
  expense_date: string | null;
  created_at: string;
};
type RevenueRow = {
  id: string;
  source: string;
  amount: number;
  revenue_date: string | null;
  note: string | null;
  created_at: string;
};
type FinanceTable = "expenses" | "revenues" | "bills" | "assets";
const EXPENSES_CACHE_KEY = "finance:expenses";
const REVENUES_CACHE_KEY = "finance:revenues";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}`;
}

function getErrorMessage(error: unknown) {
  const supabaseError = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  const parts = [
    supabaseError.message ? `message: ${supabaseError.message}` : "",
    supabaseError.details ? `details: ${supabaseError.details}` : "",
    supabaseError.hint ? `hint: ${supabaseError.hint}` : "",
    supabaseError.code ? `code: ${supabaseError.code}` : "",
  ].filter(Boolean);

  if (
    supabaseError.code === "42501" ||
    supabaseError.message?.toLowerCase().includes("row-level security") ||
    supabaseError.message?.toLowerCase().includes("rls")
  ) {
    parts.unshift("RLS bloque l'insertion. Desactive RLS ou ajoute une policy.");
  }

  if (supabaseError.code === "42P01" || supabaseError.code === "42703") {
    parts.unshift("Table ou colonne Supabase manquante. Execute le SQL de schema avant d'utiliser cette page.");
  }

  if (parts.length > 0) {
    return parts.join("\n");
  }

  return error instanceof Error ? error.message : "Erreur Supabase sans detail.";
}

function throwDbError(error: unknown) {
  throw new Error(getErrorMessage(error));
}

export function subscribeToFinanceTable(table: FinanceTable, onChange: () => void) {
  const channel = supabase
    .channel(`financiero-${table}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function toBill(row: BillRow): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    status: row.status,
    dueDate: row.due_date,
  };
}

function toBillRow(bill: BillInput): BillRow {
  return {
    id: bill.id ?? createId(),
    name: bill.name,
    amount: bill.amount,
    status: bill.status,
    due_date: bill.dueDate,
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    merchant: row.merchant ?? "",
    category: row.category,
    amount: Number(row.amount),
    date: row.expense_date ?? "",
    payment: row.payment_method,
    note: row.note ?? "",
    sourceType: parseSourceType(row.note),
  };
}

function parseSourceType(note: string | null): Expense["sourceType"] {
  const match = note?.match(/sourceType:\s*(purchase|receipt|voice|recipe_cost_internal)/i);
  return match?.[1] as Expense["sourceType"] | undefined;
}

function buildExpenseNote(expense: ExpenseInput) {
  if (!expense.sourceType || expense.note?.match(/sourceType:/i)) return expense.note || null;
  return `sourceType: ${expense.sourceType}${expense.note ? `\n${expense.note}` : ""}`;
}

function toRevenue(row: RevenueRow): Income {
  return {
    id: row.id,
    source: row.source,
    amount: Number(row.amount),
    date: row.revenue_date ?? "",
    note: row.note ?? "",
  };
}

function normalizeDate(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const match = date.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return date;
}

export async function getExpenses() {
  const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });

  if (error) {
    const cached = await getCachedData<Expense[]>(EXPENSES_CACHE_KEY);

    if (cached) {
      return cached;
    }

    throwDbError(error);
  }

  const expenses = ((data ?? []) as ExpenseRow[]).map(toExpense);
  await cacheData(EXPENSES_CACHE_KEY, expenses);
  return expenses;
}

export async function addExpense(expense: ExpenseInput) {
  const payload = {
    id: expense.id ?? createId(),
    amount: Number(expense.amount),
    merchant: expense.merchant || null,
    category: expense.category,
    payment_method: expense.payment,
    note: buildExpenseNote(expense),
    expense_date: normalizeDate(expense.date),
  };

  if (!isOnline()) {
    const offlineExpense: Expense = {
      id: `offline-${createId()}`,
      merchant: expense.merchant ?? "",
      category: expense.category,
      amount: Number(expense.amount),
      date: normalizeDate(expense.date),
      payment: expense.payment,
      note: expense.note ?? "",
      sourceType: expense.sourceType,
    };
    const cached = await getCachedData<Expense[]>(EXPENSES_CACHE_KEY);
    await cacheData(EXPENSES_CACHE_KEY, [offlineExpense, ...(cached ?? [])]);
    await enqueueOfflineOperation({ type: "insert", table: "expenses", payload });
    return offlineExpense;
  }

  const { data, error } = await supabase.from("expenses").insert(payload).select("*").single();

  if (error) {
    if (isNetworkError(error)) {
      await enqueueOfflineOperation({ type: "insert", table: "expenses", payload });
      notifyOfflineStatus();
      return {
        id: `offline-${createId()}`,
        merchant: expense.merchant ?? "",
        category: expense.category,
        amount: Number(expense.amount),
        date: normalizeDate(expense.date),
        payment: expense.payment,
        note: expense.note ?? "",
        sourceType: expense.sourceType,
      };
    }

    throwDbError(error);
  }

  const inserted = toExpense(data as ExpenseRow);
  const cached = await getCachedData<Expense[]>(EXPENSES_CACHE_KEY);
  await cacheData(EXPENSES_CACHE_KEY, [inserted, ...(cached ?? []).filter((item) => !item.id.startsWith("offline-"))]);
  return inserted;
}

export async function updateExpense(id: string, expense: Partial<ExpenseInput>) {
  const payload = {
    amount: expense.amount === undefined ? undefined : Number(expense.amount),
    merchant: expense.merchant || null,
    category: expense.category,
    payment_method: expense.payment,
    note: expense.note || null,
    expense_date: expense.date ? normalizeDate(expense.date) : undefined,
  };
  const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select("*").single();

  if (error) {
    throwDbError(error);
  }

  return toExpense(data as ExpenseRow);
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    throwDbError(error);
  }
}

export async function getRevenues() {
  const { data, error } = await supabase.from("revenues").select("*").order("revenue_date", { ascending: false });

  if (error) {
    const cached = await getCachedData<Income[]>(REVENUES_CACHE_KEY);

    if (cached) {
      return cached;
    }

    throwDbError(error);
  }

  const revenues = ((data ?? []) as RevenueRow[]).map(toRevenue);
  await cacheData(REVENUES_CACHE_KEY, revenues);
  return revenues;
}

export async function addRevenue(revenue: RevenueInput) {
  const payload = {
    source: revenue.source,
    amount: Number(revenue.amount),
    revenue_date: normalizeDate(revenue.date),
    note: revenue.note || null,
  };

  if (!isOnline()) {
    const offlineRevenue: Income = {
      id: `offline-${createId()}`,
      source: revenue.source,
      amount: Number(revenue.amount),
      date: normalizeDate(revenue.date),
      note: revenue.note ?? "",
    };
    const cached = await getCachedData<Income[]>(REVENUES_CACHE_KEY);
    await cacheData(REVENUES_CACHE_KEY, [offlineRevenue, ...(cached ?? [])]);
    await enqueueOfflineOperation({ type: "insert", table: "revenues", payload });
    return offlineRevenue;
  }

  const { data, error } = await supabase.from("revenues").insert(payload).select("*").single();

  if (error) {
    if (isNetworkError(error)) {
      await enqueueOfflineOperation({ type: "insert", table: "revenues", payload });
      notifyOfflineStatus();
      return {
        id: `offline-${createId()}`,
        source: revenue.source,
        amount: Number(revenue.amount),
        date: normalizeDate(revenue.date),
        note: revenue.note ?? "",
      };
    }

    throwDbError(error);
  }

  const inserted = toRevenue(data as RevenueRow);
  const cached = await getCachedData<Income[]>(REVENUES_CACHE_KEY);
  await cacheData(REVENUES_CACHE_KEY, [inserted, ...(cached ?? []).filter((item) => !item.id.startsWith("offline-"))]);
  return inserted;
}

export async function updateRevenue(id: string, revenue: Partial<RevenueInput>) {
  const payload = {
    source: revenue.source,
    amount: revenue.amount === undefined ? undefined : Number(revenue.amount),
    revenue_date: revenue.date ? normalizeDate(revenue.date) : undefined,
    note: revenue.note || null,
  };
  const { data, error } = await supabase.from("revenues").update(payload).eq("id", id).select("*").single();

  if (error) {
    throwDbError(error);
  }

  return toRevenue(data as RevenueRow);
}

export async function deleteRevenue(id: string) {
  const { error } = await supabase.from("revenues").delete().eq("id", id);

  if (error) {
    throwDbError(error);
  }
}

export async function getBills() {
  const { data, error } = await supabase.from("bills").select("*").order("due_date", { ascending: true });

  if (error) {
    throwDbError(error);
  }

  return ((data ?? []) as BillRow[]).map(toBill);
}

export async function addBill(bill: BillInput) {
  const { data, error } = await supabase.from("bills").insert(toBillRow(bill)).select("*").single();

  if (error) {
    throwDbError(error);
  }

  return toBill(data as BillRow);
}

export async function updateBill(id: string, bill: Partial<BillInput>) {
  const payload = {
    ...bill,
    due_date: bill.dueDate,
  };
  delete payload.dueDate;

  const { data, error } = await supabase.from("bills").update(payload).eq("id", id).select("*").single();

  if (error) {
    throwDbError(error);
  }

  return toBill(data as BillRow);
}

export async function deleteBill(id: string) {
  const { error } = await supabase.from("bills").delete().eq("id", id);

  if (error) {
    throwDbError(error);
  }
}

export async function getAssets() {
  const { data, error } = await supabase.from("assets").select("*").order("name", { ascending: true });

  if (error) {
    throwDbError(error);
  }

  return (data ?? []) as Asset[];
}

export async function addAsset(asset: AssetInput) {
  const payload: Asset = {
    id: asset.id ?? createId(),
    name: asset.name,
    value: asset.value,
  };
  const { data, error } = await supabase.from("assets").insert(payload).select("*").single();

  if (error) {
    throwDbError(error);
  }

  return data as Asset;
}

export async function updateAsset(id: string, asset: Partial<AssetInput>) {
  const { data, error } = await supabase.from("assets").update(asset).eq("id", id).select("*").single();

  if (error) {
    throwDbError(error);
  }

  return data as Asset;
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from("assets").delete().eq("id", id);

  if (error) {
    throwDbError(error);
  }
}
