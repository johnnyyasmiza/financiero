"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { FinanceForm } from "@/components/FinanceForm";
import { addRevenue, deleteRevenue, getRevenues, subscribeToFinanceTable, updateRevenue } from "@/lib/finance-db";
import { incomeSources, type Income } from "@/lib/finance-data";
import { formatDate, formatMoney } from "@/lib/utils";

export default function RevenusPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function loadRevenues() {
      getRevenues()
      .then((nextIncomes) => {
        setIncomes(nextIncomes);
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les revenus.");
      })
      .finally(() => setIsLoading(false));
    }

    loadRevenues();

    return subscribeToFinanceTable("revenues", loadRevenues);
  }, []);

  async function handleAddRevenue(values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const income = await addRevenue({
        source: values.source,
        amount: Number(values.amount),
        date: values.date,
        note: values.note,
      });
      setIncomes((current) => [income, ...current]);
      setSuccess("Revenu ajoute.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'ajouter le revenu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteRevenue(id: string) {
    setError("");

    try {
      await deleteRevenue(id);
      setIncomes((current) => current.filter((income) => income.id !== id));
      setSuccess("Revenu supprime.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer le revenu.");
    }
  }

  async function handleUpdateRevenue(income: Income, values: Record<string, string>) {
    setError("");
    setIsSubmitting(true);

    try {
      const updatedIncome = await updateRevenue(income.id, {
        source: values.source,
        amount: Number(values.amount),
        date: values.date,
        note: values.note,
      });
      setIncomes((current) => current.map((item) => (item.id === income.id ? updatedIncome : item)));
      setEditingId("");
      setSuccess("Revenu modifie.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Impossible de modifier le revenu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Revenus" subtitle="Centralisez vos revenus lorsque vous etes pret a les saisir.">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <FinanceForm
          title="Ajouter un revenu"
          submitLabel="Ajouter le revenu"
          isSubmitting={isSubmitting}
          onSubmit={handleAddRevenue}
          fields={[
            { label: "Montant", name: "amount", type: "number", placeholder: "0" },
            { label: "Source", name: "source", options: incomeSources },
            { label: "Date", name: "date", type: "date" },
            { label: "Note", name: "note", placeholder: "Detail optionnel" },
          ]}
        />
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Liste revenus</h2>
          {success ? <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{success}</p> : null}
          {error ? <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
          <div className="mt-5">
            {isLoading ? (
              <p className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">Chargement des revenus...</p>
            ) : incomes.length === 0 ? (
              <EmptyState title="Aucun revenu" description="Ajoutez votre premier revenu pour initialiser votre mois financier." />
            ) : (
              <div className="space-y-3">
                {incomes.map((income) => (
                  <div key={income.id} className="rounded-lg bg-white/[0.03] p-4">
                    {editingId === income.id ? (
                      <form onSubmit={(event) => {
                        event.preventDefault();
                        const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                        void handleUpdateRevenue(income, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
                      }} className="grid gap-3">
                        <select name="source" defaultValue={income.source} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4">
                          {incomeSources.map((source) => (
                            <option key={source}>{source}</option>
                          ))}
                        </select>
                        <input name="amount" type="number" defaultValue={income.amount} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                        <input name="date" type="date" defaultValue={income.date} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                        <input name="note" defaultValue={income.note ?? ""} className="h-10 rounded-lg border border-white/10 bg-black px-3 text-zinc-100 outline-none ring-emerald-400/30 focus:ring-4" />
                        <div className="flex gap-3 text-sm font-semibold">
                          <button type="submit" disabled={isSubmitting} className="text-emerald-300 transition hover:text-emerald-200 disabled:text-zinc-500">Enregistrer</button>
                          <button type="button" onClick={() => setEditingId("")} className="text-zinc-400 transition hover:text-zinc-200">Annuler</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-semibold text-white">{income.source}</p>
                          <p className="font-semibold text-emerald-300">{formatMoney(income.amount)}</p>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-sm text-zinc-500">
                          <p>
                            {formatDate(income.date)} - {income.note}
                          </p>
                          <div className="flex gap-3">
                            <button type="button" onClick={() => setEditingId(income.id)} className="font-semibold text-emerald-300 transition hover:text-emerald-200">
                              Modifier
                            </button>
                            <button type="button" onClick={() => void handleDeleteRevenue(income.id)} className="font-semibold text-rose-300 transition hover:text-rose-200">
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
      </div>
    </AppShell>
  );
}
