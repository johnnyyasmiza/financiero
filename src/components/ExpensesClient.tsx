"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { FinanceForm } from "@/components/FinanceForm";
import { addExpense, deleteExpense, getExpenses, subscribeToFinanceTable, updateExpense } from "@/lib/finance-db";
import { expenseCategories, paymentMethods, type Expense } from "@/lib/finance-data";
import { formatDate, formatMoney, getTodayDate } from "@/lib/utils";

type QuickPaymentConfig = {
  merchant: "Amendis" | "HRI" | "Swika";
  category: string;
  payment: string;
  logo: string;
  accent: "blue" | "yellow" | "emerald";
  hint: string;
  successMessage: string;
};

const quickPaymentCards = [
  {
    merchant: "Orange",
    logo: "/logo/orange.png",
    accent: "orange",
    hint: "Internet - 300 DH",
  },
  {
    merchant: "Amendis",
    logo: "/logo/amendis.jpg",
    accent: "blue",
    hint: "Maison - montant a saisir",
    category: "Maison",
    payment: "Virement",
    successMessage: "Depense Amendis ajoutee.",
  },
  {
    merchant: "HRI",
    logo: "/logo/hri.png",
    accent: "yellow",
    hint: "Alimentation - montant a saisir",
    category: "Alimentation",
    payment: "Carte bancaire",
    successMessage: "Depense HRI ajoutee.",
  },
  {
    merchant: "Swika",
    logo: "/logo/swika.png",
    accent: "emerald",
    hint: "Alimentation - montant a saisir",
    category: "Alimentation",
    payment: "Espèces",
    successMessage: "Depense Swika ajoutee.",
  },
] as const;

function quickCardClass(accent: string) {
  const classes: Record<string, string> = {
    orange: "border-orange-300/30 from-orange-500/15 hover:border-orange-300",
    blue: "border-blue-300/30 from-blue-500/15 hover:border-blue-300",
    yellow: "border-yellow-300/30 from-yellow-500/15 hover:border-yellow-300",
    emerald: "border-emerald-300/30 from-emerald-500/15 hover:border-emerald-300",
  };

  return classes[accent] ?? classes.blue;
}

function quickHintClass(accent: string) {
  const classes: Record<string, string> = {
    orange: "text-orange-100",
    blue: "text-blue-100",
    yellow: "text-yellow-100",
    emerald: "text-emerald-100",
  };

  return classes[accent] ?? classes.blue;
}

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [quickPayment, setQuickPayment] = useState<QuickPaymentConfig | null>(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function reloadExpenses() {
    setExpenses(await getExpenses());
  }

  useEffect(() => {
    function loadExpenses() {
      getExpenses()
        .then((nextExpenses) => {
          setExpenses(nextExpenses);
          setError("");
        })
        .catch((loadError: unknown) => {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger les depenses.");
        })
        .finally(() => setIsLoading(false));
    }

    loadExpenses();

    if (new URLSearchParams(window.location.search).get("scan") === "success") {
      Promise.resolve().then(() => setSuccess("Depense ajoutee depuis le scan."));
      window.history.replaceState(null, "", "/depenses");
    }

    return subscribeToFinanceTable("expenses", loadExpenses);
  }, []);

  async function handleAddExpense(values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      await addExpense({
        merchant: values.merchant,
        amount: Number(values.amount),
        category: values.category,
        date: values.date,
        payment: values.paymentMethod,
        note: values.note,
      });
      await reloadExpenses();
      setSuccess("Depense ajoutee");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'ajouter la depense.");
      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addOrangeExpense() {
    setError("");
    setIsSubmitting(true);

    try {
      await addExpense({
        merchant: "Orange",
        amount: 300,
        category: "Internet",
        date: getTodayDate(),
        payment: "Virement",
        note: "depense fixe",
      });
      await reloadExpenses();
      setSuccess("Depense Orange Internet 300 DH ajoutee.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'ajouter la depense Orange.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openQuickPayment(config: QuickPaymentConfig) {
    setError("");
    setQuickAmount("");
    setQuickPayment(config);
  }

  async function addQuickPaymentExpense() {
    if (!quickPayment) {
      return;
    }

    const amount = Number(quickAmount);

    if (!amount || amount <= 0) {
      setError(`Saisissez un montant ${quickPayment.merchant} valide.`);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await addExpense({
        merchant: quickPayment.merchant,
        amount,
        category: quickPayment.category,
        date: getTodayDate(),
        payment: quickPayment.payment,
        note: "",
      });
      await reloadExpenses();
      setSuccess(quickPayment.successMessage);
      setQuickAmount("");
      setQuickPayment(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Impossible d'ajouter la depense ${quickPayment.merchant}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    setError("");

    try {
      await deleteExpense(id);
      setExpenses((current) => current.filter((expense) => expense.id !== id));
      setSuccess("Depense supprimee.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer la depense.");
    }
  }

  async function handleUpdateExpense(expense: Expense, values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const updatedExpense = await updateExpense(expense.id, {
        merchant: values.merchant,
        amount: Number(values.amount),
        category: values.category,
        date: values.date,
        payment: values.paymentMethod,
        note: values.note,
      });
      setExpenses((current) => current.map((item) => (item.id === expense.id ? updatedExpense : item)));
      setEditingId("");
      setSuccess("Depense modifiee.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Impossible de modifier la depense.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <div className="mb-4">
            <p className="text-sm font-black uppercase text-emerald-300">Paiements rapides</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Ajouter une depense en un geste</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickPaymentCards.map((card) => (
              <button
                key={card.merchant}
                type="button"
                onClick={() => {
                  if (card.merchant === "Orange") {
                    void addOrangeExpense();
                    return;
                  }

                  openQuickPayment(card);
                }}
                disabled={isSubmitting}
                className={`group min-h-40 rounded-lg border bg-gradient-to-br to-white/[0.03] p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${quickCardClass(card.accent)}`}
              >
                <div className="grid h-20 place-items-center rounded-lg bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.logo} alt={card.merchant} className="max-h-16 max-w-full object-contain" />
                </div>
                <p className="mt-4 text-lg font-black text-white">{card.merchant}</p>
                <p className={`mt-1 text-sm font-semibold ${quickHintClass(card.accent)}`}>{card.hint}</p>
              </button>
            ))}
          </div>
        </section>

        <FinanceForm
          title="Ajouter une depense"
          submitLabel="Ajouter la depense"
          isSubmitting={isSubmitting}
          onSubmit={handleAddExpense}
          fields={[
            { label: "Montant", name: "amount", type: "number", placeholder: "0" },
            { label: "Marchand", name: "merchant", placeholder: "Nom du marchand" },
            { label: "Categorie", name: "category", options: expenseCategories },
            { label: "Date", name: "date", type: "date" },
            { label: "Moyen de paiement", name: "paymentMethod", options: paymentMethods },
            { label: "Note", name: "note", placeholder: "Detail optionnel" },
          ]}
        />
      </div>

      <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
        <h2 className="text-lg font-semibold text-white">Liste des depenses</h2>
        {success ? <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</p> : null}
        {error ? <p className="mt-4 whitespace-pre-line rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
        <div className="mt-5">
          {isLoading ? (
            <p className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">Chargement des depenses...</p>
          ) : expenses.length === 0 ? (
            <EmptyState title="Aucune depense" description="Ajoutez votre premiere depense pour commencer a suivre vos sorties." />
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="rounded-lg bg-white/[0.03] p-4">
                  {editingId === expense.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                        void handleUpdateExpense(expense, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
                      }}
                      className="grid gap-3"
                    >
                      <input name="merchant" defaultValue={expense.merchant ?? ""} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                      <input name="amount" type="number" defaultValue={expense.amount} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                      <select name="category" defaultValue={expense.category} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                        {expenseCategories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                      <input name="date" type="date" defaultValue={expense.date} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                      <select name="paymentMethod" defaultValue={expense.payment} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                        {paymentMethods.map((paymentMethod) => (
                          <option key={paymentMethod}>{paymentMethod}</option>
                        ))}
                      </select>
                      <input name="note" defaultValue={expense.note ?? ""} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                      <div className="flex gap-3 text-sm font-semibold">
                        <button type="submit" disabled={isSubmitting} className="text-emerald-300 transition hover:text-emerald-200 disabled:text-zinc-500">Enregistrer</button>
                        <button type="button" onClick={() => setEditingId("")} className="text-zinc-400 transition hover:text-zinc-200">Annuler</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{expense.merchant}</p>
                          <p className="mt-1 text-sm text-zinc-500">{expense.category}</p>
                        </div>
                        <p className="font-semibold text-zinc-100">{formatMoney(expense.amount)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm text-zinc-500">
                        <p>
                          {formatDate(expense.date)} - {expense.payment} - {expense.note}
                        </p>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setEditingId(expense.id)} className="font-semibold text-emerald-300 transition hover:text-emerald-200">
                            Modifier
                          </button>
                          <button type="button" onClick={() => void handleDeleteExpense(expense.id)} className="font-semibold text-rose-300 transition hover:text-rose-200">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {quickPayment ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-blue-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-blue-600">Paiement {quickPayment.merchant}</p>
                <h2 className="mt-1 text-2xl font-black text-zinc-950">Montant a payer</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  {quickPayment.category} - {quickPayment.payment} - {getTodayDate()}
                </p>
              </div>
              <button type="button" onClick={() => setQuickPayment(null)} className="grid size-10 place-items-center rounded-lg border border-zinc-200 text-lg font-black text-zinc-700">
                x
              </button>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-black text-zinc-700">
              Montant
              <input
                type="number"
                min="0"
                step="0.01"
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
                autoFocus
                className="h-12 rounded-lg border border-blue-100 bg-white px-4 text-lg font-black text-zinc-950 outline-none focus:border-blue-500"
                placeholder="0"
              />
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setQuickPayment(null)} className="h-12 rounded-lg border border-zinc-200 bg-white font-black text-zinc-700 transition hover:border-zinc-400">
                Annuler
              </button>
              <button type="button" onClick={() => void addQuickPaymentExpense()} disabled={isSubmitting} className="h-12 rounded-lg bg-blue-600 font-black text-white transition hover:bg-blue-700 disabled:bg-zinc-300">
                Valider
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
